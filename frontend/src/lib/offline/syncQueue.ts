/**
 * Offline sync queue.
 * When network restores — uploads offline_ missions to server.
 */
import { getCachedMissions, cacheMission, removeCachedMission } from "./missionCache";
import { api } from "@/lib/api";

export interface SyncResult {
  synced:  number;
  failed:  number;
  errors:  string[];
}

/**
 * Syncs all offline-saved missions to the backend.
 * Called automatically when navigator.onLine fires.
 */
export async function syncOfflineMissions(token: string): Promise<SyncResult> {
  const cached  = await getCachedMissions();
  const pending = cached.filter(m => m.id?.startsWith("offline_") || m._offline === true);

  if (!pending.length) return { synced: 0, failed: 0, errors: [] };

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const mission of pending) {
    try {
      const body = {
        name:         mission.name,
        waypoints:    mission.waypoints    ?? [],
        threat_sites: mission.threat_sites ?? [],
        uav_rcs:      mission.uav_rcs      ?? 0.1,
        uav_speed:    mission.uav_speed    ?? 30,
        overall_risk: mission.overall_risk ?? 0,
      };

      // Check if we should create or update
      if (mission.id && !mission.id.startsWith("offline_")) {
        await api.patch(`/missions/${mission.id}`, body, token);
      } else {
        const res = await api.post<{ id: string }>("/missions/", body, token);
        // Replace offline entry with real mission
        await removeCachedMission(mission.id);
        await cacheMission({ ...mission, id: res.id, _offline: false });
      }

      // Remove offline flag
      await removeCachedMission(mission.id);
      synced++;
    } catch (e: any) {
      failed++;
      errors.push(`${mission.name}: ${e.message ?? "unknown error"}`);
    }
  }

  return { synced, failed, errors };
}
