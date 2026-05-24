"use client";
import { clsx } from "clsx";
import { MapPin, Shield, Radio, Cloud, Info, Crosshair } from "lucide-react";
import type { AAREvent } from "@/lib/hooks/useAAR";

const TYPE_CFG:Record<string,{icon:any;color:string;border:string;bg:string}>={
  WAYPOINT:{icon:MapPin,   color:"text-threat-low",   border:"border-threat-low/30",   bg:"bg-threat-low/5"},
  THREAT:  {icon:Shield,   color:"text-threat-high",  border:"border-threat-high/30",  bg:"bg-threat-high/5"},
  EW:      {icon:Radio,    color:"text-purple-400",   border:"border-purple-400/30",   bg:"bg-purple-500/5"},
  WEATHER: {icon:Cloud,    color:"text-threat-medium",border:"border-threat-medium/30",bg:"bg-threat-medium/5"},
  INFO:    {icon:Info,     color:"text-text-secondary",border:"border-border-dim",     bg:""},
  KILL:    {icon:Crosshair,color:"text-threat-high",  border:"border-threat-high",     bg:"bg-threat-high/10"},
};

function fmt(s:number){const m=Math.floor(s/60);const sec=Math.floor(s%60);return`${m}:${sec.toString().padStart(2,"0")}`;}

export function EventTimeline({events,current}:{events:AAREvent[];current:number}){
  const visible=events.filter(e=>e.time_s<=current);
  if(!visible.length) return(<div className="flex items-center justify-center h-24"><p className="font-mono text-xs text-text-dim">— mission not started —</p></div>);
  return(<div className="space-y-1.5 max-h-full overflow-y-auto">
    {[...visible].reverse().map((ev,i)=>{
      const cfg=TYPE_CFG[ev.type]??TYPE_CFG.INFO; const Icon=cfg.icon;
      return(<div key={i} className={clsx("flex gap-2.5 p-2.5 rounded border",cfg.border,cfg.bg)}>
        <Icon className={clsx("w-3.5 h-3.5 shrink-0 mt-0.5",cfg.color)} strokeWidth={1.5}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={clsx("font-mono text-2xs font-medium",cfg.color)}>{ev.title}</p>
            <span className="font-mono text-2xs text-text-dim shrink-0">{fmt(ev.time_s)}</span>
          </div>
          <p className="font-mono text-2xs text-text-secondary mt-0.5 leading-relaxed">{ev.detail}</p>
        </div>
      </div>);
    })}
  </div>);
}
