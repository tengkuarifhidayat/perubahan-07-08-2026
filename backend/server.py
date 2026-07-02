from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import io
import json
import uuid
import secrets
import asyncio
import logging
from datetime import datetime, timezone, timedelta, date, time as dtime
from typing import List, Optional, Dict, Any, Set

import bcrypt
import jwt as pyjwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

# --------------------------- Setup ---------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="FH UNRI - Sistem Pemesanan Ruangan Labor")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"

ROLES = {"admin", "kepala_labor", "tata_usaha"}

# --------------------------- Helpers ---------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": now_utc() + timedelta(hours=12), "type": "access"}
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def parse_time(s: str) -> dtime:
    h, m = s.split(":")
    return dtime(int(h), int(m))

def time_to_min(s: str) -> int:
    h, m = s.split(":")
    return int(h) * 60 + int(m)

def sanitize_user(u: dict) -> dict:
    return {
        "id": str(u["_id"]),
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u["role"],
        "created_at": u.get("created_at").isoformat() if u.get("created_at") else None,
    }

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Tidak terautentikasi")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "access":
            raise HTTPException(401, "Token tidak valid")
        user = await db.users.find_one({"_id": payload["sub"]})
        if not user:
            raise HTTPException(401, "User tidak ditemukan")
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token kedaluwarsa")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Token tidak valid")

def require_role(*roles):
    async def dep(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Akses ditolak")
        return user
    return dep

# --------------------------- Settings ---------------------------
DEFAULT_SETTINGS = {
    "operating_hours": {  # 0=Mon..6=Sun
        "0": {"open": True, "start": "08:00", "end": "16:00"},
        "1": {"open": True, "start": "08:00", "end": "16:00"},
        "2": {"open": True, "start": "08:00", "end": "16:00"},
        "3": {"open": True, "start": "08:00", "end": "16:00"},
        "4": {"open": True, "start": "08:00", "end": "16:00"},
        "5": {"open": False, "start": "08:00", "end": "16:00"},
        "6": {"open": False, "start": "08:00", "end": "16:00"},
    },
    "holidays": [],  # list of "YYYY-MM-DD"
    "quota_enabled": False,
    "quota_per_week": 3,
    "sla_days": 2,
    "rate_limit_per_hour": 5,
    "nim_regex": r"^\d{7,15}$",
    "kiosk_token": None,
    "max_duration_enabled": False,
    "max_duration_hours": 3,
}

async def get_settings() -> dict:
    doc = await db.settings.find_one({"_id": "app"})
    if not doc:
        doc = {"_id": "app", **DEFAULT_SETTINGS}
        await db.settings.insert_one(doc)
    # backfill missing keys
    changed = False
    for k, v in DEFAULT_SETTINGS.items():
        if k not in doc:
            doc[k] = v
            changed = True
    if changed:
        await db.settings.update_one({"_id": "app"}, {"$set": doc})
    doc.pop("_id", None)
    return doc

async def set_settings(patch: dict) -> dict:
    await db.settings.update_one({"_id": "app"}, {"$set": patch}, upsert=True)
    return await get_settings()

# --------------------------- Startup ---------------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.bookings.create_index([("room_id", 1), ("date", 1)])
    await db.bookings.create_index("code", unique=True)
    await db.bookings.create_index("nim")
    await db.mahasiswa_cache.create_index("nim", unique=True)
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.rate_limits.create_index("expires_at", expireAfterSeconds=0)

    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@fh.unri.ac.id")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "_id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_pw),
            "name": "Admin Dekan",
            "role": "admin",
            "created_at": now_utc(),
        })
        logger.info("Admin seeded: %s", admin_email)
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_pw)}},
        )
        logger.info("Admin password updated from env: %s", admin_email)

    # seed rooms
    count = await db.rooms.count_documents({})
    if count == 0:
        await db.rooms.insert_many([
            {"_id": "labor-1", "name": "Labor 1", "active": True, "order": 1},
            {"_id": "labor-2", "name": "Labor 2", "active": True, "order": 2},
        ])
        logger.info("Rooms seeded")

    await get_settings()

    # start background expiry checker
    asyncio.create_task(background_expiry_loop())

# --------------------------- Auth Endpoints ---------------------------
class LoginBody(BaseModel):
    email: EmailStr
    password: str

@api.post("/auth/login")
async def auth_login(body: LoginBody, response: Response):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Email atau password salah")
    token = create_access_token(user["_id"], user["email"], user["role"])
    response.set_cookie("access_token", token, httponly=True, secure=False,
                        samesite="lax", max_age=43200, path="/")
    return {"user": sanitize_user(user), "access_token": token}

@api.post("/auth/logout")
async def auth_logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return sanitize_user(user)

# --------------------------- User Management (Admin) ---------------------------
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

@api.get("/users")
async def list_users(user: dict = Depends(require_role("admin"))):
    users = await db.users.find({}).sort("created_at", -1).to_list(500)
    return [sanitize_user(u) for u in users]

