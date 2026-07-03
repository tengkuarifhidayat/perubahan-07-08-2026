import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, formatApiError, parseConflictDetail } from "@/lib/api";
import { toast } from "sonner";
import { Copy, ArrowLeft, CheckCircle2, ChevronDown } from "lucide-react";

export default function PesanRuangan() {
  const [urlParams] = useSearchParams();
  const [rooms, setRooms] = useState([]);
  const [settings, setSettings] = useState(null);
  const [captcha, setCaptcha] = useState({ a: 0, b: 0 });
  const [form, setForm] = useState({
    nim: urlParams.get("nim") || "",
    nama: urlParams.get("nama") || "",
    kelas: urlParams.get("kelas") || "",
    room_id: urlParams.get("room_id") || "",
    date: urlParams.get("date") || "",
    start_time: urlParams.get("start_time") || "08:00",
    end_time: urlParams.get("end_time") || "10:00",
    purpose: urlParams.get("purpose") || "",
    participants: urlParams.get("participants") || 10,
    contact: "", captcha_answer: "",
  });
  const prefilled = !!urlParams.get("room_id");
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
      <div className="civic min-h-screen flex items-center justify-center p-6">
        <div className="card-ox max-w-lg w-full p-10 text-center" data-testid="booking-success">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-700" />
          </div>
          <div className="label-eyebrow">Pengajuan Diterima</div>
          <h1 className="font-display text-3xl mt-2">Simpan Kode Booking</h1>
          <div className="mt-6 text-white font-mono text-2xl py-5 tracking-widest rounded-lg" style={{ background: "var(--text-primary)" }} data-testid="booking-code">
            {successResult.code}
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(successResult.code); toast.success("Kode disalin"); }}
            data-testid="copy-code-button"
            className="mt-3 inline-flex items-center gap-1 text-sm text-secondary-ox hover:text-oxblood transition-colors">
            <Copy className="w-4 h-4" /> Salin kode
          </button>
          <p className="mt-6 text-sm text-secondary-ox leading-relaxed">
            Status: <b className="text-oxblood">Menunggu persetujuan Kepala Labor</b>. Gunakan kode di atas
            (atau NIM Anda) untuk memeriksa status di halaman <b>Cek Status</b>.
          </p>
          <div className="mt-8 flex gap-3 justify-center">
            <Link to={`/cek-status?code=${successResult.code}`}
              data-testid="go-check-status"
              className="btn-oxblood px-5 py-2.5 text-sm">Lihat Status</Link>
            <Link to="/" className="btn-ghost-ox px-5 py-2.5 text-sm">Kembali</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="civic min-h-screen">
      <div className="max-w-[1200px] mx-auto px-6 py-10">
        <Link to="/" className="text-sm text-secondary-ox inline-flex items-center gap-1 hover:text-oxblood transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>
        <div className="mt-6 label-eyebrow">Formulir</div>
        <h1 className="font-display text-4xl sm:text-5xl mt-1.5">Ajukan Pemakaian Ruangan Labor</h1>
        <span className="title-accent mt-5" />
        {prefilled && (
          <div className="mt-5 bg-emerald-50 border border-emerald-200 p-4 rounded-lg text-sm text-emerald-800" data-testid="prefilled-banner">
            Form telah diisi otomatis dengan slot alternatif. Silakan periksa & lengkapi data pribadi Anda sebelum mengirim.
          </div>
        )}
        <p className="text-secondary-ox mt-5 text-sm max-w-2xl leading-relaxed">
          Isi data lengkap. Pengajuan akan diverifikasi oleh Kepala Labor.
        </p>

        <form onSubmit={submit} className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8" data-testid="booking-form">
          <div className="lg:col-span-7 card-ox p-8 md:p-10 space-y-6">
            <Field label="NIM" required>
              <input required data-testid="input-nim" value={form.nim}
                onChange={(e) => setForm({ ...form, nim: e.target.value.replace(/\D/g, "") })}
                className="input-ox" placeholder="Masukkan NIM (angka)" />
              <p className="text-xs text-secondary-ox mt-1.5" data-testid="data-valid-note">
                Isi data yang benar. Pengajuan dengan data tidak valid dapat ditolak Kepala Labor.
              </p>
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Nama Lengkap" required>
                <input required data-testid="input-nama" value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  className="input-ox" placeholder="Nama sesuai KTM" />
              </Field>
              <Field label="Kelas" required>
                <input required data-testid="input-kelas" value={form.kelas}
                  onChange={(e) => setForm({ ...form, kelas: e.target.value.toUpperCase() })}
                  className="input-ox" placeholder="Contoh: 4A" />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Ruangan" required>
                <select required data-testid="select-room" value={form.room_id}
                  onChange={(e) => setForm({ ...form, room_id: e.target.value })} className="input-ox">
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Tanggal" required>
                <input required type="date" data-testid="input-date" value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  min={new Date().toISOString().slice(0, 10)} className="input-ox" />
                {form.date && disabledDate(form.date) && (
                  <p className="text-xs text-red-600 mt-1.5">Ruangan tutup pada tanggal ini</p>
                )}
                {form.date && !disabledDate(form.date) && opHours?.open && (
                  <p className="text-xs text-secondary-ox mt-1.5">Jam operasional: {opHours.start}–{opHours.end}</p>
                )}
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Jam Mulai" required>
                <input required type="time" data-testid="input-start" value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="input-ox" />
              </Field>
              <Field label="Jam Selesai" required>
                <input required type="time" data-testid="input-end" value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="input-ox" />
                {settings?.max_duration_enabled && (
                  <p className="text-xs text-secondary-ox mt-1.5" data-testid="maxduration-hint">
                    Maks. durasi {settings.max_duration_hours} jam per pengajuan
                  </p>
                )}
              </Field>
            </div>
            <Field label="Keperluan / Agenda" required>
              <textarea required data-testid="input-purpose" value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                className="input-ox min-h-[100px]" placeholder="Contoh: Praktikum Hukum Perdata, kuliah pengganti Prof. Y" />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Jumlah Peserta" required>
                <input required type="number" min={1} data-testid="input-participants" value={form.participants}
                  onChange={(e) => setForm({ ...form, participants: e.target.value })} className="input-ox" />
              </Field>
              <Field label="Kontak (opsional)">
                <input data-testid="input-contact" value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  className="input-ox" placeholder="WA/email" />
              </Field>
            </div>

            <div className="pt-6 border-t border-black/5">
              <div className="label-ox mb-2.5">Verifikasi</div>
              <div className="flex items-center gap-3">
                <span className="font-heading text-lg">{captcha.a} + {captcha.b} =</span>
                <input required type="number" data-testid="input-captcha" value={form.captcha_answer}
                  onChange={(e) => setForm({ ...form, captcha_answer: e.target.value })}
                  className="input-ox w-32" placeholder="Jawaban" />
              </div>
            </div>

            <button disabled={submitting} data-testid="submit-booking"
              className="btn-oxblood w-full py-3.5 font-semibold">
              {submitting ? "Mengirim..." : "Kirim Pengajuan"}
            </button>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <details className="accordion-ox card-ox overflow-hidden" data-testid="ketentuan-accordion">
              <summary className="p-5 flex items-center justify-between select-none">
                <span className="label-ox text-oxblood">Ketentuan Pengajuan</span>
                <ChevronDown className="accordion-chevron w-4 h-4 text-oxblood" />
              </summary>
              <ul className="px-5 pb-5 text-sm text-secondary-ox space-y-2.5 leading-relaxed border-t border-black/5 pt-4">
                <li>• Sistem akan menolak submit jika jadwal bentrok dengan pengajuan lain yang <b>sudah disetujui</b> maupun yang <b>masih menunggu</b> persetujuan.</li>
                <li>• NIM yang sudah pernah dipakai akan otomatis melengkapi Nama & Kelas.</li>
                <li>• Setelah submit, Anda menerima Kode Booking untuk memantau status.</li>
                <li>• Pembatalan bisa dilakukan sendiri di halaman Cek Status.</li>
                <li>• Data mahasiswa bersifat self-input dan bukan verifikasi identitas resmi.</li>
              </ul>
            </details>

            {conflictInfo && (
              <div className="bg-red-50 border border-red-200 p-6 rounded-lg" data-testid="conflict-info">
                <div className="label-ox text-red-700">Bentrok</div>
                <div className="text-sm mt-2 text-red-900 leading-relaxed">{conflictInfo.message}</div>
                {conflictInfo.conflicts?.length > 0 && (
                  <ul className="mt-3 text-xs text-red-800 space-y-1">
                    {conflictInfo.conflicts.map((c) => (
                      <li key={c.code}>· {c.code}: {c.start}–{c.end}</li>
                    ))}
                  </ul>
                )}
                {conflictInfo.suggestions?.length > 0 && (
                  <>
                    <div className="label-ox text-red-700 mt-4">Slot Kosong</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {conflictInfo.suggestions.map((s) => (
                        <button key={`${s.start}-${s.end}`} type="button"
                          onClick={() => setForm({ ...form, start_time: s.start, end_time: s.end })}
                          className="text-xs px-2.5 py-1.5 border border-red-300 bg-white rounded-lg hover:bg-red-100 transition-colors">
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
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="label-ox block mb-1.5">
        {label} {required && <span className="text-oxblood">*</span>}
      </label>
      {children}
    </div>
  );
}
