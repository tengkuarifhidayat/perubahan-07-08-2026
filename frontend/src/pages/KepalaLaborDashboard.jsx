import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import StaffNav from "@/components/StaffNav";
import StatusPill, { RoomChip } from "@/components/StatusPill";
import { useBookingSocket } from "@/lib/ws";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
function fmtSubmitted(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const jam = String(d.getHours()).padStart(2, "0");
  const menit = String(d.getMinutes()).padStart(2, "0");
  return `Diajukan pada ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()} pukul ${jam}.${menit}`;
}

export default function KepalaLaborDashboard() {
  const [tab, setTab] = useState("menunggu");
  const [bookings, setBookings] = useState([]);
  const [rejectFor, setRejectFor] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    try {
      const { data } = await api.get("/bookings", { params: { status: tab } });
      setBookings(data);
    } catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, [tab]); // eslint-disable-line
  useBookingSocket(() => load());

  const approve = async (b) => {
    try {
      await api.post(`/bookings/${b.id}/approve`);
      toast.success(`${b.code} disetujui`);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const reject = async () => {
    try {
      await api.post(`/bookings/${rejectFor.id}/reject`, { reason: rejectReason });
      toast.success("Pengajuan ditolak");
      setRejectFor(null); setRejectReason(""); load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const tabs = [
    { id: "menunggu", label: "Menunggu" },
    { id: "disetujui", label: "Disetujui" },
    { id: "ditolak", label: "Ditolak" },
    { id: "kedaluwarsa", label: "Kedaluwarsa" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      <StaffNav />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="label-eyebrow">KEPALA LABOR</div>
        <h1 className="font-display text-3xl mt-1">Persetujuan Pengajuan</h1>

        <div className="mt-6 flex gap-1 border-b border-zinc-200" data-testid="tabs">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              data-testid={`tab-${t.id}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                tab === t.id ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900"
              }`}>{t.label}</button>
          ))}
        </div>

        <div className="mt-6 space-y-3" data-testid="booking-list">
          {bookings.length === 0 && (
            <div className="text-center text-zinc-500 py-16 border border-dashed border-zinc-300 rounded-sm">
              Tidak ada pengajuan.
            </div>
          )}
          {bookings.map((b) => (
            <div key={b.id} className="bg-white border border-zinc-200 p-5 rounded-sm card-hover" data-testid={`row-${b.code}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[280px]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-zinc-500">{b.code}</span>
                    <StatusPill status={b.status} />
                  </div>
                  <div className="font-heading mt-1">{b.purpose}</div>
                  <div className="text-sm text-zinc-600 mt-1">
                    <b>{b.nama}</b> · NIM {b.nim} · Kelas {b.kelas} · {b.participants} peserta
                  </div>
                  <div className="mt-2 flex gap-2 flex-wrap items-center text-xs">
                    <RoomChip roomId={b.room_id} roomName={b.room_name} />
                    <span className="px-2 py-0.5 border border-zinc-200 rounded-sm">
                      {b.date} · {b.start_time}–{b.end_time}
                    </span>
                  </div>
                  {fmtSubmitted(b.created_at) && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500" data-testid={`submitted-${b.code}`}>
                      <Clock className="w-3.5 h-3.5" /> {fmtSubmitted(b.created_at)}
                    </div>
                  )}
                </div>
                {tab === "menunggu" && (
                  <div className="flex gap-2">
                    <button onClick={() => approve(b)} data-testid={`approve-${b.code}`}
                      className="px-3 py-2 bg-emerald-600 text-white text-sm rounded-sm inline-flex items-center gap-1 hover:bg-emerald-700">
                      <CheckCircle2 className="w-4 h-4" /> Setujui
                    </button>
                    <button onClick={() => setRejectFor(b)} data-testid={`reject-${b.code}`}
                      className="px-3 py-2 border border-red-300 text-red-700 text-sm rounded-sm inline-flex items-center gap-1 hover:bg-red-50">
                      <XCircle className="w-4 h-4" /> Tolak
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {rejectFor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setRejectFor(null)}>
          <div className="bg-white p-8 rounded-sm max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-xl">Tolak Pengajuan {rejectFor.code}</h3>
            <textarea data-testid="reject-reason" className="mt-4 w-full border border-zinc-300 rounded-sm p-3 text-sm min-h-[100px]"
              placeholder="Alasan penolakan (opsional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setRejectFor(null)} className="px-4 py-2 border border-zinc-300 text-sm rounded-sm">Batal</button>
              <button data-testid="reject-confirm" onClick={reject} className="px-4 py-2 bg-red-600 text-white text-sm rounded-sm">Tolak</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
