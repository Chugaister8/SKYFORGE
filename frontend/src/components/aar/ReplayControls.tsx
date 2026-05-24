"use client";
import { clsx } from "clsx";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

interface Props{playing:boolean;time_s:number;duration:number;onPlay:()=>void;onPause:()=>void;onSeek:(t:number)=>void;onReset:()=>void;}
function fmt(s:number){const m=Math.floor(s/60);const sec=Math.floor(s%60);return`${m}:${sec.toString().padStart(2,"0")}`;}

export function ReplayControls({playing,time_s,duration,onPlay,onPause,onSeek,onReset}:Props){
  const pct=duration>0?(time_s/duration)*100:0;
  return(<div className="space-y-2">
    <div className="h-1.5 bg-bg-base rounded overflow-hidden cursor-pointer"
      onClick={e=>{const r=e.currentTarget.getBoundingClientRect();onSeek(((e.clientX-r.left)/r.width)*duration);}}>
      <div className="h-full bg-cyan-DEFAULT rounded transition-all" style={{width:`${pct}%`}}/>
    </div>
    <div className="flex items-center gap-2">
      <button onClick={onReset} className="p-1.5 rounded border border-border-dim text-text-secondary hover:text-text-primary transition-all"><SkipBack className="w-3.5 h-3.5" strokeWidth={1.5}/></button>
      <button onClick={playing?onPause:onPlay} className={clsx("flex-1 flex items-center justify-center gap-2 py-1.5 rounded border font-mono text-xs tracking-widest transition-all",
        playing?"border-threat-medium bg-threat-medium/10 text-threat-medium":"border-threat-low bg-threat-low/10 text-threat-low hover:bg-threat-low/20")}>
        {playing?<><Pause className="w-3.5 h-3.5" strokeWidth={1.5}/>PAUSE</>:<><Play className="w-3.5 h-3.5" strokeWidth={1.5}/>REPLAY</>}
      </button>
      <button onClick={()=>onSeek(Math.min(duration,time_s+30))} className="p-1.5 rounded border border-border-dim text-text-secondary hover:text-text-primary transition-all"><SkipForward className="w-3.5 h-3.5" strokeWidth={1.5}/></button>
      <span className="font-mono text-2xs text-text-secondary tabular-nums ml-1">{fmt(time_s)} / {fmt(duration)}</span>
    </div>
  </div>);
}
