import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";

export interface Waypoint {
  id:string; lat:number; lon:number; alt_m:number; speed_ms:number;
  action:"WAYPOINT"|"LOITER"|"ORBIT"|"LAND"|"TAKEOFF";
  risk:"SAFE"|"LOW"|"MEDIUM"|"HIGH"|"CRITICAL"; max_pk:number;
}
export interface ThreatSite {
  id:string; name:string; lat:number; lon:number; preset:string; alt_m:number;
}
export interface MissionState {
  id:string|null; name:string; waypoints:Waypoint[]; sites:ThreatSite[];
  uav_rcs:number; uav_speed:number; analyzing:boolean; overall_risk:number;
  saved:boolean; saving:boolean;
}

const DEFAULT:MissionState={
  id:null,name:"MISSION ALPHA",waypoints:[],sites:[],
  uav_rcs:0.1,uav_speed:30,analyzing:false,overall_risk:0,saved:false,saving:false,
};

export interface SavedMission {
  id:string; name:string; status:string; overall_risk:number;
  waypoints:any[]; threat_sites:any[]; uav_rcs:number; uav_speed:number;
  created_at:string; score:number;
}

export function useSavedMissions(limit=50, statusFilter?: string) {
  const token  = useAuthStore(s=>s.accessToken);
  const params = new URLSearchParams({limit: String(limit)});
  if (statusFilter) params.set("status", statusFilter);
  return useQuery<{data:SavedMission[]}>({
    queryKey: ["missions", limit, statusFilter],
    queryFn: async () => {
      // API returns either array (legacy) or paginated {items,total,...}
      const res = await api.get<any>(`/missions/?${params}`, token??undefined);
      const list = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      return { data: list };
    },
    enabled: !!token,
  });
}

export function useMission() {
  const token = useAuthStore(s=>s.accessToken);
  const qc    = useQueryClient();
  const [mission, setMission] = useState<MissionState>(DEFAULT);

  const addWaypoint = useCallback((lat:number, lon:number) => {
    const wp:Waypoint = {
      id:`wp_${Date.now()}`,lat,lon,alt_m:150,speed_ms:20,
      action:"WAYPOINT",risk:"SAFE",max_pk:0,
    };
    setMission(m=>({...m,waypoints:[...m.waypoints,wp],saved:false}));
  },[]);

  const updateWaypoint = useCallback((id:string, changes:Partial<Waypoint>) => {
    setMission(m=>({...m,waypoints:m.waypoints.map(wp=>wp.id===id?{...wp,...changes}:wp),saved:false}));
  },[]);

  const removeWaypoint = useCallback((id:string) => {
    setMission(m=>({...m,waypoints:m.waypoints.filter(wp=>wp.id!==id),saved:false}));
  },[]);

  const addSite = useCallback((lat:number, lon:number, preset:string="tor-m1") => {
    const site:ThreatSite={id:`site_${Date.now()}`,name:preset.toUpperCase(),lat,lon,preset,alt_m:0};
    setMission(m=>({...m,sites:[...m.sites,site],saved:false}));
  },[]);

  const removeSite = useCallback((id:string) => {
    setMission(m=>({...m,sites:m.sites.filter(s=>s.id!==id),saved:false}));
  },[]);

  const analyzeThreat = useCallback(async () => {
    if(!token||mission.waypoints.length<1) return;
    setMission(m=>({...m,analyzing:true}));
    try {
      const res = await api.post<{threat_map:any[];overall_risk:number}>("/sam/mission-threat",{
        waypoints:  mission.waypoints.map(wp=>({lat:wp.lat,lon:wp.lon,alt_m:wp.alt_m})),
        sites:      mission.sites.map(s=>({id:s.id,name:s.name,lat:s.lat,lon:s.lon,preset:s.preset})),
        uav_rcs_m2: mission.uav_rcs, uav_speed_ms: mission.uav_speed,
      }, token);
      setMission(m=>({
        ...m, analyzing:false, overall_risk:res.overall_risk,
        waypoints: m.waypoints.map((wp,i)=>({
          ...wp,
          risk:   (res.threat_map[i]?.risk??"SAFE") as Waypoint["risk"],
          max_pk: res.threat_map[i]?.max_pk??0,
        })),
      }));
    } catch { setMission(m=>({...m,analyzing:false})); }
  },[token,mission.waypoints,mission.sites,mission.uav_rcs,mission.uav_speed]);

  // ── Save ──────────────────────────────────────────────────────────
  const saveMission = useCallback(async () => {
    if(!token) return;
    setMission(m=>({...m,saving:true}));
    try {
      const body = {
        name:         mission.name,
        waypoints:    mission.waypoints,
        threat_sites: mission.sites,
        uav_rcs:      mission.uav_rcs,
        uav_speed:    mission.uav_speed,
        overall_risk: mission.overall_risk,
      };
      if(mission.id) {
        await api.patch(`/missions/${mission.id}`, body, token);
      } else {
        const res = await api.post<{id:string}>("/missions/", body, token);
        setMission(m=>({...m, id: res.id}));
      }
      setMission(m=>({...m,saving:false,saved:true}));
      qc.invalidateQueries({queryKey:["missions"]});
    } catch { setMission(m=>({...m,saving:false})); }
  },[token,mission,qc]);

  // ── Load ──────────────────────────────────────────────────────────
  const loadMission = useCallback((saved:SavedMission) => {
    setMission({
      id:           saved.id,
      name:         saved.name,
      waypoints:    (saved.waypoints??[]).map((wp:any,i:number)=>({
        id:       wp.id??`wp_${i}`,
        lat:      wp.lat, lon: wp.lon,
        alt_m:    wp.alt_m??150, speed_ms: wp.speed_ms??20,
        action:   wp.action??"WAYPOINT",
        risk:     wp.risk??"SAFE", max_pk: wp.max_pk??0,
      })),
      sites:        (saved.threat_sites??[]).map((s:any,i:number)=>({
        id:     s.id??`site_${i}`,
        name:   s.name??s.preset?.toUpperCase()??"SAM",
        lat:    s.lat, lon: s.lon,
        preset: s.preset??"tor-m1", alt_m: s.alt_m??0,
      })),
      uav_rcs:      saved.uav_rcs??0.1,
      uav_speed:    saved.uav_speed??30,
      overall_risk: saved.overall_risk??0,
      analyzing:    false, saving:false, saved:true,
    });
  },[]);

  const deleteMission = useCallback(async (id:string) => {
    if(!token) return;
    await api.delete(`/missions/${id}`, token);
    qc.invalidateQueries({queryKey:["missions"]});
    if(mission.id===id) setMission(DEFAULT);
  },[token,mission.id,qc]);

  const clear = useCallback(()=>setMission(DEFAULT),[]);

  return {
    mission, setMission,
    addWaypoint, updateWaypoint, removeWaypoint,
    addSite, removeSite,
    analyzeThreat, saveMission, loadMission, deleteMission, clear,
  };
}
