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
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-[900px] mx-auto px-6 py-10">
        <Link to="/" className="text-sm text-zinc-600 inline-flex items-center gap-1 hover:text-zinc-900">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>
        <div className="label-eyebrow mt-4">MAHASISWA</div>
        <h1 className="font-display text-4xl mt-1">Cek Status Pengajuan</h1>
        <p className="text-zinc-600 mt-2 text-sm">Cari dengan <b>Kode Booking</b> (LAB-2026-xxxx) atau <b>NIM</b> Anda.</p>

        <form onSubmit={search} className="mt-8 flex gap-2" data-testid="check-form">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              data-testid="check-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Contoh: LAB-2026-0042 atau NIM 2010101010"
              className="w-full pl-10 pr-4 py-3.5 border border-zinc-300 rounded-sm bg-white focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>
          <button data-testid="check-submit" className="px-6 py-3.5 bg-zinc-900 text-white rounded-sm font-semibold hover:bg-zinc-800">
            {loading ? "Mencari..." : "Cari"}
          </button>
        </form>

        <div className="mt-10 space-y-3" data-testid="results-list">
          {results.map((b) => (
            <div key={b.id} className="bg-white border border-zinc-200 p-6 rounded-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-mono text-sm text-zinc-500">{b.code}</div>
                  <div className="font-heading text-lg mt-1">{b.purpose}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <RoomChip roomId={b.room_id} roomName={b.room_name} />
                    <span className="px-2 py-0.5 border border-zinc-200 rounded-sm">
                      {b.date} · {b.start_time}–{b.end_time}
                    </span>
                    <span className="px-2 py-0.5 border border-zinc-200 rounded-sm">
                      {b.nama} · {b.nim} · Kelas {b.kelas}
                    </span>
                  </div>
                  {b.rejection_reason && (
                    <div className="mt-3 bg-red-50 border border-red-200 p-3 rounded-sm">
                      {b.auto_rejected && (
                        <span className="pill pill-ditolak mb-2" data-testid={`auto-rejected-badge-${b.code}`}>
                          <ShieldAlert className="w-3 h-3" /> Auto-rejected
                        </span>
                      )}
                      <div className="text-sm text-red-800 mt-1 leading-relaxed">{b.rejection_reason}</div>
                      {b.auto_rejected && b.alternatives && b.alternatives.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-red-200">
                          <div className="label-eyebrow text-red-700 mb-2">AJUKAN ULANG DENGAN SLOT ALTERNATIF</div>
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
                                  className="inline-flex items-center gap-1.5 text-xs px-3 py-2 bg-white border border-red-300 rounded-sm hover:bg-red-100 text-red-900 font-medium">
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
                </div>
                <StatusPill status={b.status} />
              </div>
              {(b.status === "menunggu" || b.status === "disetujui") && (
                <div className="mt-4 flex gap-2 flex-wrap">
                  {b.status === "menunggu" && (
                    <button onClick={() => setEditing(b)} data-testid={`edit-${b.code}`}
                      className="text-sm px-3 py-1.5 border border-zinc-300 rounded-sm inline-flex items-center gap-1 hover:bg-zinc-50">
                      <Pencil className="w-3.5 h-3.5" /> Ubah
                    </button>
                  )}
                  <button onClick={() => cancel(b)} data-testid={`cancel-${b.code}`}
                    className="text-sm px-3 py-1.5 border border-red-300 text-red-700 rounded-sm inline-flex items-center gap-1 hover:bg-red-50">
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white p-8 rounded-sm max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-heading text-xl">Ubah Pengajuan · {booking.code}</h3>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <select className="input" value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input type="time" className="input" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            <input type="time" className="input" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          </div>
          <textarea className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          <input type="number" className="input" value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-zinc-300 rounded-sm text-sm">Batal</button>
            <button data-testid="edit-save" className="px-4 py-2 bg-zinc-900 text-white rounded-sm text-sm">Simpan</button>
          </div>
        </form>
        <style>{`.input { width:100%; padding:0.55rem 0.7rem; border:1px solid #e4e4e7; border-radius:0.125rem; font-size:0.9rem; }`}</style>
      </div>
    </div>
  );
}
