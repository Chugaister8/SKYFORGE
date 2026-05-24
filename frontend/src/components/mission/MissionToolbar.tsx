"use client";
import { clsx } from "clsx";
import { MapPin, Shield, Radio, MousePointer, Trash2, Zap, AlertTriangle } from "lucide-react";

type Tool="select"|"waypoint"|"sam"|"ew";
const SAM_PRESETS=["tor-m1","buk-m2","zu-23-2","manpads"];
const TOOLS:[Tool,any,string,string?][]=[
  ["select",MousePointer,"SELECT"],["waypoint",MapPin,"WAYPOINT","text-cyan-DEFAULT"],
  ["sam",Shield,"SAM","text-threat-high"],["ew",Radio,"EW","text-purple-400"],
];

interface Props{
  tool:Tool;samPreset:string;onTool:(t:Tool)=>void;onSamPreset:(p:string)=>void;
  onAnalyze:()=>void;onClear:()=>void;analyzing:boolean;
  wpCount:number;siteCount:number;overallRisk:number;
}

export function MissionToolbar({tool,samPreset,onTool,onSamPreset,onAnalyze,onClear,analyzing,wpCount,siteCount,overallRisk}:Props){
  const rc=overallRisk>0.7?"text-purple-400":overallRisk>0.4?"text-threat-high":overallRisk>0.15?"text-threat-medium":overallRisk>0.01?"text-cyan-DEFAULT":"text-threat-low";
  return(
    <div className="flex items-center gap-2 p-2 border-b border-border-dim bg-bg-surface shrink-0">
      <div className="flex items-center gap-1">
        {TOOLS.map(([key,Icon,label,color])=>(
          <button key={key} onClick={()=>onTool(key)} className={clsx(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded border font-mono text-2xs tracking-widest transition-all",
            tool===key?"border-border-active bg-cyan-subtle text-cyan-DEFAULT":"border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-raised")}>
            <Icon className={clsx("w-3 h-3",tool===key?"text-cyan-DEFAULT":(color??"text-text-dim"))} strokeWidth={1.5}/>{label}
          </button>
        ))}
      </div>
      {tool==="sam"&&(
        <div className="flex items-center gap-1 border-l border-border-dim pl-2">
          {SAM_PRESETS.map(p=>(
            <button key={p} onClick={()=>onSamPreset(p)} className={clsx(
              "px-2 py-1 rounded border font-mono text-2xs transition-all",
              samPreset===p?"border-threat-high/60 bg-threat-high/10 text-threat-high":"border-border-dim text-text-secondary hover:text-text-primary")}>
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1"/>
      <div className="flex items-center gap-3 text-text-secondary">
        <span className="font-mono text-2xs"><span className="text-cyan-DEFAULT">{wpCount}</span> WP</span>
        <span className="font-mono text-2xs"><span className="text-threat-high">{siteCount}</span> SAM</span>
        {overallRisk>0&&(
          <div className="flex items-center gap-1">
            <AlertTriangle className={clsx("w-3 h-3",rc)} strokeWidth={1.5}/>
            <span className={clsx("font-mono text-2xs",rc)}>{(overallRisk*100).toFixed(0)}% risk</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 border-l border-border-dim pl-2">
        <button onClick={onAnalyze} disabled={analyzing||wpCount===0} className={clsx(
          "flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono text-2xs tracking-widest transition-all",
          analyzing||wpCount===0?"border-border-dim text-text-dim cursor-not-allowed":"border-threat-medium bg-threat-medium/10 text-threat-medium hover:bg-threat-medium/20")}>
          <Zap className="w-3 h-3" strokeWidth={1.5}/>{analyzing?"ANALYZING...":"ANALYZE"}
        </button>
        <button onClick={onClear} className="p-1.5 rounded border border-border-dim text-text-secondary hover:text-threat-high hover:border-threat-high/40 transition-all">
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5}/>
        </button>
      </div>
    </div>
  );
}
