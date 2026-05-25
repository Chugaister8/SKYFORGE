"use client";
import { useEffect } from "react";
import { useWebSocket } from "@/lib/hooks/useWebSocket";
import { useTelemetryStore } from "@/lib/store/telemetry.store";
import { useAuthStore } from "@/lib/store/auth.store";

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const { user }         = useAuthStore();
  const setSnapshots     = useTelemetryStore(s => s.setSnapshots);
  const setWsState       = useTelemetryStore(s => s.setWsState);

  const { state: wsState, send } = useWebSocket("/ws/telemetry", {
    onMessage: (data: any) => {
      if (data?.type === "fleet_telemetry" && Array.isArray(data.snapshots)) {
        setSnapshots(data.snapshots);
      }
    },
    onConnect:    () => setWsState("connected"),
    onDisconnect: () => setWsState("disconnected"),
    reconnect:    true,
    maxRetries:   10,
  });

  // Keep store in sync with WS state
  useEffect(() => { setWsState(wsState); }, [wsState, setWsState]);

  return <>{children}</>;
}
