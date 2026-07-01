import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useBookingSocket } from "@/lib/ws";

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function daysInMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }

export default function KioskTV() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [ok, setOk] = useState(null);
  const [now, setNow] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!token) { setOk(false); return; }
    api.get("/kiosk/verify", { params: { token } }).then(() => setOk(true)).catch(() => setOk(false));
  }, [token]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  const cursor = startOfMonth(now);
  const load = async () => {
    const first = ymd(cursor);
    const last = ymd(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
    const { data } = await api.get("/bookings/calendar", { params: { date_from: first, date_to: last } });
    setBookings(data);
    setLive(true); setTimeout(() => setLive(false), 800);
  };
  useEffect(() => { if (ok) load(); }, [ok, cursor.getMonth()]); // eslint-disable-line
  useBookingSocket(() => ok && load());

  const grouped = useMemo(() => {
    const m = {};
    for (const b of bookings) (m[b.date] = m[b.date] || []).push(b);
    return m;
  }, [bookings]);

  if (ok === null) return <div className="kiosk flex items-center justify-center text-3xl">Memverifikasi token…</div>;
  if (!ok) return <div className="kiosk flex items-center justify-center text-3xl">Token tidak valid.</div>;

  const firstWeekday = (startOfMonth(cursor).getDay() + 6) % 7;
  const totalDays = daysInMonth(cursor);
  const today = ymd(new Date());
  const monthName = cursor.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const todayList = grouped[today] || [];

  return (
    <div className="kiosk px-8 py-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl uppercase tracking-widest text-zinc-400">FH UNRI · Jadwal Ruangan Labor</div>
          <div className="font-display text-6xl mt-1 capitalize">{monthName}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl text-zinc-400">{now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}</div>
          <div className="font-display text-6xl mt-1">{now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
          <div className="mt-2 inline-flex items-center gap-2 text-lg text-emerald-400">
            <span className="live-dot" style={{ background: live ? "#22c55e" : "#4ade80" }}></span> LIVE
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-12 gap-6">
        <div className="col-span-8">
          <div className="grid grid-cols-7 text-lg font-bold text-zinc-500">
            {["Sen","Sel","Rab","Kam","Jum","Sab","Min"].map((d) => <div key={d} className="p-2 border-b border-zinc-800">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e${i}`} className="h-28 border-b border-r border-zinc-800/50 bg-zinc-950" />)}
            {Array.from({ length: totalDays }).map((_, i) => {
              const d = new Date(cursor.getFullYear(), cursor.getMonth(), i + 1);
              const key = ymd(d);
              const list = grouped[key] || [];
              const isToday = key === today;
              return (
                <div key={key} className={`h-28 p-2 border-b border-r border-zinc-800/50 ${isToday ? "bg-zinc-800 ring-4 ring-emerald-500" : ""}`}>
                  <div className={`text-2xl font-bold ${isToday ? "text-emerald-400" : "text-zinc-300"}`}>{i + 1}</div>
                  <div className="mt-1 space-y-0.5">
                    {list.slice(0, 2).map((b) => (
                      <div key={b.id} className={`text-xs px-1 truncate ${b.room_id === "labor-2" ? "room-labor-2" : "room-labor-1"} ${b.status === "menunggu" ? "opacity-60" : ""}`}>
                        {b.start_time} {b.room_name}
                      </div>
                    ))}
                    {list.length > 2 && <div className="text-xs text-zinc-500">+{list.length - 2}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="col-span-4">
          <div className="uppercase tracking-widest text-xl text-zinc-400">Hari Ini · {today}</div>
          <div className="mt-3 space-y-3 max-h-[70vh] overflow-hidden">
            {todayList.length === 0 && <div className="text-2xl text-zinc-500 border-2 border-dashed border-zinc-800 p-8 text-center">Tidak ada jadwal</div>}
            {todayList.map((b) => (
              <div key={b.id} className={`${b.room_id === "labor-2" ? "room-labor-2" : "room-labor-1"} p-4`}>
                <div className="font-display text-4xl">{b.start_time}–{b.end_time}</div>
                <div className="text-2xl font-bold mt-1">{b.room_name}</div>
                <div className="text-lg mt-1 text-zinc-200">{b.purpose}</div>
                <div className="text-base text-zinc-300 mt-1">{b.nama} · {b.kelas} · {b.participants} orang</div>
                {b.status === "menunggu" && <div className="mt-2 inline-block bg-yellow-500/20 text-yellow-300 px-2 py-0.5 text-sm">MENUNGGU</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
