"""
Backend tests for BUG UTAMA (Layer 1 conflict) + Max Duration + Timestamp submitted_at
Verifies:
  1) Overlap terhadap booking berstatus 'menunggu' harus 409 dengan pesan pending.
  2) Overlap terhadap booking 'disetujui' harus 409 dengan pesan approved.
  3) Overlap parsial (bukan hanya persis sama) juga diblokir.
  4) Konfigurasi durasi maksimal aktif → 400.
  5) Kartu Kepala Labor (menunggu) menyediakan created_at (untuk 'Diajukan pada').
"""
import os
import time
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@fh.unri.ac.id", "password": "admin123"}


# ---------- helpers ----------
def _next_weekday(days_ahead: int = 7) -> str:
    import random
    d = date.today() + timedelta(days=days_ahead + random.randint(0, 50))
    while d.weekday() >= 5:  # Sat/Sun
        d += timedelta(days=1)
    return d.isoformat()


def _admin_session() -> requests.Session:
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


def _rooms():
    r = requests.get(f"{API}/rooms", timeout=15)
    assert r.status_code == 200
    rooms = [x for x in r.json() if x.get("active")]
    assert rooms, "no active rooms"
    return rooms


def _ensure_rate_limit(sess: requests.Session, limit: int = 200):
    """Raise rate limit so we can create multiple bookings in a row from same IP."""
    r = sess.patch(f"{API}/settings", json={"rate_limit_per_hour": limit}, timeout=15)
    assert r.status_code == 200, r.text


def _set_max_duration(sess: requests.Session, enabled: bool, hours: int = 3):
    r = sess.patch(f"{API}/settings",
                   json={"max_duration_enabled": enabled, "max_duration_hours": hours},
                   timeout=15)
    assert r.status_code == 200, r.text


def _valid_nim() -> str:
    # server nim_regex default typically 10 digits — construct dynamic 10-digit
    import random
    return "22010" + str(random.randint(10000, 99999))


def _payload(room_id, tanggal, start, end, nim=None):
    return {
        "nim": nim or _valid_nim(),
        "nama": "TEST User",
        "kelas": "TESTX",
        "room_id": room_id,
        "date": tanggal,
        "start_time": start,
        "end_time": end,
        "purpose": "Uji konflik jadwal Layer 1",
        "participants": 5,
        "contact": "081200000000",
        "captcha_a": 2,
        "captcha_b": 3,
        "captcha_answer": 5,
    }


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_session():
    s = _admin_session()
    _ensure_rate_limit(s, 500)
    yield s
    # cleanup: revert rate limit + ensure max_duration off
    try:
        _ensure_rate_limit(s, 5)
        _set_max_duration(s, False, 3)
    except Exception:
        pass


@pytest.fixture(scope="module")
def room_id():
    return _rooms()[0]["id"]


@pytest.fixture()
def unique_slot(room_id):
    """Unique date to avoid interfering with parallel state."""
    # pick a weekday ~30 days ahead; each test gets its own by adding uuid-based offset
    offset = 30 + (int(uuid.uuid4().int) % 20)
    return {"room_id": room_id, "date": _next_weekday(offset), "start": "13:00", "end": "15:00"}


# ---------- tests ----------
class TestLayer1PendingConflict:
    def test_second_booking_same_slot_blocked_409_pending_message(self, admin_session, unique_slot):
        import random
        # first: retry to avoid collision with pre-existing bookings
        for _ in range(5):
            slot_date = _next_weekday(30)
            start_h = random.choice([9, 10, 11, 13, 14, 15])
            start = f"{start_h:02d}:00"
            end = f"{start_h+1:02d}:00"
            p1 = _payload(unique_slot["room_id"], slot_date, start, end)
            r1 = requests.post(f"{API}/bookings/public", json=p1, timeout=15)
            if r1.status_code == 200:
                break
        assert r1.status_code == 200, f"first booking should succeed, got {r1.status_code} {r1.text}"
        b1 = r1.json()
        assert b1["status"] == "menunggu"
        assert b1["code"].startswith("LAB-")

        # second: same slot, different NIM → must be blocked (409)
        p2 = _payload(unique_slot["room_id"], slot_date, start, end, nim=_valid_nim())
        r2 = requests.post(f"{API}/bookings/public", json=p2, timeout=15)
        assert r2.status_code == 409, f"expected 409, got {r2.status_code} body={r2.text}"
        detail = r2.json().get("detail")
        # detail is a JSON string per server implementation
        import json as _json
        d = _json.loads(detail) if isinstance(detail, str) else detail
        assert "menunggu persetujuan mahasiswa lain" in d["message"].lower() or \
               "menunggu persetujuan" in d["message"].lower(), f"unexpected message: {d['message']}"
        assert "suggestions" in d
        assert any(c["status"] == "menunggu" for c in d["conflicts"])

    def test_partial_overlap_pending_blocked(self, admin_session, room_id):
        import random
        # try multiple times to avoid collision with old data
        for _ in range(5):
            d = _next_weekday(45)
            start = f"{random.choice([10, 11, 14, 15]):02d}:00"
            # first
            end_h = int(start[:2]) + 2
            p1 = _payload(room_id, d, start, f"{end_h:02d}:00")
            r1 = requests.post(f"{API}/bookings/public", json=p1, timeout=15)
            if r1.status_code == 200:
                break
        assert r1.status_code == 200, r1.text

        # partial overlap +1h
        overlap_start = f"{int(start[:2]) + 1:02d}:00"
        overlap_end = f"{end_h + 1:02d}:00"
        p2 = _payload(room_id, d, overlap_start, overlap_end, nim=_valid_nim())
        r2 = requests.post(f"{API}/bookings/public", json=p2, timeout=15)
        assert r2.status_code == 409, r2.text


