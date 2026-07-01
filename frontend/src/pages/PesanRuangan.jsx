import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError, parseConflictDetail } from "@/lib/api";
import { toast } from "sonner";
import { Copy, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function PesanRuangan() {
  const [rooms, setRooms] = useState([]);
  const [settings, setSettings] = useState(null);
  const [captcha, setCaptcha] = useState({ a: 0, b: 0 });
  const [form, setForm] = useState({
    nim: "", nama: "", kelas: "", room_id: "", date: "",
    start_time: "08:00", end_time: "10:00", purpose: "", participants: 10,
    contact: "", captcha_answer: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [conflictInfo, setConflictInfo] = useState(null);

  useEffect(() => {
    (async () => {
      const [r1, r2] = await Promise.all([api.get("/rooms"), api.get("/settings/public")]);
      setRooms(r1.data.filter((r) => r.active));
      if (r1.data.length && !form.room_id) setForm((f) => ({ ...f, room_id: r1.data[0].id }));
      setSettings(r2.data);
    })();
    setCaptcha({ a: Math.floor(Math.random() * 8) + 1, b: Math.floor(Math.random() * 8) + 1 });
  }, []); // eslint-disable-line

  // Auto-complete when NIM lengths look plausible
  useEffect(() => {
    if (!form.nim || form.nim.length < 5) return;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/mahasiswa/${form.nim}`);
        if (data && data.nama && !form.nama) setForm((f) => ({ ...f, nama: data.nama, kelas: f.kelas || data.kelas || "" }));
      } catch (_e) { /* NIM not yet cached — silent */ }
    }, 400);
    return () => clearTimeout(t);
  }, [form.nim]); // eslint-disable-line

  const disabledDate = (dateStr) => {
    if (!settings) return false;
    if (settings.holidays.includes(dateStr)) return true;
    const wd = new Date(dateStr + "T00:00").getDay();
    const idx = (wd + 6) % 7; // convert Sun=0..Sat=6 to Mon=0..Sun=6
    const oh = settings.operating_hours[String(idx)];
    return !oh?.open;
  };

  const opHours = useMemo(() => {
    if (!settings || !form.date) return null;
    const wd = new Date(form.date + "T00:00").getDay();
    const idx = (wd + 6) % 7;
    return settings.operating_hours[String(idx)];
  }, [settings, form.date]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setConflictInfo(null);
    try {
      const payload = {
        ...form,
        participants: Number(form.participants) || 1,
        captcha_a: captcha.a,
        captcha_b: captcha.b,
        captcha_answer: Number(form.captcha_answer),
      };
      const { data } = await api.post("/bookings/public", payload);
      setSuccessResult(data);
      toast.success("Pengajuan berhasil dikirim");
    } catch (err) {
      if (err?.response?.status === 409) {
        const d = parseConflictDetail(err);
        setConflictInfo(d);
        toast.error(d.message || "Bentrok jadwal");
      } else {
        toast.error(formatApiError(err));
      }
      setCaptcha({ a: Math.floor(Math.random() * 8) + 1, b: Math.floor(Math.random() * 8) + 1 });
      setForm((f) => ({ ...f, captcha_answer: "" }));
    }
    setSubmitting(false);
  };

  if (successResult) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="bg-white border border-zinc-200 max-w-lg w-full p-10 rounded-sm text-center" data-testid="booking-success">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-700" />
          </div>
          <div className="label-eyebrow">Pengajuan Diterima</div>
          <h1 className="font-display text-3xl mt-2">Simpan Kode Booking</h1>
          <div className="mt-6 bg-zinc-900 text-white font-mono text-2xl py-5 tracking-widest rounded-sm" data-testid="booking-code">
            {successResult.code}
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(successResult.code); toast.success("Kode disalin"); }}
            data-testid="copy-code-button"
            className="mt-3 inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900">
            <Copy className="w-4 h-4" /> Salin kode
          </button>
          <p className="mt-6 text-sm text-zinc-600">
            Status: <b>Menunggu persetujuan Kepala Labor</b>. Gunakan kode di atas
            (atau NIM Anda) untuk memeriksa status di halaman <b>Cek Status</b>.
          </p>
          <div className="mt-8 flex gap-3 justify-center">
            <Link to={`/cek-status?code=${successResult.code}`}
              data-testid="go-check-status"
              className="px-5 py-2.5 bg-zinc-900 text-white text-sm rounded-sm">Lihat Status</Link>
            <Link to="/" className="px-5 py-2.5 border border-zinc-300 text-sm rounded-sm">Kembali</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <Link to="/" className="text-sm text-zinc-600 inline-flex items-center gap-1 hover:text-zinc-900">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>
        <div className="mt-4 label-eyebrow">FORMULIR</div>
        <h1 className="font-display text-4xl mt-1">Ajukan Pemakaian Ruangan Labor</h1>
        <p className="text-zinc-600 mt-2 text-sm max-w-2xl">
          Isi data lengkap. Pengajuan akan diverifikasi oleh Kepala Labor.
          Data mahasiswa bersifat self-input dan bukan verifikasi identitas resmi.
        </p>

        <form onSubmit={submit} className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8" data-testid="booking-form">
          <div className="lg:col-span-7 bg-white border border-zinc-200 p-8 rounded-sm space-y-5">
            <Field label="NIM" required>
              <input required data-testid="input-nim" value={form.nim}
                onChange={(e) => setForm({ ...form, nim: e.target.value.replace(/\D/g, "") })}
                className="input" placeholder="Masukkan NIM (angka)" />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nama Lengkap" required>
                <input required data-testid="input-nama" value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  className="input" placeholder="Nama sesuai KTM" />
              </Field>
              <Field label="Kelas" required>
                <input required data-testid="input-kelas" value={form.kelas}
                  onChange={(e) => setForm({ ...form, kelas: e.target.value.toUpperCase() })}
                  className="input" placeholder="Contoh: 4A" />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Ruangan" required>
                <select required data-testid="select-room" value={form.room_id}
                  onChange={(e) => setForm({ ...form, room_id: e.target.value })} className="input">
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Tanggal" required>
                <input required type="date" data-testid="input-date" value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  min={new Date().toISOString().slice(0, 10)} className="input" />
                {form.date && disabledDate(form.date) && (
                  <p className="text-xs text-red-600 mt-1">Ruangan tutup pada tanggal ini</p>
                )}
                {form.date && !disabledDate(form.date) && opHours?.open && (
                  <p className="text-xs text-zinc-500 mt-1">Jam operasional: {opHours.start}–{opHours.end}</p>
                )}
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Jam Mulai" required>
                <input required type="time" data-testid="input-start" value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="input" />
              </Field>
              <Field label="Jam Selesai" required>
                <input required type="time" data-testid="input-end" value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="input" />
              </Field>
            </div>
            <Field label="Keperluan / Agenda" required>
              <textarea required data-testid="input-purpose" value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                className="input min-h-[90px]" placeholder="Contoh: Praktikum Hukum Perdata, kuliah pengganti Prof. Y" />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Jumlah Peserta" required>
                <input required type="number" min={1} data-testid="input-participants" value={form.participants}
                  onChange={(e) => setForm({ ...form, participants: e.target.value })} className="input" />
              </Field>
              <Field label="Kontak (opsional)">
                <input data-testid="input-contact" value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  className="input" placeholder="WA/email" />
              </Field>
            </div>

            <div className="pt-4 border-t border-zinc-200">
              <div className="label-eyebrow mb-2">VERIFIKASI</div>
              <div className="flex items-center gap-3">
                <span className="font-heading text-lg">{captcha.a} + {captcha.b} =</span>
                <input required type="number" data-testid="input-captcha" value={form.captcha_answer}
                  onChange={(e) => setForm({ ...form, captcha_answer: e.target.value })}
                  className="input w-32" placeholder="Jawaban" />
              </div>
            </div>

            <button disabled={submitting} data-testid="submit-booking"
              className="w-full py-3.5 bg-zinc-900 text-white font-semibold rounded-sm hover:bg-zinc-800 disabled:opacity-50">
              {submitting ? "Mengirim..." : "Kirim Pengajuan"}
            </button>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-zinc-200 p-6 rounded-sm">
              <div className="label-eyebrow">CATATAN PENTING</div>
              <ul className="mt-3 text-sm text-zinc-700 space-y-2 leading-relaxed">
                <li>• Sistem akan menolak submit jika jadwal bentrok dengan pengajuan lain yang sudah disetujui.</li>
                <li>• NIM yang sudah pernah dipakai akan otomatis melengkapi Nama & Kelas.</li>
                <li>• Setelah submit, Anda menerima Kode Booking untuk memantau status.</li>
                <li>• Pembatalan bisa dilakukan sendiri di halaman Cek Status.</li>
              </ul>
            </div>

            {conflictInfo && (
              <div className="bg-red-50 border border-red-200 p-6 rounded-sm" data-testid="conflict-info">
                <div className="label-eyebrow text-red-700">BENTROK</div>
                <div className="text-sm mt-2 text-red-900">{conflictInfo.message}</div>
                {conflictInfo.conflicts?.length > 0 && (
                  <ul className="mt-3 text-xs text-red-800 space-y-1">
                    {conflictInfo.conflicts.map((c) => (
                      <li key={c.code}>· {c.code}: {c.start}–{c.end}</li>
                    ))}
                  </ul>
                )}
                {conflictInfo.suggestions?.length > 0 && (
                  <>
                    <div className="label-eyebrow text-red-700 mt-4">SLOT KOSONG</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {conflictInfo.suggestions.map((s) => (
                        <button key={`${s.start}-${s.end}`} type="button"
                          onClick={() => setForm({ ...form, start_time: s.start, end_time: s.end })}
                          className="text-xs px-2 py-1 border border-red-300 bg-white rounded-sm hover:bg-red-100">
                          {s.start}–{s.end}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </form>
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 0.6rem 0.75rem;
          border: 1px solid #e4e4e7;
          border-radius: 0.125rem;
          font-size: 0.9rem;
          background: white;
          outline: none;
          transition: border-color 150ms;
        }
        .input:focus { border-color: #09090b; box-shadow: 0 0 0 1px #09090b; }
      `}</style>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="label-eyebrow block mb-1.5">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {children}
    </div>
  );
}
