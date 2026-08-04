import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";

import Landing from "@/pages/Landing";
import PesanRuangan from "@/pages/PesanRuangan";
import CekStatus from "@/pages/CekStatus";
import StaffLogin from "@/pages/StaffLogin";
import KepalaLaborDashboard from "@/pages/KepalaLaborDashboard";
import TataUsahaDashboard from "@/pages/TataUsahaDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import Laporan from "@/pages/Laporan";
import KioskTV from "@/pages/KioskTV";

const ROLES_KEPALA_LABOR = ["kepala_labor", "admin"];
const ROLES_TU = ["tata_usaha", "admin"];
const ROLES_ADMIN = ["admin"];
const ROLES_REPORT = ["kepala_labor", "tata_usaha", "admin"];

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-zinc-500">Memuat…</div>;
  if (!user) return <Navigate to="/masuk" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/masuk" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/pesan" element={<PesanRuangan />} />
          <Route path="/cek-status" element={<CekStatus />} />
          <Route path="/masuk" element={<StaffLogin />} />
          <Route path="/kiosk/tv" element={<KioskTV />} />

          <Route path="/dasbor/kepala-labor" element={
            <Protected roles={ROLES_KEPALA_LABOR}><KepalaLaborDashboard /></Protected>} />
          <Route path="/dasbor/tu" element={
            <Protected roles={ROLES_TU}><TataUsahaDashboard /></Protected>} />
          <Route path="/dasbor/admin" element={
            <Protected roles={ROLES_ADMIN}><AdminDashboard /></Protected>} />
          <Route path="/laporan" element={
            <Protected roles={ROLES_REPORT}><Laporan /></Protected>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
