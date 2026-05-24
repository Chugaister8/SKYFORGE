"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";
import { clsx } from "clsx";
import { Wrench, AlertTriangle, Zap, ChevronDown, ChevronUp, Shield, Radio, Cpu, Wifi, Eye, Wind } from "lucide-react";

interface Failure {
  id:string; name:string; category:string; severity:string; description:string;
  symptoms:string[]; procedures:string[]; can_continue:boolean;
  thrust_loss:number; control_loss:number; sensor_loss:string[]; comms_loss:number;
}

const SEV:Record<string,{color:string;bg:string;border:string}>={
  MINOR:   {color:"text-threat-low",   bg:"bg-threat-low/5",   border:"border-threat-low/30"},
  MODERATE:{color:"text-threat-medium",bg:"bg-threat-medium/5",border:"border-threat-medium/30"},
  CRITICAL:{color:"text-threat-high",  bg:"bg-threat-high/5",  border:"border-threat-high/30"},
  FATAL:   {color:"text-purple-400",   bg:"bg-purple-500/5",   border:"border-purple-400/30"},
};
const CAT_ICONS:Record<string,any>={HARDWARE:Cpu,AVIONICS:Shield,COMMS:Wifi,PROPULSION:Wind,SENSOR:Eye,STRUCTURAL:AlertTriangle};
const UAV_CLASSES=["NANO","MICRO_FPV","STRIKE_FPV","TACTICAL_MULTIROTOR","TACTICAL_VTOL","FIXED_WING_ISR","LOITERING_MUNITION","MALE","HALE"];

