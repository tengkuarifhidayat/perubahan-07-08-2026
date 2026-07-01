import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

export function wsURL() {
  const u = new URL(BACKEND_URL);
  const proto = u.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${u.host}/api/ws`;
}

export function formatApiError(err) {
  const d = err?.response?.data?.detail;
  if (d == null) return err?.message || "Terjadi kesalahan";
  if (typeof d === "string") {
    try {
      const j = JSON.parse(d);
      if (j?.message) return j.message;
    } catch {}
    return d;
  }
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return String(d);
}

export function parseConflictDetail(err) {
  const d = err?.response?.data?.detail;
  if (typeof d === "string") {
    try { return JSON.parse(d); } catch { return { message: d }; }
  }
  return { message: "Bentrok" };
}

export const STATUS_LABELS = {
  menunggu: "Menunggu",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
  kedaluwarsa: "Kedaluwarsa",
};
