import { Link } from "react-router-dom";
import { CalendarCheck, Search, LogIn, Building2 } from "lucide-react";

export default function Landing() {
  return (
    <div className="civic min-h-screen flex flex-col">
      <header className="w-full max-w-[1200px] mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Building2 className="w-5 h-5 text-oxblood" />
          <span className="font-heading text-base">FH UNRI · Sistem Pemesanan Labor</span>
        </div>
        <Link
          to="/masuk"
          data-testid="staff-login-link"
          className="btn-ghost-ox text-sm px-4 py-2 inline-flex items-center gap-1.5">
          <LogIn className="w-4 h-4" /> Portal Staf
        </Link>
      </header>

      <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        <div className="lg:col-span-6">
          <div className="label-eyebrow mb-5">Fakultas Hukum · Universitas Riau</div>
          <span className="title-accent mb-8" />
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/pesan"
              data-testid="cta-pesan"
              className="btn-oxblood inline-flex items-center justify-center gap-2 px-6 py-4 text-base">
              <CalendarCheck className="w-5 h-5" /> Ajukan Pemesanan
            </Link>
            <Link
              to="/cek-status"
              data-testid="cta-cek-status"
              className="btn-outline-ox inline-flex items-center justify-center gap-2 px-6 py-4 text-base">
              <Search className="w-5 h-5" /> Cek Status Pengajuan
            </Link>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="card-ox p-8 md:p-10">
            <div className="label-eyebrow">Cara Melacak Pengajuan</div>
            <h3 className="font-heading text-2xl mt-3">Cukup dengan Kode Booking</h3>
            <p className="text-secondary-ox text-sm mt-4 leading-relaxed">
              Setelah submit, Anda menerima kode unik seperti
              <span className="font-mono text-xs px-2 py-0.5 mx-1 bg-white border border-black/10 rounded">LAB-2026-0042</span>.
              Gunakan kode ini di halaman Cek Status.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-black/5 py-6">
        <div className="max-w-[1200px] mx-auto px-6 text-xs text-secondary-ox">
          <span>© {new Date().getFullYear()} Fakultas Hukum UNRI</span>
        </div>
      </footer>
    </div>
  );
}
