"use client";
import { clsx } from "clsx";
import type { SimState } from "@/lib/hooks/useSimulator";

function Gauge({label,value,unit,min,max,warn,danger,color}:{
  label:string;value:number;unit:string;min:number;max:number;warn?:number;danger?:number;color?:string;
}){
  const pct=Math.max(0,Math.min(100,((value-min)/(max-min))*100));
  const isDanger=danger!==undefined&&value>=danger;
  const isWarn=warn!==undefined&&value>=warn&&!isDanger;
  const bar=isDanger?"bg-threat-high":isWarn?"bg-threat-medium":(color??"bg-cyan-DEFAULT");
  return(
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-2xs text-text-dim">{label}</span>
        <span className={clsx("font-mono text-xs tabular-nums font-medium",isDanger?"text-threat-high":isWarn?"text-threat-medium":"text-text-primary")}>
          {value.toFixed(1)}<span className="text-text-dim ml-0.5 text-2xs">{unit}</span>
        </span>
      </div>
      <div className="h-1 bg-bg-base rounded overflow-hidden">
        <div className={clsx("h-full rounded transition-all duration-100",bar)} style={{width:`${pct}%`}}/>
      </div>
    </div>
  );
}

function Big({label,value,unit,color}:{label:string;value:string;unit:string;color?:string}){
  return(
    <div className="text-center">
      <p className="font-mono text-2xs text-text-dim mb-0.5">{label}</p>
      <p className={clsx("font-mono text-lg font-medium tabular-nums leading-none",color??"text-text-primary")}>{value}</p>
      <p className="font-mono text-2xs text-text-dim mt-0.5">{unit}</p>
    </div>
  );
}

export function FlightInstruments({state}:{state:SimState}){
  const heading=(((state.yaw*180/Math.PI)%360)+360)%360;
  const roll=state.roll*180/Math.PI;
  const pitch=state.pitch*180/Math.PI;
  return(
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 pb-3 border-b border-border-dim">
        <Big label="ALTITUDE" value={state.altitude_m.toFixed(0)} unit="m"
          color={state.altitude_m<20?"text-threat-high":"text-cyan-DEFAULT"}/>
        <Big label="AIRSPEED" value={state.airspeed_ms.toFixed(1)} unit="m/s"/>
        <Big label="HEADING"  value={heading.toFixed(0)} unit="°"/>
      </div>
      <div className="space-y-2.5">
        <Gauge label="THROTTLE"   value={state.actual_throttle*100} unit="%" min={0} max={100} warn={85} danger={95} color="bg-threat-low"/>
        <Gauge label="CLIMB RATE" value={-state.vz} unit="m/s" min={-10} max={10}/>
        <Gauge label="FUEL"       value={state.fuel_remaining*100} unit="%" min={0} max={100} warn={30} danger={15} color="bg-threat-low"/>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-dim">
        <div>
          <p className="font-mono text-2xs text-text-dim mb-1">ROLL</p>
          <p className={clsx("font-mono text-sm tabular-nums",Math.abs(roll)>35?"text-threat-high":Math.abs(roll)>20?"text-threat-medium":"text-text-primary")}>
            {roll.toFixed(1)}°
          </p>
        </div>
        <div>
          <p className="font-mono text-2xs text-text-dim mb-1">PITCH</p>
          <p className={clsx("font-mono text-sm tabular-nums",Math.abs(pitch)>25?"text-threat-high":Math.abs(pitch)>15?"text-threat-medium":"text-text-primary")}>
            {pitch.toFixed(1)}°
          </p>
        </div>
        <div>
          <p className="font-mono text-2xs text-text-dim mb-1">SIM TIME</p>
          <p className="font-mono text-sm tabular-nums text-text-secondary">{state.sim_time_s.toFixed(1)}s</p>
        </div>
        <div>
          <p className="font-mono text-2xs text-text-dim mb-1">GND SPD</p>
          <p className="font-mono text-sm tabular-nums text-text-secondary">{state.groundspeed_ms.toFixed(1)} m/s</p>
        </div>
      </div>
    </div>
  );
}
