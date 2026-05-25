import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";

export interface UAV {
  id:               string;
  name:             string;
  callsign:         string;
  uav_class:        string;
  manufacturer:     string | null;
  model:            string | null;
  status:           "ONLINE"|"OFFLINE"|"IN_MISSION"|"MAINTENANCE"|"LOST";
  mass_kg:          number;
  max_speed_ms:     number;
  cruise_speed_ms:  number;
  max_altitude_m:   number;
  max_range_km:     number;
  endurance_min:    number;
  has_eo:           boolean;
  has_ir:           boolean;
  rcs_m2:           number | null;
  created_at:       string;
}

export interface TelemetrySnapshot {
  uav_id:      string;
  callsign:    string;
  status:      string;
  lat:         number | null;
  lon:         number | null;
  altitude_m:  number | null;
  speed_ms:    number | null;
  heading_deg: number | null;
  battery_pct: number | null;
  link_quality:number | null;
  timestamp:   string;
}

export interface PagedFleet {
  items:    UAV[];
  total:    number;
  limit:    number;
  offset:   number;
  has_more: boolean;
}

export function useFleet(limit = 50, statusFilter?: string) {
  const token = useAuthStore(s => s.accessToken);
  const path  = statusFilter
    ? `/fleet/?limit=${limit}&status=${statusFilter}`
    : `/fleet/?limit=${limit}`;

  return useQuery<PagedFleet>({
    queryKey: ["fleet", limit, statusFilter],
    queryFn:  () => api.get(path, token ?? undefined),
    enabled:  !!token,
    staleTime: 10_000,
  });
}

export function useFleetStats() {
  const token = useAuthStore(s => s.accessToken);
  return useQuery<{total:number;active:number;offline:number;in_mission:number}>({
    queryKey: ["fleet-stats"],
    queryFn:  () => api.get("/fleet/stats", token ?? undefined),
    enabled:  !!token,
    refetchInterval: 30_000,
  });
}

export function useTelemetry() {
  const token = useAuthStore(s => s.accessToken);
  return useQuery<TelemetrySnapshot[]>({
    queryKey: ["telemetry"],
    queryFn:  () => api.get("/fleet/telemetry", token ?? undefined),
    enabled:  !!token,
    refetchInterval: 2_000,
  });
}

export function useCreateUAV() {
  const token = useAuthStore(s => s.accessToken);
  const qc    = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<UAV>) =>
      api.post<UAV>("/fleet/", data, token ?? undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fleet"] }),
  });
}

export function useUpdateUAV() {
  const token = useAuthStore(s => s.accessToken);
  const qc    = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<UAV> & { id: string }) =>
      api.patch<UAV>(`/fleet/${id}`, data, token ?? undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fleet"] });
      qc.invalidateQueries({ queryKey: ["fleet-stats"] });
    },
  });
}

export function useDeleteUAV() {
  const token = useAuthStore(s => s.accessToken);
  const qc    = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/fleet/${id}`, token ?? undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fleet"] });
      qc.invalidateQueries({ queryKey: ["fleet-stats"] });
    },
  });
}
