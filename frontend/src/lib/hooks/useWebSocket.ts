import { useEffect, useRef, useCallback, useState } from "react";
import { useAuthStore } from "@/lib/store/auth.store";

type WSState = "connecting" | "connected" | "disconnected" | "error";

interface UseWebSocketOptions {
  onMessage?:    (data: unknown) => void;
  onConnect?:    () => void;
  onDisconnect?: () => void;
  reconnect?:    boolean;
  maxRetries?:   number;
}

const WS_BASE = typeof window !== "undefined"
  ? window.location.origin.replace(/^http/, "ws")
  : "ws://localhost:8000";

export function useWebSocket(path: string, options: UseWebSocketOptions = {}) {
  const { accessToken: token } = useAuthStore();
  const wsRef       = useRef<WebSocket | null>(null);
  const retriesRef  = useRef(0);
  const timerRef    = useRef<NodeJS.Timeout | null>(null);
  const mountedRef  = useRef(true);
  const [state, setState] = useState<WSState>("disconnected");

  const {
    onMessage, onConnect, onDisconnect,
    reconnect = true,
    maxRetries = 5,
  } = options;

  const connect = useCallback(() => {
    if (!token || !mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setState("connecting");
    const ws = new WebSocket(`${WS_BASE}${path}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      // Send auth token as first message (not in URL)
      ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(e.data);
        if (data.type === "connected") {
          setState("connected");
          retriesRef.current = 0;
          onConnect?.();
          return;
        }
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }
        if (data.type === "error") {
          setState("error");
          return;
        }
        onMessage?.(data);
      } catch {}
    };

    ws.onclose = (e) => {
      if (!mountedRef.current) return;
      setState("disconnected");
      onDisconnect?.();

      if (reconnect && retriesRef.current < maxRetries && e.code !== 4001) {
        const delay = Math.min(1000 * 2 ** retriesRef.current, 30_000);
        retriesRef.current += 1;
        timerRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setState("error");
    };
  }, [token, path, onMessage, onConnect, onDisconnect, reconnect, maxRetries]);

  const disconnect = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    retriesRef.current = maxRetries; // prevent reconnect
    wsRef.current?.close();
    wsRef.current = null;
    setState("disconnected");
  }, [maxRetries]);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (token) connect();
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [token]); // reconnect when token changes

  return { state, send, connect, disconnect };
}
