import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";

export interface AAREvent {
  time_s:   number;
  type:     "WAYPOINT"|"THREAT"|"EW"|"WEATHER"|"INFO"|"KILL"|"WAYPOINT_REACHED"|"THREAT_DETECTED";
  title:    string;
  detail:   string;
  severity: "info"|"warning"|"danger"|"success";
  lat?:     number;
  lon?:     number;
}

export interface AARMetrics {
  duration_s:       number;
  waypoints_hit:    number;
  waypoints_total:  number;
  threats_detected: number;
  threats_evaded:   number;
  threats_hit:      number;
  max_threat_pk:    number;
  time_in_danger_s: number;
  fuel_used_pct:    number;
  avg_altitude_m:   number;
  distance_km:      number;
  score:            number;
  grade:            "S"|"A"|"B"|"C"|"F";
}

export interface FlightRecord {
  time_s:      number;
  lat:         number;
  lon:         number;
  altitude_m:  number;
  speed_ms:    number;
  heading_deg: number;
  battery_pct: number;
  ew_threat:   string;
}

export interface AARState {
  events:    AAREvent[];
  metrics:   AARMetrics | null;
  track:     FlightRecord[];
  playing:   boolean;
  time_s:    number;
  duration:  number;
  missionId: string | null;
  missionName: string;
  loading:   boolean;
}

// ── Flight log → AAR conversion ──────────────────────────────────

function logToAAREvents(rawEvents: any[]): AAREvent[] {
  const TYPE_MAP: Record<string, {title:(e:any)=>string; detail:(e:any)=>string; severity: AAREvent["severity"]; type: AAREvent["type"]}> = {
    MISSION_START:     { title: () => "MISSION START",       detail: e => `Mission initiated`,                         severity:"info",    type:"INFO" },
    TAKEOFF:           { title: () => "TAKEOFF",             detail: e => `Alt: ${e.data?.alt_m?.toFixed(0)}m`,       severity:"success", type:"INFO" },
    WAYPOINT_REACHED:  { title: e => `WP${(e.data?.index??0)+1} REACHED`, detail: e=>`Alt: ${e.data?.alt_m?.toFixed(0)}m · Spd: ${e.data?.speed_ms?.toFixed(1)}m/s`, severity:"success", type:"WAYPOINT_REACHED" },
    WAYPOINT_MISSED:   { title: e => `WP${(e.data?.index??0)+1} MISSED`, detail: () => "Waypoint not reached",        severity:"warning", type:"WAYPOINT" },
    THREAT_DETECTED:   { title: () => "RADAR DETECTED",      detail: e => `Threat level: ${e.data?.threat_level}`,   severity:"danger",  type:"THREAT_DETECTED" },
    THREAT_LOCKED:     { title: () => "RADAR LOCK",          detail: e => `Engagement initiated`,                     severity:"danger",  type:"THREAT" },
    THREAT_EVADED:     { title: () => "THREAT EVADED",       detail: e => `Miss distance: ${e.data?.miss_m?.toFixed(0)}m`, severity:"success", type:"THREAT" },
    THREAT_HIT:        { title: () => "HIT",                 detail: e => `P(k): ${((e.data?.pk??0)*100).toFixed(0)}%`, severity:"danger", type:"KILL" },
    EW_GPS_DENIED:     { title: () => "GPS DENIED",          detail: e => `Accuracy ±${e.data?.accuracy_m?.toFixed(0)}m`, severity:"warning", type:"EW" },
    EW_LINK_DENIED:    { title: () => "DATALINK DENIED",     detail: () => "C2 link lost",                            severity:"danger",  type:"EW" },
    EW_GPS_RESTORED:   { title: () => "GPS RESTORED",        detail: () => "EW coverage exited",                      severity:"info",    type:"EW" },
    EW_IMPACT:         { title: () => "EW IMPACT",           detail: e => `${e.data?.type}`,                          severity:"warning", type:"EW" },
    BATTERY_LOW:       { title: () => "BATTERY LOW",         detail: e => `${e.data?.battery_pct?.toFixed(0)}% remaining`, severity:"warning", type:"INFO" },
    LAND:              { title: () => "LANDED",              detail: () => "Flight complete",                         severity:"info",    type:"INFO" },
    MISSION_COMPLETE:  { title: () => "MISSION COMPLETE",    detail: e => `Duration: ${Math.round((e.data?.duration_s??0)/60)}min`, severity:"success", type:"INFO" },
  };

  return rawEvents.map(e => {
    const cfg = TYPE_MAP[e.type] ?? {
      title: () => e.type,
      detail: () => JSON.stringify(e.data ?? {}),
      severity: "info" as const,
      type: "INFO" as const,
    };
    return {
      time_s:   e.t ?? 0,
      type:     cfg.type,
      title:    cfg.title(e),
      detail:   cfg.detail(e),
      severity: cfg.severity,
      lat:      e.data?.lat,
      lon:      e.data?.lon,
    };
  });
}

