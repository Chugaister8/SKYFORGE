/**
 * Simulator hook — mission-aware, EW-integrated.
 * Fixes:
 *  - Position drift: uses mToLon(lat) not constant
 *  - EW state sent to /api/sim/step
 *  - Autopilot uses corrected bearing
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";
import { useFlightLog } from "./useFlightLog";
import type { SavedMission } from "./useMission";

export interface SimState {
  x:number; y:number; z:number;
  vx:number; vy:number; vz:number;
  roll:number; pitch:number; yaw:number;
  p:number; q:number; r:number;
  throttle:number; actual_throttle:number; fuel_remaining:number;
  airspeed_ms:number; groundspeed_ms:number; altitude_m:number;
  sim_time_s:number;
  lat:number; lon:number;
}

export interface SimControl {
  roll_cmd:number; pitch_cmd:number; yaw_cmd:number; throttle_cmd:number;
}

export interface EWState {
  gps_effect:string;    gps_accuracy_m:number;  gps_drift_ms:number;
  spoofed_lat:number|null; spoofed_lon:number|null;
  datalink_effect:string; link_quality:number;    packet_loss_pct:number;
  latency_ms:number;    radar_warning:boolean;  radar_lock:boolean;
  threat_level:string;
}

export interface WaypointStatus {
  index:  number;
  dist_m: number;
}

const DEFAULT_STATE: SimState = {
  x:0,y:0,z:0,vx:0,vy:0,vz:0,roll:0,pitch:0,yaw:0,
  p:0,q:0,r:0,throttle:0,actual_throttle:0,fuel_remaining:1,
  airspeed_ms:0,groundspeed_ms:0,altitude_m:0,sim_time_s:0,
  lat:48.3794,lon:31.1656,
};

const DEFAULT_EW: EWState = {
  gps_effect:"NONE",gps_accuracy_m:2.5,gps_drift_ms:0,
  spoofed_lat:null,spoofed_lon:null,
  datalink_effect:"NONE",link_quality:1,packet_loss_pct:0,
  latency_ms:50,radar_warning:false,radar_lock:false,threat_level:"NONE",
};

// ── Geo helpers ────────────────────────────────────────────────
const EARTH_R    = 6_371_000.0;
const M_TO_LAT   = 1 / 111_320.0;
const mToLon     = (lat: number) => 1 / (111_320.0 * Math.cos(lat * Math.PI / 180));

function haversine(lat1:number,lon1:number,lat2:number,lon2:number): number {
  const p = Math.PI/180;
  const a = Math.sin((lat2-lat1)*p/2)**2
          + Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2;
  return 2*EARTH_R*Math.asin(Math.sqrt(Math.max(0,a)));
}

function bearing(lat1:number,lon1:number,lat2:number,lon2:number): number {
  const p   = Math.PI/180;
  const dLon = (lon2-lon1)*p;
  const x   = Math.sin(dLon)*Math.cos(lat2*p);
  const y   = Math.cos(lat1*p)*Math.sin(lat2*p)
             - Math.sin(lat1*p)*Math.cos(lat2*p)*Math.cos(dLon);
  return Math.atan2(x,y); // radians
}

// ── EW state → API payload ─────────────────────────────────────
function ewToPayload(ew: EWState) {
  return {
    gps_denied:         ew.gps_effect === "DENIED",
    gps_accuracy_m:     ew.gps_accuracy_m,
    link_quality:       ew.link_quality,
    datalink_denied:    ew.datalink_effect === "DENIED",
    control_latency_ms: ew.latency_ms,
    nav_drift_ms:       ew.gps_drift_ms,
  };
}

export function useSimulator(libraryId: string, mission?: SavedMission | null) {
  const token = useAuthStore(s => s.accessToken);

  const [state,          setState]     = useState<SimState>(DEFAULT_STATE);
  const [ewState,        setEwState]   = useState<EWState>(DEFAULT_EW);
  const [running,        setRunning]   = useState(false);
  const [wind,           setWindState] = useState({speed:0,dir:0,turb:0});
  const [wpStatus,       setWpStatus]  = useState<WaypointStatus>({index:0,dist_m:999});
  const [missionComplete,setMissionComplete] = useState(false);

  // Refs — avoid stale closures in setInterval
  const stateRef   = useRef<SimState>(DEFAULT_STATE);
  const ctrlRef    = useRef<SimControl>({roll_cmd:0,pitch_cmd:0,yaw_cmd:0,throttle_cmd:0});
  const windRef    = useRef({speed:0,dir:0,turb:0});
  const ewRef      = useRef<EWState>(DEFAULT_EW);
  const tokenRef   = useRef(token);
  const libRef     = useRef(libraryId);
  const loopRef    = useRef<NodeJS.Timeout|null>(null);
  const wpIdxRef   = useRef(0);
  const trackTick  = useRef(0);

  const flightLog  = useFlightLog(mission?.id ?? null);

  // Keep refs current
  useEffect(()=>{ tokenRef.current = token; },      [token]);
  useEffect(()=>{ libRef.current   = libraryId; },  [libraryId]);
  useEffect(()=>{ stateRef.current = state; },      [state]);
  useEffect(()=>{ ewRef.current    = ewState; },    [ewState]);

  // ── Autopilot ─────────────────────────────────────────────────
  const applyAutopilot = useCallback(() => {
    const wps = mission?.waypoints ?? [];
    if (!wps.length || wpIdxRef.current >= wps.length) return;

    const wp    = wps[wpIdxRef.current];
    const cur   = stateRef.current;
    const dist  = haversine(cur.lat, cur.lon, wp.lat, wp.lon);
    const altDiff = (wp.alt_m ?? 150) - cur.altitude_m;

    const bear  = bearing(cur.lat, cur.lon, wp.lat, wp.lon); // radians
    const headingErr = bear - cur.yaw;

    ctrlRef.current = {
      roll_cmd:     Math.max(-0.4, Math.min(0.4, headingErr * 0.5)),
      pitch_cmd:    Math.max(-0.2, Math.min(0.2, altDiff / 100)),
      yaw_cmd:      0,
      throttle_cmd: dist > 20 ? 0.65 : 0.3,
    };

    if (dist < 30) {
      flightLog.logEvent("WAYPOINT_REACHED", {
        index: wpIdxRef.current, wp_id: wp.id,
        alt_m: cur.altitude_m, speed_ms: cur.groundspeed_ms,
      });
      wpIdxRef.current += 1;
      if (wpIdxRef.current >= wps.length) {
        setMissionComplete(true);
        flightLog.logEvent("MISSION_COMPLETE", { total_wp: wps.length });
      }
    }
    setWpStatus({ index: wpIdxRef.current, dist_m: dist });
  }, [mission, flightLog]);

  // ── Physics step ──────────────────────────────────────────────
  const step = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return;

    if (mission?.waypoints?.length) applyAutopilot();

    try {
      const res = await api.post<{state:Omit<SimState,"lat"|"lon">; diagnostics:Record<string,unknown>}>(
        "/sim/step",
        {
          library_id:   libRef.current,
          state:        stateRef.current,
          control:      ctrlRef.current,
          dt:           0.05,
          wind_speed:   windRef.current.speed,
          wind_dir_deg: windRef.current.dir,
          turbulence:   windRef.current.turb,
          // ── EW state now sent to backend ──────────────────
          ew: ewToPayload(ewRef.current),
        },
        t,
      );

      // Update lat/lon from vx/vy with latitude-corrected lon conversion
      const prev = stateRef.current;
      const dt   = 0.05;

      // vx = east component (m/s), vy = north component (m/s)
      const newLat = prev.lat + res.state.vy * dt * M_TO_LAT;
      const newLon = prev.lon + res.state.vx * dt * mToLon(prev.lat); // ← fix: use prev.lat

      const withPos: SimState = { ...res.state, lat: newLat, lon: newLon };
      stateRef.current = withPos;
      setState(withPos);

      // Track snapshot every 2s (40 × 50ms)
      trackTick.current += 1;
      if (trackTick.current % 40 === 0) {
        flightLog.logTrack({
          lat:         withPos.lat,
          lon:         withPos.lon,
          alt_m:       withPos.altitude_m,
          speed_ms:    withPos.groundspeed_ms,
          heading_deg: withPos.yaw * 180 / Math.PI,
          battery_pct: withPos.fuel_remaining * 100,
          ew_threat:   ewRef.current.threat_level,
        });
      }

      // Battery warning (once, near 20%)
      if (withPos.fuel_remaining < 0.20 && withPos.fuel_remaining > 0.195) {
        flightLog.logEvent("BATTERY_LOW", { battery_pct: withPos.fuel_remaining * 100 });
      }
    } catch {}
  }, [applyAutopilot, flightLog, mission]);

  const start = useCallback(() => {
    setRunning(true);
    setMissionComplete(false);
    wpIdxRef.current  = 0;
    trackTick.current = 0;
    flightLog.start();
    flightLog.logEvent("TAKEOFF", {
      lat: stateRef.current.lat,
      lon: stateRef.current.lon,
      alt_m: stateRef.current.altitude_m,
    });
    loopRef.current = setInterval(step, 50); // 20Hz
  }, [step, flightLog]);

  const stop = useCallback(async () => {
    setRunning(false);
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
    flightLog.logEvent("LAND", {
      lat: stateRef.current.lat, lon: stateRef.current.lon,
      alt_m: stateRef.current.altitude_m,
    });
    await flightLog.stop();
  }, [flightLog]);

  const reset = useCallback(() => {
    stop();
    const def = { ...DEFAULT_STATE };
    if (mission?.waypoints?.[0]) {
      def.lat = mission.waypoints[0].lat;
      def.lon = mission.waypoints[0].lon;
    }
    stateRef.current = def;
    setState(def);
    setEwState({ ...DEFAULT_EW });
    wpIdxRef.current = 0;
    setMissionComplete(false);
  }, [stop, mission]);

  const setControl = useCallback((ctrl: Partial<SimControl>) => {
    ctrlRef.current = { ...ctrlRef.current, ...ctrl };
  }, []);

  const setWind = useCallback((w: {speed:number;dir:number;turb:number}) => {
    windRef.current = w; setWindState(w);
  }, []);

  const updateEW = useCallback((ew: Partial<EWState>) => {
    setEwState(prev => {
      const next = { ...prev, ...ew };
      if (ew.gps_effect === "DENIED" && prev.gps_effect !== "DENIED") {
        flightLog.logEvent("EW_GPS_DENIED", { accuracy_m: ew.gps_accuracy_m });
      }
      if (ew.gps_effect === "NONE" && prev.gps_effect === "DENIED") {
        flightLog.logEvent("EW_GPS_RESTORED", {});
      }
      if (ew.radar_warning && !prev.radar_warning) {
        flightLog.logEvent("THREAT_DETECTED", { threat_level: ew.threat_level });
      }
      if (ew.datalink_effect === "DENIED" && prev.datalink_effect !== "DENIED") {
        flightLog.logEvent("EW_LINK_DENIED", {});
      }
      return next;
    });
  }, [flightLog]);

  useEffect(() => () => {
    if (loopRef.current) clearInterval(loopRef.current);
  }, []);

  return {
    state, ewState, running, wind, wpStatus, missionComplete,
    start, stop, reset, setControl, setWind, updateEW,
    flightLog,
  };
}
