import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { LogIn, ArrowLeft, Scale } from "lucide-react";

export default function StaffLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(email, password);
      toast.success(`Selamat datang, ${u.name || u.email}`);
      if (u.role === "admin") navigate("/dasbor/admin");
      else if (u.role === "kepala_labor") navigate("/dasbor/kepala-labor");
      else navigate("/dasbor/tu");
    } catch (err) { toast.error(formatApiError(err)); }
    setLoading(false);
  };

  return (
    <div className="civic min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div className="hidden lg:flex relative flex-col justify-between p-16" style={{ background: "var(--text-primary)" }}>
        <div className="flex items-center gap-2.5 text-white/70">
          <Scale className="w-5 h-5" />
          <span className="label-eyebrow" style={{ color: "rgba(255,255,255,0.6)" }}>Fakultas Hukum · UNRI</span>
        </div>
        <div>
          <span className="title-accent mb-6" />
          <h2 className="font-display text-4xl leading-tight text-white">Panel Staf</h2>
          <p className="text-white/60 mt-4 max-w-sm leading-relaxed">
            Persetujuan pengajuan, kalender jadwal, dan manajemen pengguna.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="text-sm text-secondary-ox inline-flex items-center gap-1 mb-10 hover:text-oxblood transition-colors">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </Link>
          <div className="label-eyebrow">Masuk</div>
          <h1 className="font-display text-3xl mt-1.5">Portal Staf</h1>
          <span className="title-accent mt-4" />
          <p className="text-secondary-ox text-sm mt-4">Kepala Labor · Tata Usaha · Admin</p>

          <form onSubmit={submit} className="mt-10 space-y-5" data-testid="login-form">
            <div>
              <label className="label-ox block mb-1.5">Email</label>
              <input required type="email" data-testid="login-email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-ox" autoFocus />
            </div>
            <div>
              <label className="label-ox block mb-1.5">Password</label>
              <input required type="password" data-testid="login-password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-ox" />
            </div>
            <button disabled={loading} data-testid="login-submit"
              className="btn-oxblood w-full py-3 inline-flex items-center justify-center gap-2">
              <LogIn className="w-4 h-4" /> {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
