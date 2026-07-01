import { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import StaffNav from "@/components/StaffNav";
import StatusPill, { RoomChip } from "@/components/StatusPill";
import { useBookingSocket } from "@/lib/ws";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function ymd(d) {
  // Use LOCAL date parts — toISOString() converts to UTC which shifts the
  // day for users in non-UTC timezones (e.g. WIB UTC+7), causing bookings
  // to render one column off in the grid.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function daysInMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }

export default function TataUsahaDashboard() {
  const [cursor, setCursor] = useState(startOfMonth(new Date()));
  const [bookings, setBookings] = useState([]);
  const [selectedDay, setSelectedDay] = useState(ymd(new Date()));
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const first = ymd(startOfMonth(cursor));
    const last = ymd(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
    const { data } = await api.get("/bookings/calendar", { params: { date_from: first, date_to: last } });
    setBookings(data);
  };
  useEffect(() => { load(); }, [cursor]); // eslint-disable-line
  useBookingSocket(() => load());

  const grouped = useMemo(() => {
    const m = {};
    for (const b of bookings) { (m[b.date] = m[b.date] || []).push(b); }
    return m;
  }, [bookings]);

  const days = daysInMonth(cursor);
  const firstWeekday = (startOfMonth(cursor).getDay() + 6) % 7; // Mon=0
  const monthName = cursor.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const daySelectedList = grouped[selectedDay] || [];

  return (
    <div className="min-h-screen bg-zinc-50">
      <StaffNav />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="label-eyebrow">TATA USAHA</div>
        <h1 className="font-display text-3xl mt-1">Kalender Jadwal Ruangan</h1>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-sm">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200">
              <div className="font-heading capitalize text-lg">{monthName}</div>
              <div className="flex gap-1">
                <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                  data-testid="cal-prev" className="p-1.5 border border-zinc-300 rounded-sm hover:bg-zinc-50">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => { const d = new Date(); setCursor(startOfMonth(d)); setSelectedDay(ymd(d)); }}
                  data-testid="cal-today" className="px-3 text-sm border border-zinc-300 rounded-sm hover:bg-zinc-50">Hari ini</button>
                <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                  data-testid="cal-next" className="p-1.5 border border-zinc-300 rounded-sm hover:bg-zinc-50">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 border-b border-zinc-200 text-xs label-eyebrow">
              {["Sen","Sel","Rab","Kam","Jum","Sab","Min"].map((d) => (
                <div key={d} className="p-2 text-center border-r last:border-r-0 border-zinc-100">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <div key={`e-${i}`} className="h-24 border-r border-b border-zinc-100 bg-zinc-50/50" />
              ))}
              {Array.from({ length: days }).map((_, i) => {
                const d = new Date(cursor.getFullYear(), cursor.getMonth(), i + 1);
                const key = ymd(d);
                const list = grouped[key] || [];
                const isToday = key === ymd(new Date());
                const isSel = key === selectedDay;
                return (
                  <button key={key} onClick={() => setSelectedDay(key)}
                    data-testid={`day-${key}`}
                    className={`text-left h-24 p-1.5 border-r border-b border-zinc-100 hover:bg-zinc-50 transition-colors ${isSel ? "bg-zinc-100" : ""}`}>
                    <div className={`text-xs font-medium ${isToday ? "text-white bg-zinc-900 rounded-full w-6 h-6 inline-flex items-center justify-center" : "text-zinc-700"}`}>{i + 1}</div>
                    <div className="mt-1 space-y-0.5">
                      {list.slice(0, 2).map((b) => (
                        <div key={b.id} className={`text-[10px] px-1 py-0.5 truncate ${b.room_id === "labor-2" ? "room-labor-2" : "room-labor-1"} ${b.status === "menunggu" ? "opacity-60" : ""}`}>
                          {b.start_time} {b.room_name.replace("Labor ", "L")}
                        </div>
                      ))}
                      {list.length > 2 && <div className="text-[10px] text-zinc-500">+{list.length - 2} lagi</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 bg-white border border-zinc-200 rounded-sm p-5">
            <div className="label-eyebrow">DETAIL HARI</div>
            <div className="font-heading text-lg mt-1">{selectedDay}</div>
            <div className="mt-4 space-y-2 max-h-[500px] overflow-auto" data-testid="day-detail-list">
              {daySelectedList.length === 0 && <div className="text-sm text-zinc-500">Tidak ada jadwal.</div>}
              {daySelectedList.map((b) => (
                <div key={b.id} className="border border-zinc-200 p-3 rounded-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-zinc-500">{b.code}</span>
                    <StatusPill status={b.status} />
                  </div>
                  <div className="font-medium text-sm mt-1">{b.purpose}</div>
                  <div className="text-xs text-zinc-600 mt-1 flex items-center gap-2 flex-wrap">
                    <RoomChip roomId={b.room_id} roomName={b.room_name} />
                    <span>{b.start_time}–{b.end_time}</span>
                    <span>· {b.nama} ({b.kelas})</span>
                  </div>
                  {b.status === "disetujui" && (
                    <button data-testid={`reschedule-${b.code}`} onClick={() => setEditing(b)}
                      className="mt-2 text-xs px-2 py-1 border border-zinc-300 rounded-sm inline-flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Reschedule
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {editing && <RescheduleModal booking={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function RescheduleModal({ booking, onClose, onDone }) {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState({
    room_id: booking.room_id, date: booking.date,
    start_time: booking.start_time, end_time: booking.end_time, reason: "",
  });
  useEffect(() => { api.get("/rooms").then((r) => setRooms(r.data.filter((x) => x.active))); }, []);
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/bookings/${booking.id}/reschedule`, form);
      toast.success("Jadwal diubah");
      onDone();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white p-8 rounded-sm max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-heading text-xl">Reschedule · {booking.code}</h3>
        <p className="text-xs text-zinc-500 mt-1">Perubahan akan tercatat di log audit.</p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <select className="input" value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input type="time" className="input" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            <input type="time" className="input" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          </div>
          <textarea required className="input" placeholder="Alasan perubahan (wajib)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-zinc-300 text-sm rounded-sm">Batal</button>
            <button data-testid="reschedule-save" className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-sm">Simpan</button>
          </div>
        </form>
        <style>{`.input { width:100%; padding:0.55rem 0.7rem; border:1px solid #e4e4e7; border-radius:0.125rem; font-size:0.9rem; }`}</style>
      </div>
    </div>
  );
}
