import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useBookingSocket } from "@/lib/ws";
import { CalendarDays, LayoutList, Pause, Play } from "lucide-react";

// Asymmetric auto-cycle durations (ms)
const CYCLE = { today: 60000, month: 30000 };

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function daysInMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }

// Slow automatic vertical scroll for overflowing content (TV displays)
function useAutoScroll(enabled, dep) {
  const ref = useRef(null);
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    let raf;
    let dir = 1;
    let pos = 0;
    let pauseUntil = Date.now() + 2500; // hold at top briefly before scrolling
    const step = () => {
      const max = el.scrollHeight - el.clientHeight;
      if (max > 4) {
        const t = Date.now();
        if (t >= pauseUntil) {
          pos += dir * 0.5; // ~30px/s — slow, readable
          if (pos >= max) { pos = max; dir = -1; pauseUntil = t + 3000; }
          else if (pos <= 0) { pos = 0; dir = 1; pauseUntil = t + 3000; }
          el.scrollTop = pos;
        }
      } else {
        pos = 0;
        el.scrollTop = 0;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [enabled, dep]); // eslint-disable-line
  return ref;
}

export default function KioskTV() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const modeParam = params.get("mode"); // 'auto' | 'static' | null(manual)
  const isAuto = modeParam === "auto";
  const isStatic = modeParam === "static";
  const [ok, setOk] = useState(null);
  const [now, setNow] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [live, setLive] = useState(false);
  const [mode, setMode] = useState("today"); // 'today' | 'month'
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!token) { setOk(false); return; }
    api.get("/kiosk/verify", { params: { token } }).then(() => setOk(true)).catch(() => setOk(false));
  }, [token]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  // static monitor always stays on 'Hari Ini'
  useEffect(() => { if (isStatic) setMode("today"); }, [isStatic]);

  // asymmetric auto-cycle (only for ?mode=auto and when not paused)
  useEffect(() => {
    if (!isAuto || paused) return;
    const dur = CYCLE[mode] || CYCLE.today;
    const t = setTimeout(() => setMode((m) => (m === "today" ? "month" : "today")), dur);
    return () => clearTimeout(t);
  }, [isAuto, paused, mode]);

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

  return (
    <div className="kiosk px-8 py-6 h-screen flex flex-col overflow-hidden" data-testid="kiosk-root" data-mode={isAuto ? "auto" : isStatic ? "static" : "manual"}>
      <div className="flex items-center justify-between shrink-0">
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

          {!isStatic && (
            <div className="mt-4 inline-flex items-center gap-2 justify-end">
              <div className="inline-flex bg-zinc-900 border border-zinc-700 rounded-sm p-1" data-testid="kiosk-mode-toggle">
                <button
                  data-testid="mode-today"
                  onClick={() => setMode("today")}
                  className={`px-4 py-2 text-lg font-bold inline-flex items-center gap-2 ${mode === "today" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}
                >
                  <LayoutList className="w-5 h-5" /> Hari Ini
                </button>
                <button
                  data-testid="mode-month"
                  onClick={() => setMode("month")}
                  className={`px-4 py-2 text-lg font-bold inline-flex items-center gap-2 ${mode === "month" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}
                >
                  <CalendarDays className="w-5 h-5" /> Bulanan
                </button>
              </div>
              {isAuto && (
                <button
                  data-testid="kiosk-pause"
                  onClick={() => setPaused((p) => !p)}
                  className="px-4 py-2 text-lg font-bold inline-flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-sm text-white hover:bg-zinc-800"
                >
                  {paused ? <><Play className="w-5 h-5" /> Lanjut</> : <><Pause className="w-5 h-5" /> Jeda</>}
                </button>
              )}
            </div>
          )}
          {isAuto && (
            <div className="mt-2 text-base text-zinc-500 uppercase tracking-widest" data-testid="kiosk-auto-badge">
              Auto · {paused ? "Dijeda" : mode === "today" ? "Hari Ini 60 detik" : "Bulanan 30 detik"}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-6">
        {mode === "today" ? (
          <TodayView now={now} grouped={grouped} autoScroll={isAuto || isStatic} />
        ) : (
          <MonthView cursor={cursor} grouped={grouped} today={today} firstWeekday={firstWeekday} totalDays={totalDays} />
        )}
      </div>
    </div>
  );
}

function roomAccent(roomId) {
  if (roomId === "labor-1") return "#38BDF8";
  if (roomId === "labor-2") return "#A855F7";
  // deterministic fallback color for future rooms (labor-3, dst.)
  const palette = ["#34D399", "#FBBF24", "#F472B6", "#22D3EE", "#F87171"];
  let h = 0;
  for (const c of String(roomId)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

function StatusBadge({ status, size }) {
  const cls = status === "disetujui"
    ? "bg-emerald-400 text-black"
    : "bg-amber-400 text-black";
  const label = status === "disetujui" ? "DISETUJUI" : "MENUNGGU";
  return (
    <span className={`inline-block font-bold tracking-wider ${cls} ${size} px-3 py-1 rounded-sm`} data-testid={`status-${status}`}>
      {label}
    </span>
  );
}

function BoardRow({ b, rowText, badgeSize }) {
  return (
    <div className="grid grid-cols-[1.3fr_1.4fr_2.2fr_1.1fr] items-center gap-4 py-3.5 border-b border-zinc-800/80" data-testid={`board-row-${b.code}`}>
      <div className={`flex items-center gap-3 font-bold text-white ${rowText}`}>
        <span className="inline-block w-1.5 self-stretch rounded" style={{ background: roomAccent(b.room_id), minHeight: "1.6em" }} />
        <span className="truncate">{b.room_name}</span>
      </div>
      <div className={`text-amber-300 tabular-nums ${rowText}`}>{b.start_time}<span className="text-zinc-500 mx-1.5">–</span>{b.end_time}</div>
      <div className={`text-zinc-100 truncate ${rowText}`}>{b.nama} <span className="text-zinc-500">({b.kelas})</span></div>
      <div><StatusBadge status={b.status} size={badgeSize} /></div>
    </div>
  );
}

function TodayView({ now, grouped, autoScroll }) {
  const todayKey = ymd(now);
  const tmr = new Date(now); tmr.setDate(tmr.getDate() + 1);
  const tmrKey = ymd(tmr);
  const todayList = grouped[todayKey] || [];
  const tmrList = grouped[tmrKey] || [];

  // Font scaling for legibility from ~2m — shrinks as rows grow so all fit.
  const n = todayList.length;
  const density = n <= 5 ? "lg" : n <= 9 ? "md" : "sm";
  const rowText = { lg: "text-3xl", md: "text-2xl", sm: "text-xl" }[density];
  const badgeSize = { lg: "text-xl", md: "text-lg", sm: "text-base" }[density];
  const headText = { lg: "text-xl", md: "text-lg", sm: "text-base" }[density];

  const scrollRef = useAutoScroll(autoScroll, n);

  return (
    <div className="h-full flex flex-col font-mono" data-testid="today-view">
      <div className="uppercase tracking-[0.25em] text-2xl text-amber-300 mb-4 shrink-0">Jadwal Hari Ini</div>

      {/* Board column header */}
      <div className="grid grid-cols-[1.3fr_1.4fr_2.2fr_1.1fr] gap-4 pb-2.5 border-b-2 border-amber-400/70 shrink-0 uppercase tracking-widest text-zinc-400" data-testid="board-header">
        <div className={headText}>Ruangan</div>
        <div className={headText}>Jam</div>
        <div className={headText}>Pemesan (Kelas)</div>
        <div className={headText}>Status</div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-hidden" data-testid="today-scroll">
        {todayList.length === 0 ? (
          <div className="text-3xl text-zinc-500 border-2 border-dashed border-zinc-800 p-12 text-center mt-4" data-testid="today-empty">
            Tidak ada jadwal hari ini
          </div>
        ) : (
          <div>
            {todayList.map((b) => (
              <BoardRow key={b.id} b={b} rowText={rowText} badgeSize={badgeSize} />
            ))}
          </div>
        )}

        {tmrList.length > 0 && (
          <>
            <div className="uppercase tracking-[0.25em] text-lg text-zinc-500 mt-10 mb-3">Jadwal Besok</div>
            <div className="opacity-75">
              {tmrList.map((b) => (
                <BoardRow key={b.id} b={b} rowText="text-xl" badgeSize="text-sm" />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


function MonthView({ cursor, grouped, today, firstWeekday, totalDays }) {
  return (
    <div className="h-full grid grid-cols-12 gap-6" data-testid="month-view">
        <div className="col-span-8">
          <div className="grid grid-cols-7 text-lg font-bold text-zinc-500">
            {["Sen","Sel","Rab","Kam","Jum","Sab","Min"].map((d) => <div key={d} className="p-2 border-b border-zinc-800">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e${i}`} className="h-28 border-b border-r border-zinc-800/50 bg-zinc-950" />)}
            {Array.from({ length: totalDays }).map((_, i) => {
              const d = new Date(cursor.getFullYear(), cursor.getMonth(), i + 1);
              const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
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
            {(grouped[today] || []).length === 0 && <div className="text-2xl text-zinc-500 border-2 border-dashed border-zinc-800 p-8 text-center">Tidak ada jadwal</div>}
            {(grouped[today] || []).map((b) => (
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
  );
}
