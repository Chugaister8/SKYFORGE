"use client";
import { clsx } from "clsx";
import { Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { Waypoint } from "@/lib/hooks/useMission";

const RISK_CFG:Record<string,{color:string;bg:string}>={
  SAFE:{color:"text-threat-low",bg:"bg-threat-low/10"},LOW:{color:"text-cyan-DEFAULT",bg:"bg-cyan-subtle"},
  MEDIUM:{color:"text-threat-medium",bg:"bg-threat-medium/10"},HIGH:{color:"text-threat-high",bg:"bg-threat-high/10"},
  CRITICAL:{color:"text-purple-400",bg:"bg-purple-500/10"},
};
const ACTIONS=["WAYPOINT","LOITER","ORBIT","LAND","TAKEOFF"] as const;

interface Props{
  waypoints:Waypoint[];onUpdate:(id:string,c:Partial<Waypoint>)=>void;
  onRemove:(id:string)=>void;onMoveUp:(i:number)=>void;onMoveDown:(i:number)=>void;
}

export function WaypointList({waypoints,onUpdate,onRemove,onMoveUp,onMoveDown}:Props){
  if(!waypoints.length) return(
    <div className="flex items-center justify-center h-32 border border-dashed border-border-dim rounded">
      <p className="font-mono text-xs text-text-dim">Click map to add waypoints</p>
    </div>
  );
  return(
    <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
      {waypoints.map((wp,idx)=>{
        const risk=RISK_CFG[wp.risk]??RISK_CFG.SAFE;
        return(
          <div key={wp.id} className={clsx("rounded border p-2.5 space-y-2 transition-all border-border-dim hover:border-border-active",
            wp.risk!=="SAFE"&&wp.risk!=="LOW"&&risk.bg)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xs text-text-dim w-6">#{idx+1}</span>
                <span className={clsx("font-mono text-2xs px-1.5 py-0.5 rounded",risk.color,risk.bg)}>{wp.risk}</span>
                {wp.max_pk>0&&<span className="font-mono text-2xs text-text-dim">P(k): {(wp.max_pk*100).toFixed(0)}%</span>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={()=>onMoveUp(idx)} disabled={idx===0} className="p-0.5 text-text-dim hover:text-text-secondary disabled:opacity-30 transition-colors"><ChevronUp className="w-3 h-3" strokeWidth={1.5}/></button>
                <button onClick={()=>onMoveDown(idx)} disabled={idx===waypoints.length-1} className="p-0.5 text-text-dim hover:text-text-secondary disabled:opacity-30 transition-colors"><ChevronDown className="w-3 h-3" strokeWidth={1.5}/></button>
                <button onClick={()=>onRemove(wp.id)} className="p-0.5 text-text-dim hover:text-threat-high transition-colors ml-1"><Trash2 className="w-3 h-3" strokeWidth={1.5}/></button>
              </div>
            </div>
            <div className="font-mono text-2xs text-text-secondary">{wp.lat.toFixed(5)}°N {wp.lon.toFixed(5)}°E</div>
            <div className="grid grid-cols-3 gap-1.5">
              {[{label:"ALT (m)",key:"alt_m",val:wp.alt_m,min:0,max:5000,step:10},
                {label:"SPD (m/s)",key:"speed_ms",val:wp.speed_ms,min:1,max:200,step:1}].map(({label,key,val,min,max,step})=>(
                <div key={key}>
                  <label className="font-mono text-2xs text-text-dim block mb-0.5">{label}</label>
                  <input type="number" value={val} min={min} max={max} step={step}
                    onChange={e=>onUpdate(wp.id,{[key]:Number(e.target.value)})}
                    className="w-full bg-bg-base border border-border-dim rounded px-1.5 py-1 font-mono text-2xs text-text-primary focus:outline-none focus:border-border-active"/>
                </div>
              ))}
              <div>
                <label className="font-mono text-2xs text-text-dim block mb-0.5">ACTION</label>
                <select value={wp.action} onChange={e=>onUpdate(wp.id,{action:e.target.value as Waypoint["action"]})}
                  className="w-full bg-bg-base border border-border-dim rounded px-1 py-1 font-mono text-2xs text-text-primary focus:outline-none focus:border-border-active">
                  {ACTIONS.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
