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
  const [wind,    setWind]    = useState({speed:0,dir:0,turb:0});
  const loopRef  = useRef<NodeJS.Timeout|null>(null);
  const ctrlRef  = useRef<SimControl>({roll_cmd:0,pitch_cmd:0,yaw_cmd:0,throttle_cmd:0});
  const stateRef = useRef<SimState>(DEFAULT_STATE);

  useEffect(() => { stateRef.current = state; }, [state]);

  const step = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.post<{state:SimState;diagnostics:Record<string,any>}>(
        "/sim/step",
        {library_id:libraryId,state:stateRef.current,control:ctrlRef.current,
         dt:0.05,wind_speed:wind.speed,wind_dir_deg:wind.dir,turbulence:wind.turb},
        token,
      );
      setState(res.state);
    } catch {}
  }, [token, libraryId, wind]);

  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  const start = useCallback(() => {
    setRunning(true);
    loopRef.current = setInterval(() => stepRef.current(), 50);
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
    if (loopRef.current) clearInterval(loopRef.current);
  }, []);

  const reset = useCallback(() => {
    stop();
    setState(DEFAULT_STATE);
    setEwState(DEFAULT_EW);
    stateRef.current = DEFAULT_STATE;
  }, [stop]);

  const setControl = useCallback((ctrl: Partial<SimControl>) => {
    ctrlRef.current = {...ctrlRef.current,...ctrl};
  }, []);

  const setWindFn = useCallback((w:{speed:number;dir:number;turb:number}) => {
    setWind(w);
  }, []);

  return { state, ewState, running, wind, start, stop, reset, setControl, setWind: setWindFn };
}
