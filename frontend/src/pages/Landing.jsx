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

      <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 pt-16 sm:pt-24 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
        <div className="lg:col-span-7">
          <div className="label-eyebrow mb-5">Fakultas Hukum · Universitas Riau</div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.02]">
            Pesan Ruangan Labor.<br />
            Tanpa Bentrok. Tanpa Ribet.
          </h1>
          <span className="title-accent mt-6" />
          <p className="mt-8 text-base text-secondary-ox max-w-xl leading-relaxed">
            Sistem terpadu untuk mengajukan, memantau, dan mengelola pemakaian
            <b className="text-oxblood"> Labor 1 </b> dan <b className="text-oxblood"> Labor 2 </b>
            — dengan deteksi bentrok otomatis dan alur persetujuan Kepala Labor → Tata Usaha.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link
              to="/pesan"
              data-testid="cta-pesan"
              className="btn-oxblood inline-flex items-center justify-center gap-2 px-6 py-3.5">
              <CalendarCheck className="w-4 h-4" /> Ajukan Pemesanan
            </Link>
            <Link
              to="/cek-status"
              data-testid="cta-cek-status"
              className="btn-outline-ox inline-flex items-center justify-center gap-2 px-6 py-3.5">
              <Search className="w-4 h-4" /> Cek Status Pengajuan
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { n: "01", t: "Isi Form", d: "Nama, NIM, kelas, ruangan & jam." },
              { n: "02", t: "Verifikasi", d: "Kepala Labor menyetujui/menolak." },
              { n: "03", t: "Tercatat", d: "Kalender TU ter-update otomatis." },
            ].map((s) => (
              <div key={s.n} className="border-l-2 border-oxblood pl-4">
                <div className="label-eyebrow text-oxblood">{s.n}</div>
                <div className="font-heading text-lg mt-1.5">{s.t}</div>
                <div className="text-sm text-secondary-ox mt-1 leading-relaxed">{s.d}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="card-ox p-8">
            <div className="label-eyebrow">Cara Melacak Pengajuan</div>
            <h3 className="font-heading text-2xl mt-3">Cukup dengan Kode Booking</h3>
            <p className="text-secondary-ox text-sm mt-4 leading-relaxed">
              Setelah submit, Anda menerima kode unik seperti
              <span className="font-mono text-xs px-2 py-0.5 mx-1 bg-white border border-black/10 rounded">LAB-2026-0042</span>.
              Gunakan kode ini di halaman Cek Status.
            </p>
            <div className="mt-8 pt-6 border-t border-black/5 flex items-center gap-2.5 text-xs text-secondary-ox">
              <LogIn className="w-4 h-4 text-oxblood" />
              <span>Staf (Kepala Labor · TU · Admin) masuk melalui halaman terpisah.</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-black/5 py-6">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs text-secondary-ox">
          <span>© {new Date().getFullYear()} Fakultas Hukum UNRI</span>
          <span>Data pemesan bersifat self-input, bukan acuan legal formal.</span>
        </div>
      </footer>
    </div>
  );
}
