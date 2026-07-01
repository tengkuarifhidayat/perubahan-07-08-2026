import { useEffect, useState } from "react";
import { api, BACKEND_URL, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import StaffNav from "@/components/StaffNav";
import StatusPill, { RoomChip } from "@/components/StatusPill";
import { Download } from "lucide-react";

export default function Laporan() {
  const [filters, setFilters] = useState({ status: "", room_id: "", date_from: "", date_to: "", kelas: "" });
  const [rooms, setRooms] = useState([]);
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/rooms").then((r) => setRooms(r.data)); }, []);
  const load = async () => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    try {
      const { data } = await api.get("/bookings", { params: clean });
      setRows(data);
    } catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line
  const exportUrl = (kind) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const qs = new URLSearchParams(clean).toString();
    return `${BACKEND_URL}/api/reports/export.${kind}${qs ? "?" + qs : ""}`;
  };
  return (
    <div className="min-h-screen bg-zinc-50">
      <StaffNav />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="label-eyebrow">LAPORAN</div>
        <h1 className="font-display text-3xl mt-1">Rekap Penggunaan</h1>

        <div className="mt-6 bg-white border border-zinc-200 rounded-sm p-5 grid grid-cols-1 md:grid-cols-6 gap-3">
          <select data-testid="f-status" className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Semua Status</option>
            <option value="menunggu">Menunggu</option>
            <option value="disetujui">Disetujui</option>
            <option value="ditolak">Ditolak</option>
            <option value="dibatalkan">Dibatalkan</option>
            <option value="kedaluwarsa">Kedaluwarsa</option>
          </select>
          <select data-testid="f-room" className="input" value={filters.room_id} onChange={(e) => setFilters({ ...filters, room_id: e.target.value })}>
            <option value="">Semua Ruangan</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input data-testid="f-date-from" type="date" className="input" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
          <input data-testid="f-date-to" type="date" className="input" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
          <input data-testid="f-kelas" placeholder="Kelas" className="input" value={filters.kelas} onChange={(e) => setFilters({ ...filters, kelas: e.target.value.toUpperCase() })} />
          <button data-testid="f-apply" onClick={load} className="px-4 bg-zinc-900 text-white text-sm rounded-sm">Terapkan</button>
        </div>

        <div className="mt-4 flex gap-2">
          <a data-testid="export-xlsx" href={exportUrl("xlsx")} className="px-3 py-1.5 border border-zinc-300 text-sm rounded-sm inline-flex items-center gap-1"><Download className="w-4 h-4" /> Excel</a>
          <a data-testid="export-pdf" href={exportUrl("pdf")} className="px-3 py-1.5 border border-zinc-300 text-sm rounded-sm inline-flex items-center gap-1"><Download className="w-4 h-4" /> PDF</a>
        </div>

        <div className="mt-4 bg-white border border-zinc-200 rounded-sm overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 label-eyebrow text-left">
              <tr>
                <th className="p-3">Kode</th><th>Tanggal</th><th>Jam</th><th>Ruangan</th>
                <th>Nama / NIM / Kelas</th><th>Keperluan</th><th>Status</th>
              </tr>
            </thead>
            <tbody data-testid="report-rows">
              {rows.map((b) => (
                <tr key={b.id} className="border-t border-zinc-100">
                  <td className="p-3 font-mono text-xs">{b.code}</td>
                  <td>{b.date}</td>
                  <td>{b.start_time}–{b.end_time}</td>
                  <td><RoomChip roomId={b.room_id} roomName={b.room_name} /></td>
                  <td>{b.nama} · {b.nim} · {b.kelas}</td>
                  <td className="max-w-[220px] truncate">{b.purpose}</td>
                  <td><StatusPill status={b.status} /></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Tidak ada data.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`.input { padding:0.55rem 0.7rem; border:1px solid #e4e4e7; border-radius:0.125rem; font-size:0.85rem; background:white; }`}</style>
    </div>
  );
}