function logToMetrics(log: any, savedScore: number, waypointsTotal: number): AARMetrics {
  const events = log.events ?? [];
  const track  = log.track  ?? [];

  const wpHit    = events.filter((e:any) => e.type === "WAYPOINT_REACHED").length;
  const threats  = events.filter((e:any) => e.type === "THREAT_DETECTED").length;
  const evaded   = events.filter((e:any) => e.type === "THREAT_EVADED").length;
  const hit      = events.filter((e:any) => e.type === "THREAT_HIT").length;
  const maxPk    = Math.max(0, ...events.filter((e:any) => e.type === "THREAT_LOCKED").map((e:any) => e.data?.pk ?? 0));
  const dangerS  = events.filter((e:any) => e.type === "THREAT_DETECTED").length * 15;
  const fuelUsed = track.length > 0 ? 100 - (track[track.length-1]?.battery_pct ?? 100) : 0;
  const avgAlt   = track.length > 0 ? track.reduce((s:number, p:any) => s + (p.alt_m ?? 0), 0) / track.length : 0;

  // Distance from track
  let dist = 0;
  for (let i=1; i<track.length; i++) {
    const a=track[i-1], b=track[i];
    const p=Math.PI/180, R=6371000;
    const x=Math.sin((b.lat-a.lat)*p/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin((b.lon-a.lon)*p/2)**2;
    dist += 2*R*Math.asin(Math.sqrt(x));
  }

  const pct = savedScore / 10;
  const grade = pct >= 95 ? "S" : pct >= 85 ? "A" : pct >= 75 ? "B" : pct >= 65 ? "C" : "F";

  return {
    duration_s:       log.duration_s ?? 0,
    waypoints_hit:    wpHit,
    waypoints_total:  waypointsTotal,
    threats_detected: threats,
    threats_evaded:   evaded,
    threats_hit:      hit,
    max_threat_pk:    maxPk,
    time_in_danger_s: dangerS,
    fuel_used_pct:    fuelUsed,
    avg_altitude_m:   Math.round(avgAlt),
    distance_km:      Math.round(dist / 100) / 10,
    score:            savedScore,
    grade,
  };
}

function trackToFlightRecords(track: any[]): FlightRecord[] {
  return track.map(p => ({
    time_s:      p.t ?? 0,
    lat:         p.lat ?? 0,
    lon:         p.lon ?? 0,
    altitude_m:  p.alt_m ?? 0,
    speed_ms:    p.speed_ms ?? 0,
    heading_deg: p.heading_deg ?? 0,
    battery_pct: p.battery_pct ?? 100,
    ew_threat:   p.ew_threat ?? "NONE",
  }));
}

// ── Mock fallback ─────────────────────────────────────────────────

function makeMockAAR(name: string) {
  const duration=420;
  const events: AAREvent[]=[
    {time_s:0,  type:"INFO",             title:"MISSION START",    detail:`${name} initiated`,              severity:"info"},
    {time_s:15, type:"WAYPOINT_REACHED", title:"WP1 REACHED",      detail:"Alt: 150m, Spd: 22 m/s",         severity:"success"},
    {time_s:45, type:"EW",               title:"GPS DEGRADED",     detail:"J/S +12dB — accuracy ±35m",      severity:"warning"},
    {time_s:78, type:"THREAT_DETECTED",  title:"RADAR DETECTED",   detail:"Tor-M1 at 8.2km",                severity:"danger"},
    {time_s:95, type:"THREAT",           title:"RADAR LOCK",       detail:"Reaction elapsed — engaged",     severity:"danger"},
    {time_s:102,type:"THREAT",           title:"MISSILE MISSED",   detail:"Miss 28m — NOE descent",         severity:"success"},
    {time_s:140,type:"WAYPOINT_REACHED", title:"WP2 REACHED",      detail:"Alt: 85m, NOE profile",          severity:"success"},
    {time_s:245,type:"WAYPOINT_REACHED", title:"WP3 REACHED",      detail:"Alt: 120m, Spd: 20 m/s",         severity:"success"},
    {time_s:340,type:"WAYPOINT_REACHED", title:"WP4 REACHED",      detail:"Alt: 150m, Spd: 22 m/s",         severity:"success"},
    {time_s:420,type:"INFO",             title:"MISSION COMPLETE", detail:"Landed",                          severity:"success"},
  ];
  const track: FlightRecord[]=Array.from({length:Math.floor(duration/2)+1},(_,i)=>{
    const t=i*2; const ph=t/duration;
    return{time_s:t,lat:48.3794+Math.sin(ph*Math.PI*2)*0.03,lon:31.1656+Math.cos(ph*Math.PI*2)*0.04,
      altitude_m:100+Math.sin(ph*Math.PI*4)*50+(t>78&&t<120?-60:0),
      speed_ms:20+Math.sin(ph*Math.PI*6)*4,heading_deg:(ph*360)%360,
      battery_pct:100-(t/duration)*45,ew_threat:t>=45&&t<=95?"DEGRADED":t>95&&t<102?"DENIED":"NONE"};
  });
  const metrics: AARMetrics={duration_s:duration,waypoints_hit:4,waypoints_total:4,
    threats_detected:2,threats_evaded:1,threats_hit:0,max_threat_pk:0.42,
    time_in_danger_s:57,fuel_used_pct:44,avg_altitude_m:118,distance_km:12.4,score:847,grade:"A"};
  return{events,metrics,track};
}

// ── Hook ─────────────────────────────────────────────────────────

export function useAAR() {
  const token = useAuthStore(s => s.accessToken);
  const [state, setState] = useState<AARState>({
    events:[], metrics:null, track:[], playing:false, time_s:0, duration:0,
    missionId:null, missionName:"", loading:false,
  });
  const intRef = useRef<NodeJS.Timeout|null>(null);

  /** Load AAR from a real saved mission — reads flight log from DB. */
  const loadFromMission = useCallback(async (missionId: string, missionName: string, waypointsTotal=0, savedScore=0) => {
    if (!token) return;
    setState(s => ({ ...s, loading:true, missionId, missionName }));
    try {
      const log = await api.get<any>(`/missions/${missionId}/flight-log`, token);
      if (log && log.events?.length > 0) {
        const events  = logToAAREvents(log.events);
        const metrics = logToMetrics(log, savedScore, waypointsTotal);
        const track   = trackToFlightRecords(log.track ?? []);
        setState({ events, metrics, track, playing:false, time_s:0,
          duration: log.duration_s ?? metrics.duration_s,
          missionId, missionName, loading:false });
      } else {
        // No flight log yet — use mock
        const mock = makeMockAAR(missionName);
        setState({ ...mock, playing:false, time_s:0,
          duration: mock.metrics.duration_s, missionId, missionName, loading:false });
      }
    } catch {
      const mock = makeMockAAR(missionName);
      setState({ ...mock, playing:false, time_s:0,
        duration: mock.metrics.duration_s, missionId, missionName, loading:false });
    }
  }, [token]);

  /** Load demo mission (no DB). */
  const loadDemo = useCallback((name: string) => {
    const mock = makeMockAAR(name);
    setState({ ...mock, playing:false, time_s:0,
      duration: mock.metrics.duration_s, missionId:null, missionName:name, loading:false });
  }, []);

  const saveAAR = useCallback(async (missionId: string, metrics: AARMetrics, events: AAREvent[]) => {
    if (!token || !missionId) return;
    try {
      await api.post(`/missions/${missionId}/aar`, {
        aar_data:   { events, metrics },
        duration_s: metrics.duration_s,
        score:      metrics.score,
      }, token);
    } catch(e){ console.error("AAR save:", e); }
  }, [token]);

  const play = useCallback(() => {
    setState(s => ({ ...s, playing:true }));
    intRef.current = setInterval(() => {
      setState(s => {
        if (s.time_s >= s.duration) { clearInterval(intRef.current!); return { ...s, playing:false }; }
        return { ...s, time_s: s.time_s + 1 };
      });
    }, 100);
  }, []);

  const pause  = useCallback(() => { setState(s=>({...s,playing:false})); if(intRef.current) clearInterval(intRef.current); }, []);
  const seek   = useCallback((t:number) => setState(s=>({...s,time_s:Math.max(0,Math.min(s.duration,t))})), []);
  const reset  = useCallback(() => { pause(); setState(s=>({...s,time_s:0})); }, [pause]);

  return { state, loadFromMission, loadDemo, saveAAR, play, pause, seek, reset };
}
