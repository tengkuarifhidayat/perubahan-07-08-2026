import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useBookingSocket } from "@/lib/ws";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";

const TYPE_LABEL = {
  booking_new: "Pengajuan baru",
  booking_approved: "Disetujui",
  booking_cancelled: "Dibatalkan",
  booking_rescheduled: "Reschedule TU",
  sla_reminder: "Reminder SLA",
};

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get("/notifications");
      setItems(data);
    } catch (e) { console.warn("load notif", e); }
  };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  useBookingSocket(() => load());

  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    try { await api.post("/notifications/read-all"); load(); } catch (e) { console.warn(e); }
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        data-testid="notif-bell"
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-sm hover:bg-zinc-100"
        aria-label="Notifikasi"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span
            data-testid="notif-badge"
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-600 rounded-full leading-none"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notif-dropdown"
          className="absolute right-0 mt-2 w-[380px] bg-white border border-zinc-200 shadow-lg rounded-sm z-50"
        >
          <div className="flex items-center justify-between p-3 border-b border-zinc-200">
            <div className="font-heading text-sm">Notifikasi</div>
            {unread > 0 && (
              <button
                data-testid="notif-mark-read"
                onClick={markAllRead}
                className="text-xs text-zinc-600 hover:text-zinc-900 underline"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-auto">
            {items.length === 0 && (
              <div className="p-6 text-center text-sm text-zinc-500">Tidak ada notifikasi.</div>
            )}
            {items.map((n) => (
              <Link
                key={n.id}
                to={n.ref_id ? `/dasbor/kepala-labor` : "#"}
                onClick={() => setOpen(false)}
                data-testid={`notif-item-${n.id}`}
                className={`block p-3 border-b border-zinc-100 hover:bg-zinc-50 transition-colors ${
                  !n.read ? "bg-blue-50/50" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 inline-block w-2 h-2 bg-blue-600 rounded-full shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                      {TYPE_LABEL[n.type] || n.type}
                    </div>
                    <div className="text-sm text-zinc-800 mt-0.5 leading-snug break-words">{n.message}</div>
                    <div className="text-[11px] text-zinc-400 mt-1">
                      {new Date(n.created_at).toLocaleString("id-ID", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
