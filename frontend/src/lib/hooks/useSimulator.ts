/**
 * Simulator hook — mission-aware.
 * - Loads waypoints from a mission
 * - Runs autopilot toward each waypoint
 * - Writes events/track to flight log
 * - Detects SAM threats from mission sites
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
  // World position (lat/lon derived)
  lat:number; lon:number;
}

export interface SimControl {
  roll_cmd:number; pitch_cmd:number; yaw_cmd:number; throttle_cmd:number;
  target_altitude_m?:number; target_heading_deg?:number;
}

export interface EWState {
  gps_effect:string; gps_accuracy_m:number; gps_drift_ms:number;
  spoofed_lat:number|null; spoofed_lon:number|null;
  datalink_effect:string; link_quality:number; packet_loss_pct:number;
  latency_ms:number; radar_warning:boolean; radar_lock:boolean; threat_level:string;
}

export interface WaypointStatus {
  index:   number;
  reached: boolean;
  dist_m:  number;
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

// Rough conversion: metres to degrees lat/lon
const M_TO_LAT = 1 / 111320;
const mToLon = (lat: number) => 1 / (111320 * Math.cos(lat * Math.PI / 180));

const haversine = (lat1:number,lon1:number,lat2:number,lon2:number) => {
  const R=6371000, p=Math.PI/180;
  const a=Math.sin((lat2-lat1)*p/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
};

export function useSimulator(libraryId: string, mission?: SavedMission | null) {
  const token = useAuthStore(s => s.accessToken);

  const [state,    setState]    = useState<SimState>(DEFAULT_STATE);
  const [ewState,  setEwState]  = useState<EWState>(DEFAULT_EW);
  const [running,  setRunning]  = useState(false);
  const [wind,     setWindState]= useState({speed:0,dir:0,turb:0});
  const [wpStatus, setWpStatus] = useState<WaypointStatus>({index:0,reached:false,dist_m:999});
  const [missionComplete, setMissionComplete] = useState(false);

  const stateRef   = useRef<SimState>(DEFAULT_STATE);
  const ctrlRef    = useRef<SimControl>({roll_cmd:0,pitch_cmd:0,yaw_cmd:0,throttle_cmd:0});
  const windRef    = useRef({speed:0,dir:0,turb:0});
  const tokenRef   = useRef(token);
  const libRef     = useRef(libraryId);
  const loopRef    = useRef<NodeJS.Timeout|null>(null);
  const wpIndexRef = useRef(0);
  const trackTickRef = useRef(0);
  const ewRef      = useRef<EWState>(DEFAULT_EW);

  const flightLog = useFlightLog(mission?.id ?? null);

  useEffect(() => { tokenRef.current   = token;     }, [token]);
  useEffect(() => { libRef.current     = libraryId; }, [libraryId]);
  useEffect(() => { stateRef.current   = state;     }, [state]);
  useEffect(() => { ewRef.current      = ewState;   }, [ewState]);

  // ── Autopilot: steer toward next waypoint ────────────────────
  const applyAutopilot = useCallback(() => {
    const waypoints = mission?.waypoints ?? [];
    if (!waypoints.length || wpIndexRef.current >= waypoints.length) return;

    const wp      = waypoints[wpIndexRef.current];
    const cur     = stateRef.current;
    const dist    = haversine(cur.lat, cur.lon, wp.lat, wp.lon);
    const altDiff = (wp.alt_m ?? 150) - cur.altitude_m;

    // Bearing to waypoint
    const p    = Math.PI / 180;
    const dLon = (wp.lon - cur.lon) * p;
    const x    = Math.sin(dLon) * Math.cos(wp.lat * p);
    const y    = Math.cos(cur.lat * p) * Math.sin(wp.lat * p)
               - Math.sin(cur.lat * p) * Math.cos(wp.lat * p) * Math.cos(dLon);
    const targetHeading = (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;

    ctrlRef.current = {
      roll_cmd:           Math.max(-0.3, Math.min(0.3, (targetHeading - cur.yaw * 180 / Math.PI) / 90)),
      pitch_cmd:          Math.max(-0.2, Math.min(0.2, altDiff / 100)),
      yaw_cmd:            0,
      throttle_cmd:       dist > 20 ? 0.65 : 0.3,
      target_altitude_m:  wp.alt_m ?? 150,
      target_heading_deg: targetHeading,
    };

    // Waypoint reached threshold: 30m
    if (dist < 30) {
      flightLog.logEvent("WAYPOINT_REACHED", {
        index: wpIndexRef.current,
        wp_id: wp.id,
        alt_m: cur.altitude_m,
        speed_ms: cur.groundspeed_ms,
      });
      wpIndexRef.current += 1;
      if (wpIndexRef.current >= waypoints.length) {
        setMissionComplete(true);
        flightLog.logEvent("MISSION_COMPLETE", { total_wp: waypoints.length });
      }
    }

    setWpStatus({ index: wpIndexRef.current, reached: dist < 30, dist_m: dist });
  }, [mission, flightLog]);

  // ── Detect threats from mission sites ────────────────────────
  const checkThreats = useCallback(() => {
    const sites = mission?.threat_sites ?? [];
    const cur   = stateRef.current;
    const ew    = ewRef.current;

    if (ew.radar_warning && !ew.radar_lock) {
      // Already tracking — check lock
    }
    if (ew.radar_lock) {
      flightLog.logEvent("THREAT_LOCKED", {
        threat_level: ew.threat_level,
        lat: cur.lat, lon: cur.lon, alt_m: cur.altitude_m,
      });
    }
  }, [mission, flightLog]);

  // ── Update derived lat/lon from physics state ─────────────────
  const updatePosition = useCallback((physState: Omit<SimState,"lat"|"lon">) => {
    const prev = stateRef.current;
    const dt   = 0.05;
    const newLat = prev.lat + physState.vy * dt * M_TO_LAT;
    const newLon = prev.lon + physState.vx * dt * mToLon(prev.lat);
    return { ...physState, lat: newLat, lon: newLon };
  }, []);

  // ── Physics step ─────────────────────────────────────────────
  const step = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return;

    // Autopilot
    if (mission?.waypoints?.length) applyAutopilot();

    try {
      const res = await api.post<{state:Omit<SimState,"lat"|"lon">; diagnostics:Record<string,unknown>}>(
        "/sim/step", {
          library_id:   libRef.current,
          state:        stateRef.current,
          control:      ctrlRef.current,
          dt:           0.05,
          wind_speed:   windRef.current.speed,
          wind_dir_deg: windRef.current.dir,
          turbulence:   windRef.current.turb,
        }, t,
      );

      const withPos = updatePosition(res.state);
      stateRef.current = withPos;
      setState(withPos);

      // Track point every 2s (40 steps @ 20Hz)
      trackTickRef.current += 1;
      if (trackTickRef.current % 40 === 0) {
        flightLog.logTrack({
          lat:         withPos.lat,
          lon:         withPos.lon,
          alt_m:       withPos.altitude_m,
          speed_ms:    withPos.groundspeed_ms,
          heading_deg: withPos.yaw * 180 / Math.PI,
          battery_pct: withPos.fuel_remaining * 100,
          ew_threat:   ewRef.current.threat_level,
        });
        checkThreats();
      }

      // Battery warning
      if (withPos.fuel_remaining < 0.2 && withPos.fuel_remaining > 0.19) {
        flightLog.logEvent("BATTERY_LOW", { battery_pct: withPos.fuel_remaining * 100 });
      }
    } catch {}
  }, [applyAutopilot, checkThreats, updatePosition, flightLog, mission]);

  const start = useCallback(() => {
    setRunning(true);
    setMissionComplete(false);
    wpIndexRef.current = 0;
    trackTickRef.current = 0;
    flightLog.start();
    flightLog.logEvent("TAKEOFF", {
      lat:   stateRef.current.lat,
      lon:   stateRef.current.lon,
      alt_m: stateRef.current.altitude_m,
    });
    loopRef.current = setInterval(step, 50); // 20Hz
  }, [step, flightLog]);

  const stop = useCallback(async () => {
    setRunning(false);
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
    flightLog.logEvent("LAND", {
      lat:   stateRef.current.lat,
      lon:   stateRef.current.lon,
      alt_m: stateRef.current.altitude_m,
    });
    await flightLog.stop();
  }, [flightLog]);

  const reset = useCallback(() => {
    stop();
    const def = { ...DEFAULT_STATE };
    // Start at mission origin if available
    if (mission?.waypoints?.[0]) {
      def.lat = mission.waypoints[0].lat;
      def.lon = mission.waypoints[0].lon;
    }
    stateRef.current = def;
    setState(def);
    setEwState({ ...DEFAULT_EW });
    wpIndexRef.current = 0;
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
      // Log EW state transitions
      if (ew.gps_effect === "DENIED" && prev.gps_effect !== "DENIED") {
        flightLog.logEvent("EW_GPS_DENIED", { accuracy_m: ew.gps_accuracy_m });
      }
      if (ew.gps_effect === "NONE" && prev.gps_effect === "DENIED") {
        flightLog.logEvent("EW_GPS_RESTORED", {});
      }
      if (ew.radar_warning && !prev.radar_warning) {
        flightLog.logEvent("THREAT_DETECTED", { threat_level: ew.threat_level });
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
