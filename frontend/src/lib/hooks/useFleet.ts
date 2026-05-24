"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";

export interface FleetStats {
  total: number; active: number; offline: number; in_mission: number;
}

export interface TelemetrySnapshot {
  uav_id: string; callsign: string; status: string;
  lat: number | null; lon: number | null;
  altitude_m: number | null; speed_ms: number | null;
  heading_deg: number | null; battery_pct: number | null;
  link_quality: number | null; timestamp: string;
}

export interface UAV {
  id: string; name: string; callsign: string; uav_class: string;
  status: string; max_speed_ms: number; cruise_speed_ms: number;
  max_altitude_m: number; max_range_km: number; endurance_min: number;
  has_eo: boolean; has_ir: boolean; has_lidar: boolean;
}

export function useFleetStats() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<FleetStats>({
    queryKey: ["fleet", "stats"],
    queryFn:  () => api.get<FleetStats>("/fleet/stats", token ?? undefined),
    refetchInterval: 5000,
    enabled: !!token,
  });
}

export function useFleet() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<UAV[]>({
    queryKey: ["fleet"],
    queryFn:  () => api.get<UAV[]>("/fleet/", token ?? undefined),
    refetchInterval: 10000,
    enabled: !!token,
  });
}

export function useTelemetry() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<TelemetrySnapshot[]>({
    queryKey: ["fleet", "telemetry"],
    queryFn:  () => api.get<TelemetrySnapshot[]>("/fleet/telemetry", token ?? undefined),
    refetchInterval: 2000,
    enabled: !!token,
  });
}