class TestLayer1ApprovedConflict:
    def test_approved_conflict_message_differs(self, admin_session, room_id):
        import random
        for _ in range(5):
            d = _next_weekday(55 + random.randint(0, 40))
            start_h = random.choice([9, 10, 13, 14])
            p1 = _payload(room_id, d, f"{start_h:02d}:00", f"{start_h+2:02d}:00")
            r1 = requests.post(f"{API}/bookings/public", json=p1, timeout=15)
            if r1.status_code == 200:
                break
        assert r1.status_code == 200, r1.text
        b1 = r1.json()

        # approve it (admin can approve? Need kepala_labor. Try admin first, fallback via db-less: use approve endpoint if exists)
        # Attempt PATCH via admin session
        approve = admin_session.post(f"{API}/bookings/{b1['id']}/approve", timeout=15)
        assert approve.status_code in (200, 204), f"approve failed: {approve.status_code} {approve.text}"

        # now second overlap booking → different message (still overlap with approved)
        p2 = _payload(room_id, d, f"{start_h:02d}:30", f"{start_h+1:02d}:30", nim=_valid_nim())
        r2 = requests.post(f"{API}/bookings/public", json=p2, timeout=15)
        assert r2.status_code == 409, r2.text
        import json as _json
        detail = r2.json().get("detail")
        dd = _json.loads(detail) if isinstance(detail, str) else detail
        assert "disetujui" in dd["message"].lower()


class TestMaxDuration:
    def test_max_duration_blocks_when_enabled(self, admin_session, room_id):
        _set_max_duration(admin_session, True, 3)
        try:
            d = _next_weekday(65)
            # 08:00-13:00 = 5 hours > 3
            p = _payload(room_id, d, "08:00", "13:00")
            r = requests.post(f"{API}/bookings/public", json=p, timeout=15)
            assert r.status_code == 400, r.text
            body = r.json()
            msg = body.get("detail", "")
            assert "durasi" in msg.lower() and "3 jam" in msg
        finally:
            _set_max_duration(admin_session, False, 3)

    def test_max_duration_allows_when_disabled(self, admin_session, room_id):
        _set_max_duration(admin_session, False, 3)
        import random
        for _ in range(5):
            d = _next_weekday(70)
            start_h = random.choice([10, 12, 13])
            p = _payload(room_id, d, f"{start_h:02d}:00", "16:00")  # ≥3h
            r = requests.post(f"{API}/bookings/public", json=p, timeout=15)
            if r.status_code == 200:
                break
        assert r.status_code == 200, r.text


class TestBookingsListHasCreatedAt:
    def test_created_at_present_for_pending(self, admin_session, room_id):
        import random
        for _ in range(5):
            d = _next_weekday(80)
            start_h = random.choice([9, 10, 11, 13, 14, 15])
            p = _payload(room_id, d, f"{start_h:02d}:00", f"{start_h+1:02d}:00")
            r = requests.post(f"{API}/bookings/public", json=p, timeout=15)
            if r.status_code == 200:
                break
        assert r.status_code == 200, r.text
        code = r.json()["code"]

        # list bookings as admin
        lst = admin_session.get(f"{API}/bookings?status=menunggu", timeout=15)
        assert lst.status_code == 200, lst.text
        items = lst.json()
        m = next((x for x in items if x.get("code") == code), None)
        assert m is not None, "booking not found in list"
        assert m.get("created_at"), "created_at missing — needed for 'Diajukan pada'"
