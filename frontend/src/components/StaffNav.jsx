import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LogOut, Building2 } from "lucide-react";

export default function StaffNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const links = [];
  if (user.role === "kepala_labor") links.push({ to: "/dasbor/kepala-labor", label: "Persetujuan" });
  if (user.role === "tata_usaha") links.push({ to: "/dasbor/tu", label: "Kalender & Jadwal" });
  if (user.role === "admin") {
    links.push({ to: "/dasbor/admin", label: "Panel Admin" });
    links.push({ to: "/dasbor/tu", label: "Kalender" });
    links.push({ to: "/dasbor/kepala-labor", label: "Persetujuan" });
  }
  links.push({ to: "/laporan", label: "Laporan" });

  return (
    <nav className="sticky top-0 z-40 backdrop-blur-md bg-white/85 border-b border-zinc-200" data-testid="staff-nav">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            <span className="font-heading text-sm tracking-tight">FH UNRI · Sistem Labor</span>
          </div>
          <div className="flex items-center gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to}
                data-testid={`nav-${l.to.replace(/\//g, "-")}`}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
                    isActive ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
                  }`}>
                {l.label}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 hidden md:block">{user.email} · <b>{user.role}</b></span>
          <button
            data-testid="logout-button"
            onClick={async () => { await logout(); navigate("/masuk"); }}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-zinc-300 rounded-sm hover:bg-zinc-50">
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>
      </div>
    </nav>
  );
}
