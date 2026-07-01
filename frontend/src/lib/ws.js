import { useEffect, useRef } from "react";
import { wsURL } from "@/lib/api";

export function useBookingSocket(onEvent) {
  const wsRef = useRef(null);
  useEffect(() => {
    let alive = true;
    let reconnectTimer;
    function connect() {
      const ws = new WebSocket(wsURL());
      wsRef.current = ws;
      ws.onmessage = (m) => {
        try { onEvent && onEvent(JSON.parse(m.data)); } catch {}
      };
      ws.onclose = () => {
        if (alive) reconnectTimer = setTimeout(connect, 2500);
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
    }
    connect();
    return () => {
      alive = false;
      clearTimeout(reconnectTimer);
      try { wsRef.current && wsRef.current.close(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
