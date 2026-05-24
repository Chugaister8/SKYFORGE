"use client";
import { useWebSocket } from "@/lib/hooks/useWebSocket";
import { useTelemetryStore } from "@/lib/store/telemetry.store";
import { useAuthStore } from "@/lib/store/auth.store";

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const isAuth       = useAuthStore((s) => s.isAuth);
  const setSnapshots = useTelemetryStore((s) => s.setSnapshots);
  useWebSocket({ onTelemetry: isAuth ? setSnapshots : undefined });
  return <>{children}</>;
}
