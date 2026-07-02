import { Link } from "react-router-dom";
import { CalendarCheck, Search, LogIn, Building2 } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen relative bg-white">

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          <span className="font-heading text-sm">FH UNRI · Sistem Pemesanan Labor</span>
        </div>
        <Link to="/masuk" data-testid="staff-login-link" className="text-sm font-medium underline underline-offset-4">
          Masuk Staff
        </Link>
      </div>

      <main className="relative z-10 max-w-[1200px] mx-auto px-6 pt-16 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7">
          <div className="label-eyebrow mb-4">FAKULTAS HUKUM · UNIVERSITAS RIAU</div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[0.95] text-zinc-900">
            Pesan Ruangan Labor.<br/>
            Tanpa Bentrok. Tanpa Ribet.
          </h1>
          <p className="mt-6 text-zinc-600 max-w-xl leading-relaxed">
            Sistem terpadu untuk mengajukan, memantau, dan mengelola pemakaian
            <b> Labor 1 </b> dan <b> Labor 2 </b> — dengan deteksi bentrok otomatis
            dan alur persetujuan Kepala Labor → Tata Usaha.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link
              to="/pesan"
              data-testid="cta-pesan"
              className="inline-flex items-center gap-2 bg-zinc-900 text-white px-6 py-3.5 rounded-sm font-semibold hover:bg-zinc-800 transition-colors">
              <CalendarCheck className="w-4 h-4" /> Ajukan Pemesanan
            </Link>
            <Link
              to="/cek-status"
              data-testid="cta-cek-status"
              className="inline-flex items-center gap-2 bg-white text-zinc-900 px-6 py-3.5 rounded-sm font-semibold border border-zinc-300 hover:bg-zinc-50 transition-colors">
              <Search className="w-4 h-4" /> Cek Status Pengajuan
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
            <div className="border-l-2 border-zinc-900 pl-4">
              <div className="label-eyebrow">01</div>
              <div className="font-heading mt-1">Isi Form</div>
              <div className="text-zinc-600 mt-1">Nama, NIM, kelas, ruangan & jam.</div>
            </div>
            <div className="border-l-2 border-zinc-900 pl-4">
              <div className="label-eyebrow">02</div>
              <div className="font-heading mt-1">Verifikasi</div>
              <div className="text-zinc-600 mt-1">Kepala Labor menyetujui/menolak.</div>
            </div>
            <div className="border-l-2 border-zinc-900 pl-4">
              <div className="label-eyebrow">03</div>
              <div className="font-heading mt-1">Tercatat</div>
              <div className="text-zinc-600 mt-1">Kalender TU ter-update otomatis.</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-white border border-zinc-200 p-6 rounded-sm">
            <div className="label-eyebrow">Cara Melacak Pengajuan</div>
            <h3 className="font-heading text-xl mt-2">Cukup dengan Kode Booking</h3>
            <p className="text-zinc-600 text-sm mt-3">
              Setelah submit, Anda menerima kode unik seperti
              <span className="font-mono px-2 py-0.5 mx-1 bg-zinc-100 border border-zinc-200 rounded-sm">LAB-2026-0042</span>.
              Gunakan kode ini di halaman Cek Status.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-zinc-500">
              <LogIn className="w-4 h-4" />
              <span>Staff (Kepala Labor · TU · Admin) masuk melalui halaman terpisah.</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-zinc-200 bg-white/70 py-6">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-between text-xs text-zinc-500">
          <span>© {new Date().getFullYear()} Fakultas Hukum UNRI</span>
          <span>Data pemesan bersifat self-input, bukan acuan legal formal.</span>
        </div>
      </footer>
    </div>
  );
}
