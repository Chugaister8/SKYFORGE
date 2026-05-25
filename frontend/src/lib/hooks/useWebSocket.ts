"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { useAuthStore } from "@/lib/store/auth.store";

export interface TelemetrySnapshot {
  uav_id: string; callsign: string; status: string;
  lat: number; lon: number; altitude_m: number; speed_ms: number;
  heading_deg: number; battery_pct: number; link_quality: number; timestamp: string;
}

interface UseWebSocketOptions { onTelemetry?: (s: TelemetrySnapshot[]) => void; }

function getWsUrl() {
  if (typeof window === "undefined") return "ws://localhost:8000";
  const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsHost  = process.env.NEXT_PUBLIC_WS_URL
    ? process.env.NEXT_PUBLIC_WS_URL.replace(/^https?/, wsProto.slice(0,-1))
    : `${wsProto}//${window.location.host}`;
  return wsHost;
}

export function useWebSocket({ onTelemetry }: UseWebSocketOptions = {}) {
  const token     = useAuthStore((s) => s.accessToken);
  const wsRef     = useRef<WebSocket | null>(null);
  const pingRef   = useRef<NodeJS.Timeout | null>(null);
  const reconnRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const [connected, setConnected] = useState(false);
  const onTelRef  = useRef(onTelemetry);
  onTelRef.current = onTelemetry;

  const connect = useCallback(() => {
    if (!token || !mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const wsBase = getWsUrl();
      const ws = new WebSocket(`${wsBase}/ws/telemetry?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        setConnected(true);
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 30_000);
      };

      ws.onmessage = (e) => {
        if (e.data === "pong") return;
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "fleet_telemetry" && onTelRef.current) {
            onTelRef.current(msg.snapshots);
          }
        } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
        if (mountedRef.current) {
          reconnRef.current = setTimeout(connect, 3_000);
        }
      };

      ws.onerror = () => ws.close();
    } catch (e) {
      console.warn("WebSocket connect failed:", e);
    }
  }, [token]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (pingRef.current)  clearInterval(pingRef.current);
      if (reconnRef.current) clearTimeout(reconnRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected };
}
