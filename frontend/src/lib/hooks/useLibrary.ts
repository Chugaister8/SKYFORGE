import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";

export interface LibraryUnit {
  id:           string;
  name:         string;
  category:     string;
  faction:      string;
  threat_level: string;
  tags:         string[];
  [key: string]: unknown;
}

export interface PagedLibrary {
  units:    LibraryUnit[];
  total:    number;
  limit:    number;
  offset:   number;
  has_more: boolean;
}

export function useLibrary(
  category?: string,
  faction?:  string,
  search?:   string,
  limit = 50,
  offset = 0,
) {
  const token = useAuthStore(s => s.accessToken);
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (faction)  params.set("faction",  faction);
  if (search)   params.set("search",   search);
  params.set("limit",  String(limit));
  params.set("offset", String(offset));

  return useQuery<PagedLibrary>({
    queryKey: ["library", category, faction, search, limit, offset],
    queryFn:  async () => {
      const res = await api.get<any>(`/library/?${params}`, token ?? undefined);
      // Handle both {units,...} and legacy array
      if (Array.isArray(res)) {
        return { units: res, total: res.length, limit, offset, has_more: false } as PagedLibrary;
      }
      // Normalize: backend returns 'units' array
      return res as PagedLibrary;
    },
    enabled:  !!token,
    staleTime: 300_000, // 5 min — library is stable
  });
}

export function useLibraryUnit(id: string | null) {
  const token = useAuthStore(s => s.accessToken);
  return useQuery<LibraryUnit>({
    queryKey: ["library-unit", id],
    queryFn:  () => api.get(`/library/${id}`, token ?? undefined),
    enabled:  !!token && !!id,
    staleTime: 300_000,
  });
}

export function useLibraryStats() {
  const token = useAuthStore(s => s.accessToken);
  return useQuery<{total:number;categories:Record<string,number>;factions:Record<string,number>}>({
    queryKey: ["library-stats"],
    queryFn:  () => api.get("/library/stats", token ?? undefined),
    enabled:  !!token,
  });
}
