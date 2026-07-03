import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import StatusPill, { RoomChip } from "@/components/StatusPill";
import { Search, ArrowLeft, X, Pencil, ShieldAlert, RefreshCw } from "lucide-react";

export default function CekStatus() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("code") || params.get("nim") || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  const search = async (e) => {
    e && e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const q = query.trim();
      const isCode = /^LAB-/i.test(q);
      const { data } = await api.get("/bookings/check", { params: isCode ? { code: q } : { nim: q } });
      setResults(data.bookings || []);
      if (!data.bookings?.length) toast("Tidak ada pengajuan ditemukan");
    } catch (err) {
      toast.error(formatApiError(err));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (query) search();
    // eslint-disable-next-line
  }, []);

  const cancel = async (b) => {
    if (!confirm(`Batalkan pengajuan ${b.code}?`)) return;
    try {
      await api.post(`/bookings/public/${b.code}/cancel`);
      toast.success("Pengajuan dibatalkan");
      search();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="civic min-h-screen">
      <div className="max-w-[900px] mx-auto px-6 py-12">
        <Link to="/" className="text-sm text-secondary-ox inline-flex items-center gap-1 hover:text-oxblood transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>
        <div className="label-eyebrow mt-6">Mahasiswa</div>
        <h1 className="font-display text-4xl mt-1.5">Cek Status Pengajuan</h1>
        <span className="title-accent mt-5" />
        <p className="text-secondary-ox mt-5 text-sm">Cari dengan <b className="text-oxblood">Kode Booking</b> (LAB-2026-xxxx) atau <b className="text-oxblood">NIM</b> Anda.</p>

        <form onSubmit={search} className="mt-8 flex flex-col sm:flex-row gap-3" data-testid="check-form">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-oxblood" />
            <input
              data-testid="check-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Contoh: LAB-2026-0042 atau NIM 2010101010"
              className="input-ox pl-11"
            />
          </div>
          <button data-testid="check-submit" className="btn-oxblood px-8 py-3 whitespace-nowrap">
            {loading ? "Mencari..." : "Cari"}
          </button>
        </form>

        <div className="mt-12 space-y-4" data-testid="results-list">
          {results.map((b) => (
            <div key={b.id} className="card-ox p-6 md:p-8">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="font-mono text-sm text-secondary-ox">{b.code}</div>
                  <div className="font-heading text-xl mt-1.5">{b.purpose}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <RoomChip roomId={b.room_id} roomName={b.room_name} />
                    <span className="px-2 py-0.5 bg-white border border-black/10 rounded">
                      {b.date} · {b.start_time}–{b.end_time}
                    </span>
                    <span className="px-2 py-0.5 bg-white border border-black/10 rounded">
                      {b.nama} · {b.nim} · Kelas {b.kelas}
                    </span>
                  </div>
                  {b.rejection_reason && (
                    <div className="mt-4 bg-red-50 border border-red-200 p-4 rounded-lg">
                      {b.auto_rejected && (
                        <span className="pill pill-ditolak mb-2" data-testid={`auto-rejected-badge-${b.code}`}>
                          <ShieldAlert className="w-3 h-3" /> Auto-rejected
                        </span>
                      )}
                      <div className="text-sm text-red-800 mt-1 leading-relaxed">{b.rejection_reason}</div>
                      {b.auto_rejected && b.alternatives && b.alternatives.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-red-200">
                          <div className="label-ox text-red-700 mb-2">Ajukan Ulang dengan Slot Alternatif</div>
                          <div className="flex flex-wrap gap-2">
                            {b.alternatives.map((alt, i) => {
                              const params = new URLSearchParams({
                                nim: b.nim, nama: b.nama, kelas: b.kelas,
                                room_id: alt.room_id, date: alt.date,
                                start_time: alt.start_time, end_time: alt.end_time,
                                purpose: b.purpose || "",
                                participants: String(b.participants || 1),
                              });
                              return (
                                <Link
                                  key={`${alt.room_id}-${alt.start_time}-${i}`}
                                  to={`/pesan?${params.toString()}`}
                                  data-testid={`reapply-${b.code}-${i}`}
                                  className="inline-flex items-center gap-1.5 text-xs px-3 py-2 bg-white border border-red-300 rounded-lg hover:bg-red-100 text-red-900 font-medium transition-colors">
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  {alt.room_name} · {alt.start_time}–{alt.end_time}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {b.reschedule_logs && b.reschedule_logs.length > 0 && (
                    <div className="mt-4 bg-amber-50 border border-amber-200 p-4 rounded-lg" data-testid={`reschedule-log-${b.code}`}>
                      <div className="label-ox text-amber-800">Riwayat Perubahan Jadwal oleh TU</div>
                      <ul className="mt-2 text-sm text-amber-900 space-y-1.5">
                        {b.reschedule_logs.map((log, i) => {
                          const at = log.at ? new Date(log.at).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
                          return (
                            <li key={`${log.at}-${i}`} className="leading-relaxed">
                              <b>Jadwal diubah oleh Tata Usaha pada {at}</b>:
                              {" "}semula {log.from.room_name} {log.from.date} {log.from.start}–{log.from.end},
                              {" "}diubah menjadi <b>{log.to.room_name} {log.to.date} {log.to.start}–{log.to.end}</b>.
                              {log.reason && <span className="block text-xs text-amber-800 mt-0.5">Alasan: {log.reason}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
                <StatusPill status={b.status} />
              </div>
              {(b.status === "menunggu" || b.status === "disetujui") && (
                <div className="mt-5 flex gap-2 flex-wrap">
                  {b.status === "menunggu" && (
                    <button onClick={() => setEditing(b)} data-testid={`edit-${b.code}`}
                      className="btn-ghost-ox text-sm px-3 py-1.5 inline-flex items-center gap-1">
                      <Pencil className="w-3.5 h-3.5" /> Ubah
                    </button>
                  )}
                  <button onClick={() => cancel(b)} data-testid={`cancel-${b.code}`}
                    className="text-sm px-3 py-1.5 border border-red-300 text-red-700 rounded-lg inline-flex items-center gap-1 hover:bg-red-50 transition-colors">
                    <X className="w-3.5 h-3.5" /> Batalkan
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {editing && <EditModal booking={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); search(); }} />}
      </div>
    </div>
  );
}

function EditModal({ booking, onClose, onDone }) {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState({
    room_id: booking.room_id, date: booking.date,
    start_time: booking.start_time, end_time: booking.end_time,
    purpose: booking.purpose, participants: booking.participants,
  });
  useEffect(() => { api.get("/rooms").then((r) => setRooms(r.data.filter((x) => x.active))); }, []);
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/bookings/public/${booking.code}`, { ...form, participants: Number(form.participants) });
      toast.success("Pengajuan diubah");
      onDone();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="civic fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white p-8 rounded-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-heading text-xl">Ubah Pengajuan · {booking.code}</h3>
        <span className="title-accent mt-3" />
        <form onSubmit={submit} className="mt-6 space-y-4">
          <select className="input-ox" value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input type="date" className="input-ox" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input type="time" className="input-ox" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            <input type="time" className="input-ox" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          </div>
          <textarea className="input-ox" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          <input type="number" className="input-ox" value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn-ghost-ox px-4 py-2 text-sm">Batal</button>
            <button data-testid="edit-save" className="btn-oxblood px-5 py-2 text-sm">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}
