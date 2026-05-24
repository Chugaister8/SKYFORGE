"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { useAuthStore } from "@/lib/store/auth.store";
import { WS_URL } from "@/lib/constants";

export interface TelemetrySnapshot {
  uav_id: string; callsign: string; status: string;
  lat: number; lon: number; altitude_m: number; speed_ms: number;
  heading_deg: number; battery_pct: number; link_quality: number; timestamp: string;
}

interface UseWebSocketOptions { onTelemetry?: (s: TelemetrySnapshot[]) => void; }

export function useWebSocket({ onTelemetry }: UseWebSocketOptions = {}) {
  const token   = useAuthStore((s) => s.accessToken);
  const wsRef   = useRef<WebSocket | null>(null);
  const pingRef = useRef<NodeJS.Timeout | null>(null);
  const reconnRef = useRef<NodeJS.Timeout | null>(null);
  const [connected, setConnected] = useState(false);
  const onTelRef = useRef(onTelemetry);
  onTelRef.current = onTelemetry;

  const connect = useCallback(() => {
    if (!token) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(`${WS_URL}/ws/telemetry?token=${token}`);
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      pingRef.current = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send("ping"); }, 30_000);
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "fleet_telemetry" && onTelRef.current) onTelRef.current(msg.snapshots);
      } catch {}
    };
    ws.onclose = () => {
      setConnected(false);
      if (pingRef.current) clearInterval(pingRef.current);
      reconnRef.current = setTimeout(connect, 3_000);
    };
    ws.onerror = () => ws.close();
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      if (reconnRef.current) clearTimeout(reconnRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected };
}
