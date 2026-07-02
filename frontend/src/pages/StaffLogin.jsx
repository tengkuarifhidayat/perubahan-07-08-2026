import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { LogIn, ArrowLeft } from "lucide-react";

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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div className="hidden lg:block relative">
        <img src="https://static.prod-images.emergentagent.com/jobs/b598b567-f33a-4805-a749-3e9d0b8458ad/images/4bc5b9a75c3b0d53f5d86a695a00cf12ab423e615c1e68c3800b9c7d39be0f9b.png"
          alt="Ilustrasi timbangan keadilan dan palu hakim" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-zinc-900/70" />
        <div className="absolute inset-0 p-16 text-white flex flex-col justify-between">
          <div className="label-eyebrow text-white/60">FAKULTAS HUKUM · UNRI</div>
          <div>
            <h2 className="font-display text-4xl leading-tight">Panel Staff</h2>
            <p className="text-white/70 mt-3 max-w-sm">Persetujuan pengajuan, kalender jadwal, dan manajemen pengguna.</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-8 bg-zinc-50">
        <div className="w-full max-w-sm">
          <Link to="/" className="text-sm text-zinc-600 inline-flex items-center gap-1 mb-8">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </Link>
          <div className="label-eyebrow">MASUK</div>
          <h1 className="font-display text-3xl mt-1">Staff Login</h1>
          <p className="text-zinc-500 text-sm mt-1">Kepala Labor · Tata Usaha · Admin</p>
          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="login-form">
            <div>
              <label className="label-eyebrow block mb-1">Email</label>
              <input required type="email" data-testid="login-email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input" autoFocus />
            </div>
            <div>
              <label className="label-eyebrow block mb-1">Password</label>
              <input required type="password" data-testid="login-password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input" />
            </div>
            <button disabled={loading} data-testid="login-submit"
              className="w-full py-3 bg-zinc-900 text-white rounded-sm font-semibold hover:bg-zinc-800 disabled:opacity-50 inline-flex items-center justify-center gap-2">
              <LogIn className="w-4 h-4" /> {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        </div>
        <style>{`.input { width:100%; padding:0.65rem 0.8rem; border:1px solid #e4e4e7; border-radius:0.125rem; font-size:0.9rem; background:white; } .input:focus { outline:none; border-color:#09090b; box-shadow:0 0 0 1px #09090b; }`}</style>
      </div>
    </div>
  );
}
