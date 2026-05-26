/**
 * Mission export/import utilities.
 */
import type { SavedMission } from "@/lib/hooks/useMission";

export function exportMissionJSON(mission: SavedMission): void {
  const payload = {
    skyforge_version: "1.0",
    exported_at: new Date().toISOString(),
    mission: {
      name:         mission.name,
      waypoints:    mission.waypoints    ?? [],
      threat_sites: mission.threat_sites ?? [],
      uav_rcs:      mission.uav_rcs      ?? 0.1,
      uav_speed:    mission.uav_speed    ?? 30,
      overall_risk: mission.overall_risk ?? 0,
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), {
    href:     url,
    download: `${mission.name.replace(/\s+/g,"_").toLowerCase()}.skyforge.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  ok:      boolean;
  mission: Partial<SavedMission> | null;
  error:   string;
}

export async function importMissionJSON(file: File): Promise<ImportResult> {
  try {
    const data = JSON.parse(await file.text());
    const raw  = data.skyforge_version ? data.mission : data;
    if (!raw?.name)             return { ok:false, mission:null, error:"Missing mission name" };
    if (!Array.isArray(raw.waypoints)) return { ok:false, mission:null, error:"Invalid waypoints" };

    const waypoints = raw.waypoints
      .filter((w:any) => w.lat!=null && w.lon!=null)
      .map((w:any,i:number) => ({
        id:w.id??`wp_${i}`, lat:Number(w.lat), lon:Number(w.lon),
        alt_m:Number(w.alt_m??150), speed_ms:Number(w.speed_ms??20),
        action:w.action??"WAYPOINT", risk:w.risk??"SAFE", max_pk:Number(w.max_pk??0),
      }));

    const threat_sites = (raw.threat_sites??[])
      .filter((s:any) => s.lat!=null && s.lon!=null)
      .map((s:any,i:number) => ({
        id:s.id??`site_${i}`, name:s.name??s.preset?.toUpperCase()??"SAM",
        lat:Number(s.lat), lon:Number(s.lon), preset:s.preset??"tor-m1", alt_m:Number(s.alt_m??0),
      }));

    return {
      ok:true, error:"",
      mission:{
        name:         String(raw.name).slice(0,128),
        waypoints, threat_sites,
        uav_rcs:      Number(raw.uav_rcs??0.1),
        uav_speed:    Number(raw.uav_speed??30),
        overall_risk: Number(raw.overall_risk??0),
      },
    };
  } catch(e:any) {
    return { ok:false, mission:null, error:`Parse error: ${e.message}` };
  }
}
