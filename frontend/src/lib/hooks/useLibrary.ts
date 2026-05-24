import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Faction     = "FRIENDLY" | "HOSTILE" | "NEUTRAL";
export type Category    = "UAV" | "AIR_DEFENSE" | "EW_SYSTEM" | "GROUND_VEHICLE" | "NAVAL" | "STATIC";
export type ThreatLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface LibraryMeta {
  id: string; name: string; faction: Faction; category: Category;
  subtype: string; country: string; threat_level: ThreatLevel;
  tags: string[]; image_url: string | null;
}

interface LibraryFilters {
  faction?: Faction; category?: Category; search?: string;
}

export function useLibrary(filters: LibraryFilters = {}) {
  const params = new URLSearchParams();
  if (filters.faction)  params.set("faction",  filters.faction);
  if (filters.category) params.set("category", filters.category);
  if (filters.search)   params.set("search",   filters.search);
  const query = params.toString();
  return useQuery<LibraryMeta[]>({
    queryKey: ["library", filters],
    queryFn:  () => api.get<LibraryMeta[]>(`/library/${query ? `?${query}` : ""}`),
    staleTime: 60_000,
  });
}

export function useLibraryEntry(id: string | null) {
  return useQuery({
    queryKey: ["library", "entry", id],
    queryFn:  () => api.get(`/library/${id}`),
    enabled:  !!id,
    staleTime: 300_000,
  });
}
