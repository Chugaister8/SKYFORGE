"use client";
import { useState } from "react";
import { useAAR } from "@/lib/hooks/useAAR";
import { ScoreCard }      from "@/components/aar/ScoreCard";
import { EventTimeline }  from "@/components/aar/EventTimeline";
import { ReplayControls } from "@/components/aar/ReplayControls";
import { AARMap }         from "@/components/aar/AARMap";
import { clsx } from "clsx";
import { FileText, BarChart2 } from "lucide-react";

const MISSIONS=[{id:"1",name:"MISSION ALPHA — ISR Patrol"},{id:"2",name:"MISSION BRAVO — Strike Run"},{id:"3",name:"MISSION CHARLIE — SEAD"}];

export default function AARPage(){
  const{state,loadMission,play,pause,seek,reset}=useAAR();
  const[tab,setTab]=useState<"overview"|"timeline">("overview");
  const cur=state.track.find((r,i)=>r.time_s<=state.time_s&&(i===state.track.length-1||state.track[i+1].time_s>state.time_s))??state.track[0];

  return(<div className="flex h-full overflow-hidden">
    <div className="w-72 shrink-0 flex flex-col border-r border-border-dim bg-bg-surface overflow-hidden">
      <div className="p-3 border-b border-border-dim">
        <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2">SELECT MISSION</p>
        <div className="space-y-1">
          {MISSIONS.map(m=>(<button key={m.id} onClick={()=>loadMission(m.name)}
            className="w-full text-left px-2.5 py-1.5 rounded border border-border-dim hover:border-border-active bg-bg-raised hover:bg-bg-surface font-mono text-xs text-text-primary transition-all">
            {m.name}
          </button>))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {state.metrics?<ScoreCard metrics={state.metrics}/>:(
          <div className="flex items-center justify-center h-40"><p className="font-mono text-xs text-text-dim">Select a mission to review</p></div>
        )}
      </div>
    </div>
    <div className="flex-1 flex flex-col">
      <div className="flex-1 relative">
        {state.track.length>0?<AARMap track={state.track} events={state.events} current={state.time_s}/>:(
          <div className="flex items-center justify-center h-full"><p className="font-mono text-xs text-text-dim">Load a mission to view replay</p></div>
        )}
        {cur&&(<div className="absolute top-3 right-3 z-[1000] bg-bg-base/90 border border-border-dim rounded p-2.5 space-y-1">
          {[["ALT",`${cur.altitude_m.toFixed(0)} m`],["SPD",`${cur.speed_ms.toFixed(1)} m/s`],
            ["HDG",`${cur.heading_deg.toFixed(0)}°`],["BAT",`${cur.battery_pct.toFixed(0)}%`],["EW",cur.ew_threat]].map(([l,v])=>(
            <div key={l as string} className="flex items-center gap-3 justify-between">
              <span className="font-mono text-2xs text-text-dim">{l}</span>
              <span className={clsx("font-mono text-2xs tabular-nums",l==="EW"&&v!=="NONE"?"text-threat-high":"text-text-primary")}>{v}</span>
            </div>))}
        </div>)}
      </div>
      {state.duration>0&&(<div className="p-3 border-t border-border-dim bg-bg-surface">
        <ReplayControls playing={state.playing} time_s={state.time_s} duration={state.duration} onPlay={play} onPause={pause} onSeek={seek} onReset={reset}/>
      </div>)}
    </div>
    <div className="w-72 shrink-0 border-l border-border-dim bg-bg-surface flex flex-col overflow-hidden">
      <div className="flex border-b border-border-dim">
        {[{key:"overview",icon:BarChart2,label:"Overview"},{key:"timeline",icon:FileText,label:"Timeline"}].map(({key,icon:Icon,label})=>(
          <button key={key} onClick={()=>setTab(key as any)} className={clsx(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 font-mono text-2xs tracking-widest transition-all border-b-2",
            tab===key?"border-border-active text-cyan-DEFAULT":"border-transparent text-text-secondary hover:text-text-primary")}>
            <Icon className="w-3 h-3" strokeWidth={1.5}/>{label.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {tab==="overview"?state.metrics?(
          <div className="space-y-3">
            <p className="font-mono text-2xs text-text-secondary tracking-widest">AI DEBRIEF</p>
            <div className="bg-bg-raised border border-border-dim rounded p-3 space-y-2">
              {[{k:"s",label:"✓ STRENGTHS",color:"text-threat-low",text:"Successfully evaded SAM engagement through NOE descent. Maintained mission objectives despite EW interference."},
                {k:"i",label:"△ IMPROVE",color:"text-threat-medium",text:"GPS navigation degradation not properly compensated. Altitude too high during threat exposure zone."},
                {k:"r",label:"→ RECOMMEND",color:"text-cyan-DEFAULT",text:"Practice INS-only navigation. Review NOE corridor procedures for Tor-M1 engagement envelope."}].map(({k,label,color,text})=>(
                <div key={k}>
                  <p className={clsx("font-mono text-2xs font-medium mb-1",color)}>{label}</p>
                  <p className="font-mono text-2xs text-text-secondary leading-relaxed">{text}</p>
                </div>))}
            </div>
          </div>
        ):(
          <div className="flex items-center justify-center h-32"><p className="font-mono text-xs text-text-dim">No mission loaded</p></div>
        ):<EventTimeline events={state.events} current={state.time_s}/>}
      </div>
    </div>
  </div>);
}
