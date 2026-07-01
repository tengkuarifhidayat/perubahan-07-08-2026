import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch (_e) {
        // Not authenticated is expected on first load — no logging needed
        setUser(null);
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setUser(data.user);
    return data.user;
  };
  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (e) { console.warn("logout error", e); }
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, logout, setUser }), [user, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
export { formatApiError };
