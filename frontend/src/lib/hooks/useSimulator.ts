import { useState, useRef, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";

export interface SimState {
  x:number;y:number;z:number;vx:number;vy:number;vz:number;
  roll:number;pitch:number;yaw:number;p:number;q:number;r:number;
  throttle:number;actual_throttle:number;fuel_remaining:number;
  airspeed_ms:number;groundspeed_ms:number;altitude_m:number;sim_time_s:number;
}

export interface SimControl {
  roll_cmd:number;pitch_cmd:number;yaw_cmd:number;throttle_cmd:number;
  target_altitude_m?:number;target_heading_deg?:number;
}

export interface EWState {
  gps_effect:string;gps_accuracy_m:number;gps_drift_ms:number;
  spoofed_lat:number|null;spoofed_lon:number|null;
  datalink_effect:string;link_quality:number;packet_loss_pct:number;
  latency_ms:number;radar_warning:boolean;radar_lock:boolean;threat_level:string;
}

const DEFAULT_STATE: SimState = {
  x:0,y:0,z:0,vx:0,vy:0,vz:0,roll:0,pitch:0,yaw:0,
  p:0,q:0,r:0,throttle:0,actual_throttle:0,fuel_remaining:1,
  airspeed_ms:0,groundspeed_ms:0,altitude_m:0,sim_time_s:0,
};

const DEFAULT_EW: EWState = {
  gps_effect:"NONE",gps_accuracy_m:2.5,gps_drift_ms:0,
  spoofed_lat:null,spoofed_lon:null,
  datalink_effect:"NONE",link_quality:1,packet_loss_pct:0,
  latency_ms:50,radar_warning:false,radar_lock:false,threat_level:"NONE",
};

export function useSimulator(libraryId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const [state,   setState]   = useState<SimState>(DEFAULT_STATE);
  const [ewState, setEwState] = useState<EWState>(DEFAULT_EW);
  const [running, setRunning] = useState(false);
  const [wind,    setWindState] = useState({speed:0, dir:0, turb:0});

  // Refs for interval closure (avoid stale state)
  const stateRef   = useRef<SimState>(DEFAULT_STATE);
  const ctrlRef    = useRef<SimControl>({roll_cmd:0,pitch_cmd:0,yaw_cmd:0,throttle_cmd:0});
  const windRef    = useRef({speed:0, dir:0, turb:0});
  const tokenRef   = useRef(token);
  const libRef     = useRef(libraryId);
  const loopRef    = useRef<NodeJS.Timeout|null>(null);

  // Keep refs in sync
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { libRef.current = libraryId; }, [libraryId]);

  const step = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return;
    try {
      const res = await api.post<{state:SimState; diagnostics:Record<string,unknown>}>(
        "/sim/step",
        {
          library_id:   libRef.current,
          state:        stateRef.current,
          control:      ctrlRef.current,
          dt:           0.05,
          wind_speed:   windRef.current.speed,
          wind_dir_deg: windRef.current.dir,
          turbulence:   windRef.current.turb,
        },
        t,
      );
      stateRef.current = res.state;
      setState(res.state);
    } catch (e) {
      // Network error - stop sim
      console.error("Sim step failed:", e);
    }
  }, []);

  const start = useCallback(() => {
    setRunning(true);
    loopRef.current = setInterval(step, 50); // 20Hz
  }, [step]);

  const stop = useCallback(() => {
    setRunning(false);
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
  }, []);

  const reset = useCallback(() => {
    stop();
    const def = { ...DEFAULT_STATE };
    stateRef.current = def;
    setState(def);
    setEwState({ ...DEFAULT_EW });
  }, [stop]);

  const setControl = useCallback((ctrl: Partial<SimControl>) => {
    ctrlRef.current = { ...ctrlRef.current, ...ctrl };
  }, []);

  const setWind = useCallback((w: {speed:number; dir:number; turb:number}) => {
    windRef.current = w;
    setWindState(w);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (loopRef.current) clearInterval(loopRef.current); };
  }, []);

  return { state, ewState, running, wind, start, stop, reset, setControl, setWind };
}
