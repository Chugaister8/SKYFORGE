"use client";
import { clsx } from "clsx";
import { Satellite, Wifi, AlertTriangle } from "lucide-react";
import type { EWState } from "@/lib/hooks/useSimulator";

const EFFECT_CFG: Record<string,{color:string;bg:string;label:string}> = {
  NONE:    {color:"text-threat-low",   bg:"bg-threat-low/10",   label:"NOMINAL"},
  DEGRADED:{color:"text-threat-medium",bg:"bg-threat-medium/10",label:"DEGRADED"},
  DENIED:  {color:"text-threat-high",  bg:"bg-threat-high/10",  label:"DENIED"},
  SPOOFED: {color:"text-purple-400",   bg:"bg-purple-500/10",   label:"SPOOFED"},
};

const THREAT_CLR: Record<string,string> = {
  NONE:"text-threat-low",LOW:"text-threat-low",
  MEDIUM:"text-threat-medium",HIGH:"text-threat-high",CRITICAL:"text-purple-400",
};

function Row({label,value,color}:{label:string;value:string;color?:string}){
  return(
    <div className="flex items-center justify-between py-0.5">
      <span className="font-mono text-2xs text-text-dim">{label}</span>
      <span className={clsx("font-mono text-2xs tabular-nums",color??"text-text-secondary")}>{value}</span>
    </div>
  );
}

export function EWPanel({ew}:{ew:EWState}){
  const gpsCfg=EFFECT_CFG[ew.gps_effect]??EFFECT_CFG.NONE;
  const dlCfg=EFFECT_CFG[ew.datalink_effect]??EFFECT_CFG.NONE;
  const threatCl=THREAT_CLR[ew.threat_level]??"text-text-secondary";
  return(
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-2xs text-text-secondary tracking-widest">EW STATUS</span>
        <span className={clsx("font-mono text-xs font-medium tracking-widest",threatCl)}>{ew.threat_level}</span>
      </div>
      <div className={clsx("p-2.5 rounded border border-border-dim",gpsCfg.bg)}>
        <div className="flex items-center gap-1.5 mb-2">
          <Satellite className={clsx("w-3 h-3",gpsCfg.color)} strokeWidth={1.5}/>
          <span className={clsx("font-mono text-2xs font-medium",gpsCfg.color)}>GPS — {gpsCfg.label}</span>
        </div>
        <Row label="Accuracy" value={`±${ew.gps_accuracy_m.toFixed(1)} m`}
          color={ew.gps_accuracy_m>50?"text-threat-high":ew.gps_accuracy_m>10?"text-threat-medium":undefined}/>
        <Row label="INS Drift" value={`${ew.gps_drift_ms.toFixed(1)} m`}
          color={ew.gps_drift_ms>100?"text-threat-high":ew.gps_drift_ms>20?"text-threat-medium":undefined}/>
        {ew.spoofed_lat&&<Row label="Spoof Pos" value={`${ew.spoofed_lat.toFixed(4)}°N`} color="text-purple-400"/>}
      </div>
      <div className={clsx("p-2.5 rounded border border-border-dim",dlCfg.bg)}>
        <div className="flex items-center gap-1.5 mb-2">
          <Wifi className={clsx("w-3 h-3",dlCfg.color)} strokeWidth={1.5}/>
          <span className={clsx("font-mono text-2xs font-medium",dlCfg.color)}>LINK — {dlCfg.label}</span>
        </div>
        <Row label="Quality" value={`${(ew.link_quality*100).toFixed(0)}%`}
          color={ew.link_quality<0.3?"text-threat-high":ew.link_quality<0.7?"text-threat-medium":undefined}/>
        <Row label="Pkt Loss" value={`${ew.packet_loss_pct.toFixed(0)}%`}
          color={ew.packet_loss_pct>50?"text-threat-high":ew.packet_loss_pct>20?"text-threat-medium":undefined}/>
        <Row label="Latency" value={`${ew.latency_ms.toFixed(0)} ms`}
          color={ew.latency_ms>500?"text-threat-high":ew.latency_ms>200?"text-threat-medium":undefined}/>
      </div>
      {(ew.radar_warning||ew.radar_lock)&&(
        <div className={clsx("flex items-center gap-2 p-2.5 rounded border animate-pulse-slow",
          ew.radar_lock?"border-threat-high bg-threat-high/10":"border-threat-medium bg-threat-medium/10")}>
          <AlertTriangle className={clsx("w-3.5 h-3.5",ew.radar_lock?"text-threat-high":"text-threat-medium")} strokeWidth={1.5}/>
          <span className={clsx("font-mono text-2xs font-medium tracking-widest",ew.radar_lock?"text-threat-high":"text-threat-medium")}>
            {ew.radar_lock?"RADAR LOCK":"RADAR WARNING"}
          </span>
        </div>
      )}
    </div>
  );
}
