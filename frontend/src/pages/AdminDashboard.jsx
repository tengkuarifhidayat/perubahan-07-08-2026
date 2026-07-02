import { useEffect, useMemo, useState } from "react";
import { api, formatApiError, BACKEND_URL } from "@/lib/api";
import { toast } from "sonner";
import StaffNav from "@/components/StaffNav";
import { Copy, RefreshCw, Trash2, Plus } from "lucide-react";

const ROLES = [
  { id: "kepala_labor", label: "Kepala Labor" },
  { id: "tata_usaha", label: "Tata Usaha" },
  { id: "admin", label: "Admin/Dekan" },
];

const WEEKDAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export default function AdminDashboard() {
  const [tab, setTab] = useState("users");
  return (
    <div className="min-h-screen bg-zinc-50">
      <StaffNav />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="label-eyebrow">ADMIN / DEKAN</div>
        <h1 className="font-display text-3xl mt-1">Panel Admin</h1>

        <div className="mt-6 flex gap-1 border-b border-zinc-200">
          {[
            ["users", "Pengguna"],
            ["mahasiswa", "Data Mahasiswa"],
            ["rooms", "Ruangan"],
            ["schedule", "Jam & Libur"],
            ["quota", "Kuota & Rate Limit"],
            ["kiosk", "Kiosk TV"],
          ].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} data-testid={`admin-tab-${id}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                tab === id ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900"
              }`}>{lbl}</button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "users" && <UsersTab />}
          {tab === "mahasiswa" && <MahasiswaTab />}
          {tab === "rooms" && <RoomsTab />}
          {tab === "schedule" && <ScheduleTab />}
          {tab === "quota" && <QuotaTab />}
          {tab === "kiosk" && <KioskTab />}
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "kepala_labor" });
  const load = () => api.get("/users").then((r) => setUsers(r.data));
  useEffect(() => { load(); }, []);
  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/users", form);
      toast.success("Akun dibuat");
      setForm({ email: "", password: "", name: "", role: "kepala_labor" });
      setShowForm(false); load();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const del = async (u) => {
    if (!confirm(`Hapus ${u.email}?`)) return;
    try { await api.delete(`/users/${u.id}`); toast.success("Dihapus"); load(); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="bg-white border border-zinc-200 rounded-sm p-6">
      <div className="flex items-center justify-between">
        <div className="font-heading">Pengguna Staff</div>
        <button data-testid="add-user-btn" onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 bg-zinc-900 text-white text-sm rounded-sm inline-flex items-center gap-1">
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </div>
      {showForm && (
        <form onSubmit={create} className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-zinc-50 border border-zinc-200 rounded-sm" data-testid="user-form">
          <input required data-testid="user-email" placeholder="Email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input required data-testid="user-password" type="password" placeholder="Password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input required data-testid="user-name" placeholder="Nama" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="flex gap-2">
            <select data-testid="user-role" className="input flex-1" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <button data-testid="user-submit" className="px-3 bg-zinc-900 text-white text-sm rounded-sm">Simpan</button>
          </div>
        </form>
      )}
      <table className="mt-4 w-full text-sm">
        <thead className="text-left label-eyebrow">
          <tr><th className="py-2">Email</th><th>Nama</th><th>Role</th><th></th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-zinc-100" data-testid={`user-row-${u.email}`}>
              <td className="py-2">{u.email}</td>
              <td>{u.name}</td>
              <td><span className="pill">{u.role}</span></td>
              <td className="text-right">
                <button onClick={() => del(u)} data-testid={`del-user-${u.email}`} className="text-red-600 text-xs inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Hapus</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <style>{`.input { padding:0.55rem 0.7rem; border:1px solid #e4e4e7; border-radius:0.125rem; font-size:0.85rem; background:white; }`}</style>
    </div>
  );
}

