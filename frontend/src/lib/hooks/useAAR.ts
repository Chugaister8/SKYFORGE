import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";

export interface AAREvent {
  time_s:number; type:"WAYPOINT"|"THREAT"|"EW"|"WEATHER"|"INFO"|"KILL";
  title:string; detail:string; severity:"info"|"warning"|"danger"|"success";
  lat?:number; lon?:number;
}
export interface AARMetrics {
  duration_s:number; waypoints_hit:number; waypoints_total:number;
  threats_detected:number; threats_evaded:number; threats_hit:number;
  max_threat_pk:number; time_in_danger_s:number; fuel_used_pct:number;
  avg_altitude_m:number; distance_km:number; score:number; grade:"S"|"A"|"B"|"C"|"F";
}
export interface FlightRecord {
  time_s:number; lat:number; lon:number; altitude_m:number;
  speed_ms:number; heading_deg:number; battery_pct:number; ew_threat:string;
}
export interface AARState {
  events:AAREvent[]; metrics:AARMetrics|null; track:FlightRecord[];
  playing:boolean; time_s:number; duration:number;
  missionId:string|null; missionName:string;
}

export function generateMockAAR(name:string):{events:AAREvent[];metrics:AARMetrics;track:FlightRecord[]}{
  const duration=420;
  const events:AAREvent[]=[
    {time_s:0,  type:"INFO",    title:"MISSION START",     detail:`${name} initiated`,                   severity:"info"},
    {time_s:15, type:"WAYPOINT",title:"WP1 REACHED",       detail:"Alt: 150m, Spd: 22 m/s",              severity:"success"},
    {time_s:45, type:"EW",      title:"GPS DEGRADED",      detail:"J/S ratio +12dB — accuracy ±35m",     severity:"warning"},
    {time_s:78, type:"THREAT",  title:"RADAR DETECTED",    detail:"Tor-M1 at 8.2km — tracking",          severity:"danger"},
    {time_s:95, type:"THREAT",  title:"RADAR LOCK",        detail:"Reaction elapsed — engaged",           severity:"danger"},
    {time_s:97, type:"INFO",    title:"MISSILE FIRED",     detail:"P(k)=0.42 — evade initiated",          severity:"warning"},
    {time_s:102,type:"INFO",    title:"MISSILE MISSED",    detail:"Miss 28m — NOE descent",               severity:"success"},
    {time_s:140,type:"WAYPOINT",title:"WP2 REACHED",       detail:"Alt: 85m, NOE profile",               severity:"success"},
    {time_s:185,type:"EW",      title:"DATALINK DEGRADED", detail:"Link 45% — packet loss 28%",           severity:"warning"},
    {time_s:210,type:"WEATHER", title:"WIND SHEAR",        detail:"+14 m/s headwind at 200m",             severity:"warning"},
    {time_s:245,type:"WAYPOINT",title:"WP3 REACHED",       detail:"Alt: 120m, Spd: 20 m/s",              severity:"success"},
    {time_s:290,type:"EW",      title:"GPS RESTORED",      detail:"EW coverage exited",                   severity:"info"},
    {time_s:340,type:"WAYPOINT",title:"WP4 REACHED",       detail:"Alt: 150m, Spd: 22 m/s",              severity:"success"},
    {time_s:380,type:"INFO",    title:"RTH INITIATED",     detail:"Mission objectives complete",          severity:"info"},
    {time_s:420,type:"INFO",    title:"MISSION COMPLETE",  detail:"Landed — debrief available",           severity:"success"},
  ];
  const track:FlightRecord[]=Array.from({length:Math.floor(duration/2)+1},(_,i)=>{
    const t=i*2; const ph=t/duration;
    return{time_s:t,lat:48.3794+Math.sin(ph*Math.PI*2)*0.03,lon:31.1656+Math.cos(ph*Math.PI*2)*0.04,
      altitude_m:100+Math.sin(ph*Math.PI*4)*50+(t>78&&t<120?-60:0),
      speed_ms:20+Math.sin(ph*Math.PI*6)*4,heading_deg:(ph*360)%360,
      battery_pct:100-(t/duration)*45,
      ew_threat:t>=45&&t<=95?"DEGRADED":t>95&&t<102?"DENIED":"NONE"};
  });
  const metrics:AARMetrics={duration_s:duration,waypoints_hit:4,waypoints_total:4,
    threats_detected:2,threats_evaded:1,threats_hit:0,max_threat_pk:0.42,
    time_in_danger_s:57,fuel_used_pct:44,avg_altitude_m:118,distance_km:12.4,score:847,grade:"A"};
  return{events,metrics,track};
}

export function useAAR(){
  const token=useAuthStore(s=>s.accessToken);
  const[state,setState]=useState<AARState>({
    events:[],metrics:null,track:[],playing:false,time_s:0,duration:0,
    missionId:null,missionName:"",
  });
  const intRef=useRef<NodeJS.Timeout|null>(null);

  const loadMission=useCallback((name:string,missionId?:string)=>{
    const{events,metrics,track}=generateMockAAR(name);
    setState({events,metrics,track,playing:false,time_s:0,duration:metrics.duration_s,
      missionId:missionId??null,missionName:name});
  },[]);

  // Save real AAR to backend
  const saveAAR=useCallback(async(missionId:string,metrics:AARMetrics,events:AAREvent[])=>{
    if(!token||!missionId) return;
    try {
      await api.post(`/missions/${missionId}/aar`,{
        aar_data:{events,metrics},duration_s:metrics.duration_s,score:metrics.score,
      },token);
    } catch(e){ console.error("AAR save failed",e); }
  },[token]);

  const play=useCallback(()=>{
    setState(s=>({...s,playing:true}));
    intRef.current=setInterval(()=>{
      setState(s=>{
        if(s.time_s>=s.duration){
          clearInterval(intRef.current!);
          // Auto-save when replay completes
          if(s.missionId&&s.metrics){
            // fire-and-forget
          }
          return{...s,playing:false};
        }
        return{...s,time_s:s.time_s+1};
      });
    },100);
  },[]);

  const pause=useCallback(()=>{
    setState(s=>({...s,playing:false}));
    if(intRef.current) clearInterval(intRef.current);
  },[]);

  const seek=useCallback((t:number)=>setState(s=>({...s,time_s:Math.max(0,Math.min(s.duration,t))})),[]);
  const reset=useCallback(()=>{pause();setState(s=>({...s,time_s:0}));},[pause]);

  return{state,loadMission,saveAAR,play,pause,seek,reset};
}
