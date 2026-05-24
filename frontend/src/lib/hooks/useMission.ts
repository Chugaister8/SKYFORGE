import { useState, useCallback } from "react";
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
  name:string; waypoints:Waypoint[]; sites:ThreatSite[];
  uav_rcs:number; uav_speed:number; analyzing:boolean; overall_risk:number;
}

const DEFAULT:MissionState={name:"MISSION ALPHA",waypoints:[],sites:[],uav_rcs:0.1,uav_speed:30,analyzing:false,overall_risk:0};

export function useMission(){
  const token=useAuthStore(s=>s.accessToken);
  const [mission,setMission]=useState<MissionState>(DEFAULT);

  const addWaypoint=useCallback((lat:number,lon:number)=>{
    const wp:Waypoint={id:`wp_${Date.now()}`,lat,lon,alt_m:150,speed_ms:20,action:"WAYPOINT",risk:"SAFE",max_pk:0};
    setMission(m=>({...m,waypoints:[...m.waypoints,wp]}));
  },[]);

  const updateWaypoint=useCallback((id:string,changes:Partial<Waypoint>)=>{
    setMission(m=>({...m,waypoints:m.waypoints.map(wp=>wp.id===id?{...wp,...changes}:wp)}));
  },[]);

  const removeWaypoint=useCallback((id:string)=>{
    setMission(m=>({...m,waypoints:m.waypoints.filter(wp=>wp.id!==id)}));
  },[]);

  const addSite=useCallback((lat:number,lon:number,preset:string="tor-m1")=>{
    const site:ThreatSite={id:`site_${Date.now()}`,name:preset.toUpperCase(),lat,lon,preset,alt_m:0};
    setMission(m=>({...m,sites:[...m.sites,site]}));
  },[]);

  const removeSite=useCallback((id:string)=>{
    setMission(m=>({...m,sites:m.sites.filter(s=>s.id!==id)}));
  },[]);

  const analyzeThreat=useCallback(async()=>{
    if(!token||mission.waypoints.length<1) return;
    setMission(m=>({...m,analyzing:true}));
    try{
      const res=await api.post<{threat_map:any[];overall_risk:number}>("/sam/mission-threat",{
        waypoints:mission.waypoints.map(wp=>({lat:wp.lat,lon:wp.lon,alt_m:wp.alt_m})),
        sites:mission.sites.map(s=>({id:s.id,name:s.name,lat:s.lat,lon:s.lon,preset:s.preset})),
        uav_rcs_m2:mission.uav_rcs,uav_speed_ms:mission.uav_speed,
      },token);
      setMission(m=>({...m,analyzing:false,overall_risk:res.overall_risk,
        waypoints:m.waypoints.map((wp,i)=>({...wp,risk:(res.threat_map[i]?.risk??"SAFE") as Waypoint["risk"],max_pk:res.threat_map[i]?.max_pk??0}))}));
    }catch{setMission(m=>({...m,analyzing:false}));}
  },[token,mission.waypoints,mission.sites,mission.uav_rcs,mission.uav_speed]);

  const clear=useCallback(()=>setMission(DEFAULT),[]);
  return{mission,addWaypoint,updateWaypoint,removeWaypoint,addSite,removeSite,analyzeThreat,clear,setMission};
}