function MahasiswaTab() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = () => api.get("/mahasiswa").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);
  const save = async (m) => {
    try { await api.patch(`/mahasiswa/${m.nim}`, editing); toast.success("Tersimpan"); setEditing(null); load(); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="bg-white border border-zinc-200 rounded-sm p-6">
      <div className="font-heading">Data Mahasiswa (self-input)</div>
      <p className="text-xs text-zinc-500 mt-1">Edit manual jika ada data typo atau duplikat.</p>
      <table className="mt-4 w-full text-sm">
        <thead className="text-left label-eyebrow"><tr><th className="py-2">NIM</th><th>Nama</th><th>Kelas</th><th></th></tr></thead>
        <tbody>
          {list.map((m) => (
            <tr key={m.nim} className="border-t border-zinc-100">
              <td className="py-2 font-mono">{m.nim}</td>
              <td>{editing?.nim === m.nim ? <input className="input" value={editing.nama} onChange={(e) => setEditing({ ...editing, nama: e.target.value })} /> : m.nama}</td>
              <td>{editing?.nim === m.nim ? <input className="input" value={editing.kelas} onChange={(e) => setEditing({ ...editing, kelas: e.target.value })} /> : m.kelas}</td>
              <td className="text-right">
                {editing?.nim === m.nim ? (
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => save(m)} className="text-xs px-2 py-1 bg-zinc-900 text-white rounded-sm">Simpan</button>
                    <button onClick={() => setEditing(null)} className="text-xs px-2 py-1 border border-zinc-300 rounded-sm">Batal</button>
                  </div>
                ) : (
                  <button onClick={() => setEditing({ nim: m.nim, nama: m.nama, kelas: m.kelas })} className="text-xs underline">Edit</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <style>{`.input { padding:0.4rem 0.55rem; border:1px solid #e4e4e7; border-radius:0.125rem; font-size:0.85rem; }`}</style>
    </div>
  );
}

function RoomsTab() {
  const [rooms, setRooms] = useState([]);
  const load = () => api.get("/rooms").then((r) => setRooms(r.data));
  useEffect(() => { load(); }, []);
  const save = async (r, patch) => {
    try { await api.patch(`/rooms/${r.id}`, patch); toast.success("Tersimpan"); load(); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="bg-white border border-zinc-200 rounded-sm p-6">
      <div className="font-heading">Ruangan Laboratorium</div>
      <div className="mt-4 space-y-3">
        {rooms.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border border-zinc-200 p-3 rounded-sm">
            <input defaultValue={r.name} data-testid={`room-name-${r.id}`}
              onBlur={(e) => e.target.value !== r.name && save(r, { name: e.target.value })}
              className="input flex-1" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={r.active} onChange={(e) => save(r, { active: e.target.checked })} /> Aktif
            </label>
          </div>
        ))}
      </div>
      <style>{`.input { padding:0.5rem 0.7rem; border:1px solid #e4e4e7; border-radius:0.125rem; font-size:0.9rem; }`}</style>
    </div>
  );
}

function ScheduleTab() {
  const [s, setS] = useState(null);
  const [newHoliday, setNewHoliday] = useState("");
  const load = () => api.get("/settings").then((r) => setS(r.data));
  useEffect(() => { load(); }, []);
  const save = async (patch) => {
    try { const { data } = await api.patch("/settings", patch); setS(data); toast.success("Tersimpan"); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  if (!s) return null;
  const setDay = (idx, patch) => {
    const oh = { ...s.operating_hours, [String(idx)]: { ...s.operating_hours[String(idx)], ...patch } };
    setS({ ...s, operating_hours: oh });
    save({ operating_hours: oh });
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-zinc-200 rounded-sm p-6">
        <div className="font-heading">Jam Operasional Per Hari</div>
        <div className="mt-4 space-y-2">
          {WEEKDAYS.map((label, idx) => {
            const d = s.operating_hours[String(idx)];
            return (
              <div key={label} className="grid grid-cols-12 items-center gap-2 text-sm">
                <div className="col-span-3">{label}</div>
                <label className="col-span-2 flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={d.open} onChange={(e) => setDay(idx, { open: e.target.checked })} data-testid={`day-open-${idx}`} /> Buka
                </label>
                <input type="time" className="input col-span-3" value={d.start} disabled={!d.open}
                  onChange={(e) => setDay(idx, { start: e.target.value })} />
                <input type="time" className="input col-span-3" value={d.end} disabled={!d.open}
                  onChange={(e) => setDay(idx, { end: e.target.value })} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-white border border-zinc-200 rounded-sm p-6">
        <div className="font-heading">Hari Libur / Cuti</div>
        <div className="mt-3 flex gap-2">
          <input type="date" className="input flex-1" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} data-testid="new-holiday-date" />
          <button data-testid="add-holiday" onClick={() => {
              if (!newHoliday) return;
              const list = [...new Set([...(s.holidays || []), newHoliday])];
              save({ holidays: list }); setNewHoliday("");
            }} className="px-3 bg-zinc-900 text-white text-sm rounded-sm">Tambah</button>
        </div>
        <ul className="mt-4 space-y-1 text-sm">
          {s.holidays.map((h) => (
            <li key={h} className="flex items-center justify-between border-b border-zinc-100 py-1">
              <span>{h}</span>
              <button onClick={() => save({ holidays: s.holidays.filter((x) => x !== h) })} className="text-red-600 text-xs">Hapus</button>
            </li>
          ))}
        </ul>
      </div>
      <style>{`.input { padding:0.4rem 0.55rem; border:1px solid #e4e4e7; border-radius:0.125rem; font-size:0.85rem; background:white; }`}</style>
    </div>
  );
}

function QuotaTab() {
  const [s, setS] = useState(null);
  const load = () => api.get("/settings").then((r) => setS(r.data));
  useEffect(() => { load(); }, []);
  if (!s) return null;
  const save = async (patch) => {
    try { const { data } = await api.patch("/settings", patch); setS(data); toast.success("Tersimpan"); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-zinc-200 rounded-sm p-6 space-y-4">
        <div>
          <div className="font-heading">Batasan Kuota per Kelas</div>
          <label className="flex items-center gap-2 mt-3 text-sm">
            <input type="checkbox" checked={s.quota_enabled} onChange={(e) => save({ quota_enabled: e.target.checked })} data-testid="quota-toggle" /> Aktifkan
          </label>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm">Maks. per minggu:</span>
            <input type="number" min={1} className="input w-24" value={s.quota_per_week}
              onChange={(e) => setS({ ...s, quota_per_week: Number(e.target.value) })}
              onBlur={(e) => save({ quota_per_week: Number(e.target.value) })} data-testid="quota-input" />
          </div>
        </div>
        <div>
          <div className="font-heading">Rate Limit (Anti-Spam)</div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm">Maks. submit / IP / jam:</span>
            <input type="number" min={1} className="input w-24" value={s.rate_limit_per_hour}
              onChange={(e) => setS({ ...s, rate_limit_per_hour: Number(e.target.value) })}
              onBlur={(e) => save({ rate_limit_per_hour: Number(e.target.value) })} data-testid="ratelimit-input" />
          </div>
        </div>
        <div>
          <div className="font-heading">SLA Kepala Labor (hari)</div>
          <div className="mt-3 flex items-center gap-2">
            <input type="number" min={1} className="input w-24" value={s.sla_days}
              onChange={(e) => setS({ ...s, sla_days: Number(e.target.value) })}
              onBlur={(e) => save({ sla_days: Number(e.target.value) })} data-testid="sla-input" />
          </div>
        </div>
        <div>
          <div className="font-heading">Durasi Maksimal Pemesanan</div>
          <label className="flex items-center gap-2 mt-3 text-sm">
            <input type="checkbox" checked={!!s.max_duration_enabled}
              onChange={(e) => save({ max_duration_enabled: e.target.checked })} data-testid="maxduration-toggle" /> Aktifkan
          </label>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm">Maks. durasi (jam):</span>
            <input type="number" min={1} className="input w-24" value={s.max_duration_hours ?? 3}
              disabled={!s.max_duration_enabled}
              onChange={(e) => setS({ ...s, max_duration_hours: Number(e.target.value) })}
              onBlur={(e) => save({ max_duration_hours: Number(e.target.value) })} data-testid="maxduration-input" />
          </div>
          <p className="text-xs text-zinc-500 mt-2">Pengajuan yang melebihi durasi ini akan otomatis ditolak saat submit.</p>
        </div>
        <div>
          <div className="font-heading">Format NIM (Regex)</div>
          <input className="input mt-3 w-full font-mono text-xs" value={s.nim_regex}
            onChange={(e) => setS({ ...s, nim_regex: e.target.value })}
            onBlur={(e) => save({ nim_regex: e.target.value })} data-testid="nim-regex" />
        </div>
      </div>
      <style>{`.input { padding:0.4rem 0.55rem; border:1px solid #e4e4e7; border-radius:0.125rem; font-size:0.85rem; background:white; }`}</style>
    </div>
  );
}

function KioskTab() {
  const [s, setS] = useState(null);
  const load = () => api.get("/settings").then((r) => setS(r.data));
  useEffect(() => { load(); }, []);
  if (!s) return null;
  const url = s.kiosk_token ? `${window.location.origin}/kiosk/tv?token=${s.kiosk_token}` : null;
  const regen = async () => {
    try { const { data } = await api.post("/settings/kiosk-token/regenerate"); setS({ ...s, kiosk_token: data.kiosk_token }); toast.success("Token dibuat ulang"); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  const revoke = async () => {
    if (!confirm("Cabut token?")) return;
    try { await api.post("/settings/kiosk-token/revoke"); setS({ ...s, kiosk_token: null }); toast.success("Token dicabut"); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="bg-white border border-zinc-200 rounded-sm p-6 max-w-2xl">
      <div className="font-heading">Display TV — Token Read-Only</div>
      <p className="text-sm text-zinc-600 mt-2">Buka link ini di layar TV ruang TU. Hanya menampilkan jadwal, tidak ada aksi apapun. Aman meski link diketahui orang lain.</p>
      {url ? (
        <div className="mt-4 p-3 bg-zinc-50 border border-zinc-200 rounded-sm font-mono text-xs break-all" data-testid="kiosk-url">{url}</div>
      ) : (
        <div className="mt-4 text-sm text-zinc-500">Belum ada token aktif.</div>
      )}
      <div className="mt-4 flex gap-2 flex-wrap">
        {url && <button onClick={() => { navigator.clipboard.writeText(url); toast.success("Link disalin"); }}
          data-testid="copy-kiosk-url"
          className="px-3 py-1.5 border border-zinc-300 text-sm rounded-sm inline-flex items-center gap-1"><Copy className="w-4 h-4" /> Salin</button>}
        <button onClick={regen} data-testid="regen-kiosk"
          className="px-3 py-1.5 bg-zinc-900 text-white text-sm rounded-sm inline-flex items-center gap-1"><RefreshCw className="w-4 h-4" /> {s.kiosk_token ? "Generate Ulang" : "Generate"}</button>
        {s.kiosk_token && <button onClick={revoke} data-testid="revoke-kiosk"
          className="px-3 py-1.5 border border-red-300 text-red-700 text-sm rounded-sm inline-flex items-center gap-1"><Trash2 className="w-4 h-4" /> Cabut</button>}
      </div>
    </div>
  );
}
