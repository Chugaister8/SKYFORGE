"use client";
import { useState } from "react";
import { useSimulator } from "@/lib/hooks/useSimulator";
import { SimViewport }       from "@/components/simulator/SimViewport";
import { FlightInstruments } from "@/components/simulator/FlightInstruments";
import { ControlPanel }      from "@/components/simulator/ControlPanel";
import { EWPanel }           from "@/components/simulator/EWPanel";
import { clsx } from "clsx";
import { ChevronLeft, Eye, Crosshair, Map } from "lucide-react";
import Link from "next/link";

const PRESETS=[
  {id:"mavic-3t",label:"DJI Mavic 3T",type:"MULTI"},
  {id:"leleka-100",label:"Leleka-100",type:"FW"},
  {id:"bayraktar-tb2",label:"Bayraktar TB2",type:"FW"},
  {id:"uj-22",label:"UJ-22 Airborne",type:"FW"},
];

type ViewMode="fpv"|"third"|"map";
const VIEW_MODES:[ViewMode,any,string][]=[["fpv",Crosshair,"FPV"],["third",Eye,"3RD"],["map",Map,"MAP"]];

export default function SimulatorPage(){
  const [selectedUAV,setSelectedUAV]=useState(PRESETS[0].id);
  const [viewMode,setViewMode]=useState<ViewMode>("third");
  const [showEW,setShowEW]=useState(false);
  const sim=useSimulator(selectedUAV);

  return(
    <div className="flex h-screen w-screen overflow-hidden bg-bg-base">
      {/* Left */}
      <div className="w-64 shrink-0 flex flex-col border-r border-border-dim bg-bg-surface">
        <div className="p-3 border-b border-border-dim flex items-center gap-2">
          <Link href="/dashboard" className="p-1 rounded hover:bg-bg-raised text-text-secondary hover:text-text-primary transition-colors">
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5}/>
          </Link>
          <span className="font-mono text-xs text-text-primary tracking-widest">SIMULATOR</span>
        </div>
        <div className="p-3 border-b border-border-dim">
          <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2">SELECT UAV</p>
          <div className="space-y-1">
            {PRESETS.map(p=>(
              <button key={p.id} onClick={()=>{sim.reset();setSelectedUAV(p.id);}} disabled={sim.running}
                className={clsx("w-full flex items-center justify-between px-2.5 py-1.5 rounded border text-left transition-all",
                  selectedUAV===p.id?"border-border-active bg-cyan-subtle":"border-border-dim hover:border-border-active bg-bg-raised",
                  sim.running&&"opacity-50 cursor-not-allowed")}>
                <span className={clsx("font-mono text-xs",selectedUAV===p.id?"text-cyan-DEFAULT":"text-text-primary")}>{p.label}</span>
                <span className="font-mono text-2xs text-text-dim">{p.type}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <ControlPanel running={sim.running} onStart={sim.start} onStop={sim.stop}
            onReset={sim.reset} onControl={sim.setControl} onWind={sim.setWind}/>
        </div>
      </div>

      {/* Viewport */}
      <div className="flex-1 flex flex-col">
        <div className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-border-dim bg-bg-surface">
          <div className="flex items-center gap-1">
            {VIEW_MODES.map(([key,Icon,label])=>(
              <button key={key} onClick={()=>setViewMode(key)}
                className={clsx("flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-2xs tracking-widest transition-all",
                  viewMode===key?"border-border-active bg-cyan-subtle text-cyan-DEFAULT":"border-transparent text-text-secondary hover:text-text-primary")}>
                <Icon className="w-3 h-3" strokeWidth={1.5}/>{label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {sim.running&&(
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-threat-low animate-pulse-slow"/>
                <span className="font-mono text-2xs text-threat-low">SIM RUNNING</span>
              </div>
            )}
            <button onClick={()=>setShowEW(!showEW)}
              className={clsx("font-mono text-2xs px-2.5 py-1 rounded border transition-all",
                showEW?"border-purple-400/60 bg-purple-500/10 text-purple-400":"border-border-dim text-text-secondary hover:text-text-primary")}>
              EW PANEL
            </button>
          </div>
        </div>
        <div className="flex-1">
          <SimViewport state={sim.state} ewState={sim.ewState} mode={viewMode}/>
        </div>
      </div>

      {/* Right */}
      <div className="w-64 shrink-0 flex flex-col border-l border-border-dim bg-bg-surface">
        <div className="flex-1 overflow-y-auto p-3">
          <p className="font-mono text-2xs text-text-secondary tracking-widest mb-3">FLIGHT DATA</p>
          <FlightInstruments state={sim.state}/>
        </div>
        {showEW&&(
          <div className="border-t border-border-dim p-3 max-h-80 overflow-y-auto">
            <p className="font-mono text-2xs text-text-secondary tracking-widest mb-3">ELECTRONIC WARFARE</p>
            <EWPanel ew={sim.ewState}/>
          </div>
        )}
      </div>
    </div>
  );
}
