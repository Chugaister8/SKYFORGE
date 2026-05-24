"use client";
import { clsx } from "clsx";
import type { AARMetrics } from "@/lib/hooks/useAAR";

const GRADE_CFG:Record<string,{color:string;bg:string}>={
  S:{color:"text-purple-400",bg:"bg-purple-500/20"},A:{color:"text-threat-low",bg:"bg-threat-low/10"},
  B:{color:"text-cyan-DEFAULT",bg:"bg-cyan-subtle"},C:{color:"text-threat-medium",bg:"bg-threat-medium/10"},
  F:{color:"text-threat-high",bg:"bg-threat-high/10"},
};

function SR({label,value,color}:{label:string;value:string;color?:string}){
  return(<div className="flex items-center justify-between py-1 border-b border-border-dim last:border-0">
    <span className="font-mono text-2xs text-text-dim">{label}</span>
    <span className={clsx("font-mono text-xs tabular-nums",color??"text-text-primary")}>{value}</span>
  </div>);
}

export function ScoreCard({metrics}:{metrics:AARMetrics}){
  const g=GRADE_CFG[metrics.grade]; const m=Math.floor(metrics.duration_s/60); const s=Math.floor(metrics.duration_s%60);
  return(<div className="space-y-4">
    <div className="flex items-center gap-4 p-4 bg-bg-raised rounded border border-border-dim">
      <div className={clsx("w-16 h-16 rounded flex items-center justify-center text-3xl font-mono font-bold border-2",g.color,g.bg,"border-current")}>{metrics.grade}</div>
      <div>
        <p className="font-mono text-2xs text-text-secondary tracking-widest">MISSION SCORE</p>
        <p className="font-mono text-3xl font-medium text-text-primary">{metrics.score}</p>
        <p className="font-mono text-2xs text-text-dim">pts</p>
      </div>
    </div>
    <div className="bg-bg-raised rounded border border-border-dim p-3">
      <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2">MISSION STATS</p>
      <SR label="Duration"     value={`${m}m ${s}s`}/>
      <SR label="Distance"     value={`${metrics.distance_km.toFixed(1)} km`}/>
      <SR label="Avg Altitude" value={`${metrics.avg_altitude_m.toFixed(0)} m`}/>
      <SR label="Fuel Used"    value={`${metrics.fuel_used_pct.toFixed(0)}%`}/>
      <SR label="Waypoints"    value={`${metrics.waypoints_hit}/${metrics.waypoints_total}`}
        color={metrics.waypoints_hit===metrics.waypoints_total?"text-threat-low":"text-threat-medium"}/>
    </div>
    <div className="bg-bg-raised rounded border border-border-dim p-3">
      <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2">THREAT STATS</p>
      <SR label="Detected"  value={String(metrics.threats_detected)}/>
      <SR label="Evaded"    value={String(metrics.threats_evaded)} color="text-threat-low"/>
      <SR label="Times Hit" value={String(metrics.threats_hit)} color={metrics.threats_hit>0?"text-threat-high":"text-threat-low"}/>
      <SR label="Max P(k)"  value={`${(metrics.max_threat_pk*100).toFixed(0)}%`}
        color={metrics.max_threat_pk>0.6?"text-threat-high":metrics.max_threat_pk>0.3?"text-threat-medium":undefined}/>
      <SR label="Time in Danger" value={`${metrics.time_in_danger_s}s`}
        color={metrics.time_in_danger_s>60?"text-threat-high":"text-threat-medium"}/>
    </div>
  </div>);
}