function FailureCard({failure}:{failure:Failure}){
  const[exp,setExp]=useState(false);
  const cfg=SEV[failure.severity]??SEV.MINOR; const Icon=CAT_ICONS[failure.category]??Wrench;
  return(<div className={clsx("border rounded transition-all",cfg.border,cfg.bg)}>
    <button onClick={()=>setExp(!exp)} className="w-full flex items-start gap-3 p-3 text-left">
      <Icon className={clsx("w-4 h-4 shrink-0 mt-0.5",cfg.color)} strokeWidth={1.5}/>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-xs text-text-primary font-medium">{failure.name}</span>
          <span className={clsx("font-mono text-2xs px-1.5 py-0.5 rounded border",cfg.color,cfg.bg,cfg.border)}>{failure.severity}</span>
          {!failure.can_continue&&<span className="font-mono text-2xs text-threat-high border border-threat-high/30 bg-threat-high/5 px-1.5 py-0.5 rounded">LAND NOW</span>}
        </div>
        <p className="font-mono text-2xs text-text-secondary leading-relaxed">{failure.description}</p>
        <div className="flex items-center gap-3 mt-1.5">
          {failure.thrust_loss>0&&<span className="font-mono text-2xs text-threat-medium">Thrust −{failure.thrust_loss}%</span>}
          {failure.control_loss>0&&<span className="font-mono text-2xs text-threat-medium">Control −{failure.control_loss}%</span>}
          {failure.comms_loss>0&&<span className="font-mono text-2xs text-threat-medium">Comms −{failure.comms_loss}%</span>}
          {failure.sensor_loss.map(s=><span key={s} className="font-mono text-2xs text-threat-medium">{s} lost</span>)}
        </div>
      </div>
      {exp?<ChevronUp className="w-4 h-4 text-text-dim shrink-0" strokeWidth={1.5}/>:<ChevronDown className="w-4 h-4 text-text-dim shrink-0" strokeWidth={1.5}/>}
    </button>
    {exp&&(<div className="px-4 pb-4 space-y-3 border-t border-border-dim mt-1 pt-3">
      <div>
        <p className="font-mono text-2xs text-text-secondary tracking-widest mb-1.5">SYMPTOMS</p>
        <ul className="space-y-1">
          {failure.symptoms.map((s,i)=>(
            <li key={i} className="flex items-center gap-2">
              <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0",cfg.color.replace("text-","bg-"))}/>
              <span className="font-mono text-2xs text-text-secondary">{s}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-mono text-2xs text-text-secondary tracking-widest mb-1.5">EMERGENCY PROCEDURES</p>
        <ol className="space-y-1">
          {failure.procedures.map((p,i)=>(
            <li key={i} className="flex items-start gap-2">
              <span className="font-mono text-2xs text-text-dim w-4 shrink-0">{i+1}.</span>
              <span className="font-mono text-2xs text-text-secondary">{p}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>)}
  </div>);
}

export default function EngineerPage(){
  const token=useAuthStore(s=>s.accessToken);
  const[category,setCategory]=useState("ALL");
  const[uavClass,setUavClass]=useState("TACTICAL_MULTIROTOR");
  const[flightHrs,setFlightHrs]=useState(1.0);
  const[simResult,setSimResult]=useState<any>(null);

  const{data,isLoading}=useQuery<{failures:Failure[];categories:string[]}>({
    queryKey:["failures",category],
    queryFn:()=>api.get(category!=="ALL"?`/engineer/failures?category=${category}`:"/engineer/failures",token??undefined),
    enabled:!!token,
  });

  const simulate=useMutation({
    mutationFn:()=>api.post("/engineer/simulate-failure",{uav_class:uavClass,flight_hours:flightHrs,has_ecm:false},token??undefined),
    onSuccess:(res:any)=>setSimResult(res),
  });

  const failures=data?.failures??[]; const cats=["ALL",...(data?.categories??[])];

  return(<div className="p-5 space-y-5 max-w-[1200px]">
    <div>
      <p className="font-mono text-2xs text-text-secondary tracking-widest mb-0.5">ENGINEER</p>
      <h1 className="font-mono text-base text-text-primary tracking-wide">Failure Analysis & Procedures</h1>
    </div>

    {/* Failure simulator */}
    <div className="bg-bg-surface border border-border-dim rounded p-4">
      <p className="font-mono text-2xs text-text-secondary tracking-widest mb-3">FAILURE SIMULATOR</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="font-mono text-2xs text-text-dim block mb-1">UAV CLASS</label>
          <select value={uavClass} onChange={e=>setUavClass(e.target.value)}
            className="w-full bg-bg-base border border-border-dim rounded px-2.5 py-1.5 font-mono text-xs text-text-primary focus:outline-none focus:border-border-active">
            {UAV_CLASSES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="font-mono text-2xs text-text-dim block mb-1">FLIGHT HOURS: {flightHrs.toFixed(1)}h</label>
          <input type="range" min={0.1} max={10} step={0.1} value={flightHrs}
            onChange={e=>setFlightHrs(Number(e.target.value))} className="w-full accent-cyan-500 mt-1"/>
        </div>
        <div className="flex items-end">
          <button onClick={()=>simulate.mutate()} disabled={simulate.isPending}
            className={clsx("w-full flex items-center justify-center gap-2 py-2 rounded border font-mono text-xs tracking-widest transition-all",
              simulate.isPending?"border-border-dim text-text-dim cursor-not-allowed":"border-threat-medium bg-threat-medium/10 text-threat-medium hover:bg-threat-medium/20")}>
            <Zap className="w-3.5 h-3.5" strokeWidth={1.5}/>{simulate.isPending?"SIMULATING...":"INJECT FAILURE"}
          </button>
        </div>
      </div>
      {simResult&&(simResult.failure?(
        <div className={clsx("p-3 rounded border mt-2",SEV[simResult.failure.severity]?.border,SEV[simResult.failure.severity]?.bg)}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={clsx("w-4 h-4",SEV[simResult.failure.severity]?.color)} strokeWidth={1.5}/>
            <span className={clsx("font-mono text-xs font-medium",SEV[simResult.failure.severity]?.color)}>FAILURE: {simResult.failure.name}</span>
          </div>
          <p className="font-mono text-2xs text-text-secondary mb-2">{simResult.failure.description}</p>
          <p className="font-mono text-2xs text-text-secondary tracking-widest mb-1">IMMEDIATE ACTIONS:</p>
          {simResult.failure.procedures.slice(0,3).map((p:string,i:number)=>(
            <p key={i} className="font-mono text-2xs text-text-secondary">{i+1}. {p}</p>
          ))}
        </div>
      ):(
        <div className="p-3 rounded border border-threat-low/30 bg-threat-low/5 mt-2">
          <p className="font-mono text-2xs text-threat-low">✓ Flight nominal — no failure generated</p>
        </div>
      ))}
    </div>

    {/* Failure library */}
    <div>
      <div className="flex items-center gap-2 mb-3">
        <p className="font-mono text-2xs text-text-secondary tracking-widest">FAILURE LIBRARY</p>
        <div className="flex gap-1.5 ml-auto">
          {cats.map(cat=>(
            <button key={cat} onClick={()=>setCategory(cat)}
              className={clsx("px-2 py-1 rounded border font-mono text-2xs transition-all",
                category===cat?"border-border-active bg-cyan-subtle text-cyan-DEFAULT":"border-border-dim text-text-secondary hover:text-text-primary")}>
              {cat}
            </button>
          ))}
        </div>
      </div>
      {isLoading?(
        <div className="space-y-2">{[1,2,3,4].map(i=><div key={i} className="h-16 bg-bg-surface rounded animate-pulse"/>)}</div>
      ):(
        <div className="space-y-2">{failures.map(f=><FailureCard key={f.id} failure={f}/>)}</div>
      )}
    </div>
  </div>);
}