@api.post("/users")
async def create_user(body: UserCreate, user: dict = Depends(require_role("admin"))):
    if body.role not in ROLES:
        raise HTTPException(400, "Role tidak valid")
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email sudah terdaftar")
    doc = {
        "_id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": body.role,
        "created_at": now_utc(),
    }
    await db.users.insert_one(doc)
    return sanitize_user(doc)

@api.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, user: dict = Depends(require_role("admin"))):
    patch = {}
    if body.email: patch["email"] = body.email.lower()
    if body.name is not None: patch["name"] = body.name
    if body.role:
        if body.role not in ROLES:
            raise HTTPException(400, "Role tidak valid")
        patch["role"] = body.role
    if body.password: patch["password_hash"] = hash_password(body.password)
    if not patch:
        raise HTTPException(400, "Tidak ada perubahan")
    await db.users.update_one({"_id": user_id}, {"$set": patch})
    u = await db.users.find_one({"_id": user_id})
    if not u: raise HTTPException(404, "User tidak ditemukan")
    return sanitize_user(u)

@api.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_role("admin"))):
    if user_id == user["_id"]:
        raise HTTPException(400, "Tidak bisa menghapus akun sendiri")
    r = await db.users.delete_one({"_id": user_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "User tidak ditemukan")
    return {"ok": True}

# --------------------------- Mahasiswa Cache ---------------------------
@api.get("/mahasiswa/{nim}")
async def get_mahasiswa(nim: str):
    m = await db.mahasiswa_cache.find_one({"nim": nim})
    if not m:
        return {"nim": nim, "nama": None, "kelas": None}
    return {"nim": m["nim"], "nama": m.get("nama"), "kelas": m.get("kelas")}

@api.get("/mahasiswa")
async def list_mahasiswa(user: dict = Depends(require_role("admin"))):
    rows = await db.mahasiswa_cache.find({}).sort("nim", 1).to_list(2000)
    return [{"nim": r["nim"], "nama": r.get("nama"), "kelas": r.get("kelas")} for r in rows]

class MahasiswaUpdate(BaseModel):
    nim: str
    nama: str
    kelas: str

@api.patch("/mahasiswa/{nim}")
async def update_mahasiswa(nim: str, body: MahasiswaUpdate, user: dict = Depends(require_role("admin"))):
    await db.mahasiswa_cache.update_one(
        {"nim": nim},
        {"$set": {"nim": body.nim, "nama": body.nama, "kelas": body.kelas, "updated_at": now_utc()}},
        upsert=True,
    )
    # Also update historical bookings if NIM stayed the same (only name/kelas)
    if body.nim == nim:
        await db.bookings.update_many({"nim": nim}, {"$set": {"nama": body.nama, "kelas": body.kelas}})
    return {"ok": True}

# --------------------------- Rooms ---------------------------
@api.get("/rooms")
async def list_rooms():
    rows = await db.rooms.find({}).sort("order", 1).to_list(20)
    return [{"id": r["_id"], "name": r["name"], "active": r.get("active", True)} for r in rows]

class RoomUpdate(BaseModel):
    name: Optional[str] = None
    active: Optional[bool] = None

@api.patch("/rooms/{room_id}")
async def update_room(room_id: str, body: RoomUpdate, user: dict = Depends(require_role("admin"))):
    patch = {}
    if body.name is not None: patch["name"] = body.name
    if body.active is not None: patch["active"] = body.active
    if patch:
        await db.rooms.update_one({"_id": room_id}, {"$set": patch})
    r = await db.rooms.find_one({"_id": room_id})
    if not r: raise HTTPException(404, "Ruangan tidak ditemukan")
    # Update denormalized room_name in bookings if renamed
    if body.name:
        await db.bookings.update_many({"room_id": room_id}, {"$set": {"room_name": body.name}})
    return {"id": r["_id"], "name": r["name"], "active": r.get("active", True)}

# --------------------------- Settings ---------------------------
@api.get("/settings/public")
async def settings_public():
    s = await get_settings()
    return {
        "operating_hours": s["operating_hours"],
        "holidays": s["holidays"],
        "nim_regex": s["nim_regex"],
        "max_duration_enabled": bool(s.get("max_duration_enabled", False)),
        "max_duration_hours": int(s.get("max_duration_hours", 3)),
    }

@api.get("/settings")
async def settings_get(user: dict = Depends(require_role("admin"))):
    s = await get_settings()
    return s

class SettingsPatch(BaseModel):
    operating_hours: Optional[Dict[str, Dict[str, Any]]] = None
    holidays: Optional[List[str]] = None
    quota_enabled: Optional[bool] = None
    quota_per_week: Optional[int] = None
    sla_days: Optional[int] = None
    rate_limit_per_hour: Optional[int] = None
    nim_regex: Optional[str] = None
    max_duration_enabled: Optional[bool] = None
    max_duration_hours: Optional[int] = None

@api.patch("/settings")
async def settings_patch(body: SettingsPatch, user: dict = Depends(require_role("admin"))):
    patch = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    return await set_settings(patch)

@api.post("/settings/kiosk-token/regenerate")
async def regen_kiosk_token(user: dict = Depends(require_role("admin"))):
    token = secrets.token_urlsafe(24)
    await set_settings({"kiosk_token": token})
    return {"kiosk_token": token}

@api.post("/settings/kiosk-token/revoke")
async def revoke_kiosk_token(user: dict = Depends(require_role("admin"))):
    await set_settings({"kiosk_token": None})
    return {"ok": True}

# --------------------------- Bookings ---------------------------
STATUS_MENUNGGU = "menunggu"
STATUS_DISETUJUI = "disetujui"
STATUS_DITOLAK = "ditolak"
STATUS_DIBATALKAN = "dibatalkan"
STATUS_KEDALUWARSA = "kedaluwarsa"

class BookingCreate(BaseModel):
    nim: str
    nama: str
    kelas: str
    room_id: str
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    purpose: str
    participants: int
    contact: Optional[str] = None
    captcha_a: int
    captcha_b: int
    captcha_answer: int

def get_client_ip(request: Request) -> str:
    """Extract real client IP behind proxies/ingress (X-Forwarded-For / X-Real-IP)."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        # First IP in the chain is the original client
        first = xff.split(",")[0].strip()
        if first:
            return first
    xreal = request.headers.get("x-real-ip")
    if xreal:
        return xreal.strip()
    return request.client.host if request.client else "unknown"

async def check_operating_hours(s: dict, date_str: str, start: str, end: str):
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    if date_str in s.get("holidays", []):
        raise HTTPException(400, "Tanggal tersebut ditandai sebagai hari libur")
    wd = str(d.weekday())
    oh = s["operating_hours"].get(wd, {})
    if not oh.get("open"):
        raise HTTPException(400, "Ruangan tutup pada hari itu")
    if time_to_min(start) < time_to_min(oh["start"]) or time_to_min(end) > time_to_min(oh["end"]):
        raise HTTPException(400, f"Jam di luar jam operasional ({oh['start']}–{oh['end']})")

def check_max_duration(s: dict, start: str, end: str):
    if not s.get("max_duration_enabled"):
        return
    max_hours = int(s.get("max_duration_hours", 3))
    if time_to_min(end) - time_to_min(start) > max_hours * 60:
        raise HTTPException(400, f"Durasi pemesanan melebihi batas maksimal {max_hours} jam per pengajuan")

async def find_conflicts(room_id: str, date_str: str, start: str, end: str,
                         statuses: List[str], exclude_id: Optional[str] = None) -> List[dict]:
    q = {"room_id": room_id, "date": date_str, "status": {"$in": statuses}}
    if exclude_id:
        q["_id"] = {"$ne": exclude_id}
    rows = await db.bookings.find(q).to_list(200)
    sm, em = time_to_min(start), time_to_min(end)
    conflicts = []
    for r in rows:
        rs, re_ = time_to_min(r["start_time"]), time_to_min(r["end_time"])
        # overlap: start_new < end_existing AND end_new > start_existing
        if sm < re_ and em > rs:
            conflicts.append(r)
    return conflicts

def sanitize_booking(b: dict) -> dict:
    return {
        "id": b["_id"],
        "code": b["code"],
        "nim": b["nim"],
        "nama": b["nama"],
        "kelas": b["kelas"],
        "room_id": b["room_id"],
        "room_name": b["room_name"],
        "date": b["date"],
        "start_time": b["start_time"],
        "end_time": b["end_time"],
        "purpose": b["purpose"],
        "participants": b["participants"],
        "contact": b.get("contact"),
        "status": b["status"],
        "rejection_reason": b.get("rejection_reason"),
        "approved_by": b.get("approved_by"),
        "approved_at": b["approved_at"].isoformat() if b.get("approved_at") else None,
        "created_at": b["created_at"].isoformat() if b.get("created_at") else None,
        "cancelled_at": b["cancelled_at"].isoformat() if b.get("cancelled_at") else None,
        "reschedule_logs": b.get("reschedule_logs", []),
        "auto_rejected": bool(b.get("auto_rejected", False)),
        "alternatives": b.get("alternatives", []),
    }

async def generate_booking_code() -> str:
    year = datetime.now().year
    # simple counter based on year
    doc = await db.counters.find_one_and_update(
        {"_id": f"booking-{year}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = doc["seq"] if doc else 1
    if not seq:
        seq = 1
    return f"LAB-{year}-{seq:04d}"

@api.post("/bookings/public")
async def create_booking(body: BookingCreate, request: Request):
    s = await get_settings()

    # captcha
    if body.captcha_a + body.captcha_b != body.captcha_answer:
        raise HTTPException(400, "Verifikasi CAPTCHA salah")

    # NIM validation
    if not re.match(s["nim_regex"], body.nim):
        raise HTTPException(400, "Format NIM tidak valid")

    # rate limit by real client IP (behind ingress → use X-Forwarded-For)
    ip = get_client_ip(request)
    limit = int(s.get("rate_limit_per_hour", 5))
    window_start = now_utc() - timedelta(hours=1)
    # Only count SUCCESSFULLY created bookings from the same real IP in the last hour.
    # Failed submissions (captcha wrong, conflict, quota, etc.) are never inserted,
    # so they naturally do NOT count toward this limit.
    count = 0
    if ip and ip != "unknown":
        count = await db.bookings.count_documents({
            "_ip": ip, "created_at": {"$gte": window_start},
        })
    if count >= limit:
        raise HTTPException(429, f"Terlalu banyak pengajuan dari perangkat ini. Coba lagi dalam 1 jam.")

    # time validation
    if time_to_min(body.start_time) >= time_to_min(body.end_time):
        raise HTTPException(400, "Jam mulai harus lebih awal dari jam selesai")

    # max booking duration (configurable by Admin)
    check_max_duration(s, body.start_time, body.end_time)

    # operating hours & holidays
    await check_operating_hours(s, body.date, body.start_time, body.end_time)

    # room exists
    room = await db.rooms.find_one({"_id": body.room_id})
    if not room or not room.get("active", True):
        raise HTTPException(400, "Ruangan tidak tersedia")

    # conflicts — Layer 1: block against BOTH approved and pending bookings
    conflicts = await find_conflicts(body.room_id, body.date, body.start_time, body.end_time,
                                     [STATUS_DISETUJUI, STATUS_MENUNGGU])
    if conflicts:
        suggestions = suggest_free_slots(conflicts, s, body.date)
        has_approved = any(c["status"] == STATUS_DISETUJUI for c in conflicts)
        if has_approved:
            msg = "Jadwal bentrok dengan pengajuan yang sudah disetujui"
        else:
            msg = ("Slot ini sedang menunggu persetujuan mahasiswa lain. "
                   "Slot bisa terbuka kembali jika pengajuan tersebut ditolak — "
                   "coba cek lagi nanti, atau pilih slot alternatif di bawah ini.")
        raise HTTPException(409, json.dumps({
            "message": msg,
            "conflicts": [{"code": c["code"], "start": c["start_time"], "end": c["end_time"], "status": c["status"]} for c in conflicts],
            "suggestions": suggestions,
        }))

    # class quota
    if s.get("quota_enabled"):
        week_start = (datetime.strptime(body.date, "%Y-%m-%d").date()
                      - timedelta(days=datetime.strptime(body.date, "%Y-%m-%d").weekday()))
        week_end = week_start + timedelta(days=7)
        cnt = await db.bookings.count_documents({
            "kelas": body.kelas,
            "date": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()},
            "status": {"$in": [STATUS_MENUNGGU, STATUS_DISETUJUI]},
        })
        if cnt >= int(s["quota_per_week"]):
            raise HTTPException(400, f"Kuota mingguan kelas {body.kelas} sudah tercapai ({cnt}/{s['quota_per_week']})")

    # cache mahasiswa
    await db.mahasiswa_cache.update_one(
        {"nim": body.nim},
        {"$set": {"nim": body.nim, "nama": body.nama, "kelas": body.kelas, "updated_at": now_utc()}},
        upsert=True,
    )

    code = await generate_booking_code()
    doc = {
        "_id": str(uuid.uuid4()),
        "code": code,
        "nim": body.nim,
        "nama": body.nama,
        "kelas": body.kelas,
        "room_id": body.room_id,
        "room_name": room["name"],
        "date": body.date,
        "start_time": body.start_time,
        "end_time": body.end_time,
        "purpose": body.purpose,
        "participants": body.participants,
        "contact": body.contact,
        "status": STATUS_MENUNGGU,
        "created_at": now_utc(),
        "_ip": ip,
        "reschedule_logs": [],
    }
    await db.bookings.insert_one(doc)

    # notify kepala labor
    await notify_role("kepala_labor", f"Pengajuan baru: {code} ({room['name']}, {body.date} {body.start_time}-{body.end_time})", "booking_new", doc["_id"])

    await broadcast_event({"type": "booking_created", "booking": sanitize_booking(doc)})
    return sanitize_booking(doc)

def suggest_free_slots(conflicts: List[dict], s: dict, date_str: str) -> List[Dict[str, str]]:
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    wd = str(d.weekday())
    oh = s["operating_hours"].get(wd, {})
    if not oh.get("open"):
        return []
    open_m = time_to_min(oh["start"])
    close_m = time_to_min(oh["end"])
    occupied = sorted([(time_to_min(c["start_time"]), time_to_min(c["end_time"])) for c in conflicts])
    free = []
    cur = open_m
    for st, en in occupied:
        if st > cur:
            free.append((cur, st))
        cur = max(cur, en)
    if cur < close_m:
        free.append((cur, close_m))
    def fmt(m): return f"{m//60:02d}:{m%60:02d}"
    return [{"start": fmt(a), "end": fmt(b)} for a, b in free if b - a >= 30][:3]


def _fmt_date_id(date_str: str) -> str:
    """Format YYYY-MM-DD -> '2 Juli 2026' (Indonesian)."""
    bulan = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
             "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    return f"{d.day} {bulan[d.month]} {d.year}"


async def build_layer2_rejection_message(rejected: dict, approved: dict) -> Dict[str, Any]:
    """Build a structured payload (message + machine-readable alternatives) for a
    booking auto-rejected because another overlapping booking was approved."""
    s = await get_settings()
    date_str = approved["date"]
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    wd = str(d.weekday())
    oh = s["operating_hours"].get(wd, {})
    date_id = _fmt_date_id(date_str)

    base = (f"Pengajuan Anda ditolak karena {approved['room_name']} jam "
            f"{approved['start_time']}–{approved['end_time']} pada {date_id} "
            f"sudah disetujui untuk pemesan lain.")

    fallback = " Tidak ada slot kosong lain di hari yang sama, silakan pilih tanggal lain."

    if not oh.get("open"):
        return {"message": base + fallback, "alternatives": []}

    open_m = time_to_min(oh["start"])
    close_m = time_to_min(oh["end"])
    orig_dur = time_to_min(rejected["end_time"]) - time_to_min(rejected["start_time"])
    if orig_dur <= 0: orig_dur = 60

    alternatives_text: List[str] = []
    alternatives_data: List[Dict[str, Any]] = []

    # 1. Same room — earliest free slot AFTER the approved end (within operating hours)
    same_room_busy = await db.bookings.find({
        "room_id": approved["room_id"], "date": date_str,
        "status": {"$in": [STATUS_MENUNGGU, STATUS_DISETUJUI]},
        "_id": {"$ne": rejected["_id"]},
    }).to_list(200)
    approved_end_m = time_to_min(approved["end_time"])
    if approved_end_m < close_m:
        busy_intervals = sorted([(time_to_min(x["start_time"]), time_to_min(x["end_time"])) for x in same_room_busy])
        cur = max(approved_end_m, open_m)
        free_start = None
        block_end = close_m
        for st, en in busy_intervals:
            if en <= cur: continue
            if st > cur:
                free_start = cur
                block_end = st
                break
            cur = max(cur, en)
        if free_start is None and cur < close_m:
            free_start = cur
            block_end = close_m
        if free_start is not None and free_start < close_m:
            alt_end = min(free_start + orig_dur, block_end)
            alternatives_text.append(f"{approved['room_name']} jam {free_start//60:02d}:{free_start%60:02d} ke atas")
            alternatives_data.append({
                "room_id": approved["room_id"], "room_name": approved["room_name"],
                "date": date_str,
                "start_time": f"{free_start//60:02d}:{free_start%60:02d}",
                "end_time": f"{alt_end//60:02d}:{alt_end%60:02d}",
                "kind": "same_room_later",
            })

    # 2. Other rooms — same time slot still free on that date?
    rooms = await db.rooms.find({"active": True}).to_list(20)
    for r in rooms:
        if r["_id"] == approved["room_id"]:
            continue
        other_conflicts = await find_conflicts(
            r["_id"], date_str, approved["start_time"], approved["end_time"],
            [STATUS_MENUNGGU, STATUS_DISETUJUI],
        )
        if not other_conflicts:
            alternatives_text.append(f"{r['name']} jam {approved['start_time']}–{approved['end_time']}")
            alternatives_data.append({
                "room_id": r["_id"], "room_name": r["name"],
                "date": date_str,
                "start_time": approved["start_time"], "end_time": approved["end_time"],
                "kind": "other_room_same_time",
            })

    if not alternatives_text:
        return {"message": base + fallback, "alternatives": []}

    msg = base + " Slot yang masih tersedia di hari yang sama: " + ", atau ".join(alternatives_text) + "."
    return {"message": msg, "alternatives": alternatives_data}

@api.get("/bookings/check")
async def check_status(code: Optional[str] = None, nim: Optional[str] = None):
    if code:
        b = await db.bookings.find_one({"code": code.upper()})
        return {"bookings": [sanitize_booking(b)] if b else []}
    if nim:
        rows = await db.bookings.find({"nim": nim}).sort("created_at", -1).to_list(100)
        return {"bookings": [sanitize_booking(r) for r in rows]}
    raise HTTPException(400, "Berikan kode booking atau NIM")

class BookingEdit(BaseModel):
    room_id: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    purpose: Optional[str] = None
    participants: Optional[int] = None
    contact: Optional[str] = None

@api.patch("/bookings/public/{code}")
async def edit_booking_public(code: str, body: BookingEdit):
    b = await db.bookings.find_one({"code": code.upper()})
    if not b: raise HTTPException(404, "Pengajuan tidak ditemukan")
    if b["status"] != STATUS_MENUNGGU:
        raise HTTPException(400, "Hanya pengajuan berstatus 'Menunggu' yang bisa diubah")
    s = await get_settings()
    new_room = body.room_id or b["room_id"]
    new_date = body.date or b["date"]
    new_start = body.start_time or b["start_time"]
    new_end = body.end_time or b["end_time"]
    if time_to_min(new_start) >= time_to_min(new_end):
        raise HTTPException(400, "Jam mulai harus lebih awal dari jam selesai")
    check_max_duration(s, new_start, new_end)
    await check_operating_hours(s, new_date, new_start, new_end)
    conflicts = await find_conflicts(new_room, new_date, new_start, new_end,
                                     [STATUS_DISETUJUI, STATUS_MENUNGGU], exclude_id=b["_id"])
    if conflicts:
        has_approved = any(c["status"] == STATUS_DISETUJUI for c in conflicts)
        if has_approved:
            msg = "Jadwal bentrok dengan pengajuan yang sudah disetujui"
        else:
            msg = ("Slot ini sedang menunggu persetujuan mahasiswa lain. "
                   "Slot bisa terbuka kembali jika pengajuan tersebut ditolak — "
                   "coba cek lagi nanti, atau pilih slot lain.")
        raise HTTPException(409, json.dumps({"message": msg}))
    room = await db.rooms.find_one({"_id": new_room})
    if not room: raise HTTPException(400, "Ruangan tidak valid")
    patch = {"room_id": new_room, "room_name": room["name"], "date": new_date,
             "start_time": new_start, "end_time": new_end}
    if body.purpose is not None: patch["purpose"] = body.purpose
    if body.participants is not None: patch["participants"] = body.participants
    if body.contact is not None: patch["contact"] = body.contact
    await db.bookings.update_one({"_id": b["_id"]}, {"$set": patch})
    updated = await db.bookings.find_one({"_id": b["_id"]})
    await broadcast_event({"type": "booking_updated", "booking": sanitize_booking(updated)})
    return sanitize_booking(updated)

@api.post("/bookings/public/{code}/cancel")
async def cancel_booking_public(code: str):
    b = await db.bookings.find_one({"code": code.upper()})
    if not b: raise HTTPException(404, "Pengajuan tidak ditemukan")
    if b["status"] not in (STATUS_MENUNGGU, STATUS_DISETUJUI):
        raise HTTPException(400, "Pengajuan tidak dapat dibatalkan")
    # check event not past
    ev_dt = datetime.fromisoformat(f"{b['date']}T{b['start_time']}:00")
    if ev_dt < datetime.now():
        raise HTTPException(400, "Pengajuan sudah lewat, tidak bisa dibatalkan")
    await db.bookings.update_one({"_id": b["_id"]}, {"$set": {
        "status": STATUS_DIBATALKAN, "cancelled_at": now_utc()
    }})
    updated = await db.bookings.find_one({"_id": b["_id"]})
    await broadcast_event({"type": "booking_updated", "booking": sanitize_booking(updated)})
    await notify_role("kepala_labor", f"Pengajuan {code} dibatalkan mahasiswa", "booking_cancelled", b["_id"])
    return sanitize_booking(updated)

# ------- Staff booking endpoints -------
@api.get("/bookings")
async def list_bookings(
    status: Optional[str] = None,
    room_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    kelas: Optional[str] = None,
    nim: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q: Dict[str, Any] = {}
    if status: q["status"] = status
    if room_id: q["room_id"] = room_id
    if kelas: q["kelas"] = kelas
    if nim: q["nim"] = nim
    if date_from or date_to:
        q["date"] = {}
        if date_from: q["date"]["$gte"] = date_from
        if date_to: q["date"]["$lte"] = date_to
    rows = await db.bookings.find(q).sort([("date", -1), ("start_time", 1)]).to_list(1000)
    return [sanitize_booking(r) for r in rows]

@api.get("/bookings/calendar")
async def calendar_bookings(date_from: str, date_to: str):
    """Public: for calendar display and kiosk. Only date range required."""
    rows = await db.bookings.find({
        "date": {"$gte": date_from, "$lte": date_to},
        "status": {"$in": [STATUS_MENUNGGU, STATUS_DISETUJUI]},
    }).sort([("date", 1), ("start_time", 1)]).to_list(1000)
    return [sanitize_booking(r) for r in rows]

class ApproveBody(BaseModel):
    reason: Optional[str] = None

@api.post("/bookings/{booking_id}/approve")
async def approve_booking(booking_id: str, user: dict = Depends(require_role("kepala_labor", "admin"))):
    b = await db.bookings.find_one({"_id": booking_id})
    if not b: raise HTTPException(404, "Tidak ditemukan")
    if b["status"] != STATUS_MENUNGGU:
        raise HTTPException(400, "Status bukan menunggu")
    # race-condition guard: re-check conflicts against approved
    conflicts = await find_conflicts(b["room_id"], b["date"], b["start_time"], b["end_time"],
                                     [STATUS_DISETUJUI], exclude_id=b["_id"])
    if conflicts:
        raise HTTPException(409, f"Bentrok dengan {conflicts[0]['code']} yang sudah disetujui")
    await db.bookings.update_one({"_id": booking_id}, {"$set": {
        "status": STATUS_DISETUJUI,
        "approved_by": user["email"],
        "approved_at": now_utc(),
    }})
    updated = await db.bookings.find_one({"_id": booking_id})
    await broadcast_event({"type": "booking_updated", "booking": sanitize_booking(updated)})
    await notify_role("tata_usaha", f"Pengajuan {b['code']} disetujui", "booking_approved", booking_id)

    # Auto-reject any other MENUNGGU bookings that overlap the same room+date,
    # with a smart Indonesian message including alternative slot suggestions.
    overlapping = await find_conflicts(
        updated["room_id"], updated["date"], updated["start_time"], updated["end_time"],
        [STATUS_MENUNGGU], exclude_id=updated["_id"],
    )
    for ov in overlapping:
        result = await build_layer2_rejection_message(ov, updated)
        await db.bookings.update_one({"_id": ov["_id"]}, {"$set": {
            "status": STATUS_DITOLAK,
            "approved_by": user["email"],
            "approved_at": now_utc(),
            "rejection_reason": result["message"],
            "alternatives": result["alternatives"],
            "auto_rejected": True,
        }})
        rejected_doc = await db.bookings.find_one({"_id": ov["_id"]})
        await broadcast_event({"type": "booking_updated", "booking": sanitize_booking(rejected_doc)})

    return sanitize_booking(updated)

@api.post("/bookings/{booking_id}/reject")
async def reject_booking(booking_id: str, body: ApproveBody, user: dict = Depends(require_role("kepala_labor", "admin"))):
    b = await db.bookings.find_one({"_id": booking_id})
    if not b: raise HTTPException(404, "Tidak ditemukan")
    if b["status"] != STATUS_MENUNGGU:
        raise HTTPException(400, "Status bukan menunggu")
    await db.bookings.update_one({"_id": booking_id}, {"$set": {
        "status": STATUS_DITOLAK,
        "approved_by": user["email"],
        "approved_at": now_utc(),
        "rejection_reason": body.reason or "",
    }})
    updated = await db.bookings.find_one({"_id": booking_id})
    await broadcast_event({"type": "booking_updated", "booking": sanitize_booking(updated)})
    return sanitize_booking(updated)

class RescheduleBody(BaseModel):
    room_id: str
    date: str
    start_time: str
    end_time: str
    reason: str

@api.post("/bookings/{booking_id}/reschedule")
async def reschedule_booking(booking_id: str, body: RescheduleBody, user: dict = Depends(require_role("tata_usaha", "admin"))):
    b = await db.bookings.find_one({"_id": booking_id})
    if not b: raise HTTPException(404, "Tidak ditemukan")
    if b["status"] != STATUS_DISETUJUI:
        raise HTTPException(400, "Hanya jadwal yang sudah disetujui yang dapat diubah oleh TU")
    if time_to_min(body.start_time) >= time_to_min(body.end_time):
        raise HTTPException(400, "Jam mulai harus lebih awal dari jam selesai")
    s = await get_settings()
    await check_operating_hours(s, body.date, body.start_time, body.end_time)
    conflicts = await find_conflicts(body.room_id, body.date, body.start_time, body.end_time,
                                     [STATUS_DISETUJUI], exclude_id=booking_id)
    if conflicts:
        raise HTTPException(409, f"Bentrok dengan {conflicts[0]['code']}")
    room = await db.rooms.find_one({"_id": body.room_id})
    if not room: raise HTTPException(400, "Ruangan tidak valid")
    log = {
        "at": now_utc().isoformat(),
        "by": user["email"],
        "reason": body.reason,
        "from": {"room_id": b["room_id"], "room_name": b["room_name"], "date": b["date"],
                 "start": b["start_time"], "end": b["end_time"]},
        "to": {"room_id": body.room_id, "room_name": room["name"], "date": body.date,
               "start": body.start_time, "end": body.end_time},
    }
    await db.bookings.update_one({"_id": booking_id}, {
        "$set": {"room_id": body.room_id, "room_name": room["name"], "date": body.date,
                 "start_time": body.start_time, "end_time": body.end_time},
        "$push": {"reschedule_logs": log},
    })
    updated = await db.bookings.find_one({"_id": booking_id})
    await broadcast_event({"type": "booking_updated", "booking": sanitize_booking(updated)})

    # Notify Kepala Labor about the reschedule so they know their previously-
    # approved slot has been moved by Tata Usaha.
    msg = (f"Jadwal {b['code']} ({b['nama']}) diubah oleh TU: "
           f"{b['room_name']} {b['date']} {b['start_time']}–{b['end_time']} "
           f"→ {room['name']} {body.date} {body.start_time}–{body.end_time}")
    await notify_role("kepala_labor", msg, "booking_rescheduled", booking_id)

    return sanitize_booking(updated)

# --------------------------- Reports Export ---------------------------
async def _filtered_bookings(status, room_id, date_from, date_to, kelas):
    q: Dict[str, Any] = {}
    if status: q["status"] = status
    if room_id: q["room_id"] = room_id
    if kelas: q["kelas"] = kelas
    if date_from or date_to:
        q["date"] = {}
        if date_from: q["date"]["$gte"] = date_from
        if date_to: q["date"]["$lte"] = date_to
    return await db.bookings.find(q).sort([("date", 1), ("start_time", 1)]).to_list(5000)

@api.get("/reports/export.xlsx")
async def export_excel(
    status: Optional[str] = None, room_id: Optional[str] = None,
    date_from: Optional[str] = None, date_to: Optional[str] = None,
    kelas: Optional[str] = None,
    user: dict = Depends(require_role("tata_usaha", "admin")),
):
    rows = await _filtered_bookings(status, room_id, date_from, date_to, kelas)
    wb = Workbook()
    ws = wb.active
    ws.title = "Laporan"
    ws.append(["Kode", "Tanggal", "Jam Mulai", "Jam Selesai", "Ruangan", "Nama", "NIM", "Kelas", "Peserta", "Keperluan", "Status"])
    for r in rows:
        ws.append([r["code"], r["date"], r["start_time"], r["end_time"], r["room_name"],
                   r["nama"], r["nim"], r["kelas"], r["participants"], r["purpose"], r["status"]])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=laporan-labor.xlsx"})

@api.get("/reports/export.pdf")
async def export_pdf(
    status: Optional[str] = None, room_id: Optional[str] = None,
    date_from: Optional[str] = None, date_to: Optional[str] = None,
    kelas: Optional[str] = None,
    user: dict = Depends(require_role("tata_usaha", "admin")),
):
    rows = await _filtered_bookings(status, room_id, date_from, date_to, kelas)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4))
    styles = getSampleStyleSheet()
    story = [Paragraph("Laporan Pemesanan Ruangan Laboratorium — FH UNRI", styles["Title"]), Spacer(1, 12)]
    data = [["Kode", "Tanggal", "Jam", "Ruangan", "Nama", "NIM", "Kelas", "Keperluan", "Status"]]
    for r in rows:
        data.append([r["code"], r["date"], f"{r['start_time']}–{r['end_time']}",
                     r["room_name"], r["nama"], r["nim"], r["kelas"],
                     (r["purpose"] or "")[:40], r["status"]])
    t = Table(data, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#09090b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ]))
    story.append(t)
    doc.build(story)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": "attachment; filename=laporan-labor.pdf"})

# --------------------------- Notifications ---------------------------
async def notify_role(role: str, message: str, ntype: str, ref_id: Optional[str] = None):
    users = await db.users.find({"role": role}).to_list(200)
    now = now_utc()
    docs = [{
        "_id": str(uuid.uuid4()),
        "user_id": u["_id"],
        "message": message,
        "type": ntype,
        "ref_id": ref_id,
        "read": False,
        "created_at": now,
    } for u in users]
    if docs:
        await db.notifications.insert_many(docs)

@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    rows = await db.notifications.find({"user_id": user["_id"]}).sort("created_at", -1).limit(50).to_list(50)
    return [{
        "id": r["_id"], "message": r["message"], "type": r["type"],
        "ref_id": r.get("ref_id"), "read": r.get("read", False),
        "created_at": r["created_at"].isoformat(),
    } for r in rows]

@api.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["_id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}

# --------------------------- Kiosk ---------------------------
@api.get("/kiosk/verify")
async def kiosk_verify(token: str):
    s = await get_settings()
    if not s.get("kiosk_token") or s["kiosk_token"] != token:
        raise HTTPException(401, "Token kiosk tidak valid")
    return {"ok": True}

# --------------------------- WebSocket ---------------------------
class WSHub:
    def __init__(self):
        self.clients: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.clients.add(ws)

    def disconnect(self, ws: WebSocket):
        self.clients.discard(ws)

    async def broadcast(self, payload: dict):
        dead = []
        text = json.dumps(payload, default=str)
        for ws in list(self.clients):
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.clients.discard(ws)

hub = WSHub()

async def broadcast_event(payload: dict):
    await hub.broadcast(payload)

@app.websocket("/api/ws")
async def ws_endpoint(websocket: WebSocket):
    await hub.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(websocket)
    except Exception:
        hub.disconnect(websocket)

# --------------------------- Background Expiry & Reminders ---------------------------
async def background_expiry_loop():
    while True:
        try:
            now = datetime.now()
            today_str = now.date().isoformat()
            cur_time = now.strftime("%H:%M")
            # auto-expire: menunggu whose event time has passed
            await db.bookings.update_many({
                "status": STATUS_MENUNGGU,
                "$or": [
                    {"date": {"$lt": today_str}},
                    {"date": today_str, "start_time": {"$lt": cur_time}},
                ]
            }, {"$set": {"status": STATUS_KEDALUWARSA, "expired_at": now_utc()}})

            # SLA reminders (send once)
            s = await get_settings()
            sla_days = int(s.get("sla_days", 2))
            cutoff = now_utc() - timedelta(days=sla_days)
            stale = await db.bookings.find({
                "status": STATUS_MENUNGGU,
                "created_at": {"$lt": cutoff},
                "sla_reminded": {"$ne": True},
            }).to_list(200)
            for b in stale:
                await notify_role("kepala_labor",
                    f"Reminder: pengajuan {b['code']} sudah {sla_days}+ hari belum diproses",
                    "sla_reminder", b["_id"])
                await db.bookings.update_one({"_id": b["_id"]}, {"$set": {"sla_reminded": True}})
        except Exception as e:
            logger.exception("expiry loop error: %s", e)
        await asyncio.sleep(60)

# --------------------------- Health ---------------------------
@api.get("/")
async def root():
    return {"ok": True, "app": "sistem-pemesanan-labor-fh-unri"}

# --------------------------- Mount ---------------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
