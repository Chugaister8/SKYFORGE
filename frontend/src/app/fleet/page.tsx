"use client";
import { useState } from "react";
import { useFleet } from "@/lib/hooks/useFleet";
import { useQueryClient } from "@tanstack/react-query";
import { UAVForm } from "@/components/fleet/UAVForm";
import { useTelemetryStore } from "@/lib/store/telemetry.store";
import { clsx } from "clsx";
import { Plus, Plane, Battery, Wifi, Navigation, Gauge, Eye, Thermometer, Layers, Trash2 } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth.store";
import { API_URL } from "@/lib/constants";

const STATUS_CFG: Record<string,{label:string;color:string;dot:string}> = {
  ONLINE:     {label:"ONLINE",    color:"text-threat-low",   dot:"bg-threat-low"},
  IN_MISSION: {label:"IN MISSION",color:"text-cyan-DEFAULT", dot:"bg-cyan-DEFAULT"},
  OFFLINE:    {label:"OFFLINE",   color:"text-text-secondary",dot:"bg-text-dim"},
  MAINTENANCE:{label:"MAINT",     color:"text-threat-medium",dot:"bg-threat-medium"},
  LOST:       {label:"LOST",      color:"text-threat-high",  dot:"bg-threat-high"},
};

const CLASS_LABELS: Record<string,string> = {
  NANO:"NANO",MICRO_FPV:"μFPV",STRIKE_FPV:"STRIKE",TACTICAL_MULTIROTOR:"MULTI-ROTOR",
  TACTICAL_VTOL:"VTOL",FIXED_WING_ISR:"FIXED WING",LOITERING_MUNITION:"LOITERING",MALE:"MALE",HALE:"HALE",
};

export default function FleetPage() {
  const {data:fleet,isLoading}=useFleet();
  const snapshots=useTelemetryStore(s=>s.snapshots);
  const token=useAuthStore(s=>s.accessToken);
  const qc=useQueryClient();
  const [showForm,setShowForm]=useState(false);
  const [deleting,setDeleting]=useState<string|null>(null);

  async function handleDelete(id:string) {
    if(!confirm("Remove this UAV from fleet?")) return;
    setDeleting(id);
    await fetch(`${API_URL}/api/fleet/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});
    qc.invalidateQueries({queryKey:["fleet"]});
    setDeleting(null);
  }

  return (
    <div className="p-5 space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-2xs text-text-secondary tracking-widest mb-0.5">MANAGEMENT</p>
          <h1 className="font-mono text-base text-text-primary tracking-wide">Fleet Registry</h1>
        </div>
        <button onClick={()=>setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded border border-border-active bg-cyan-subtle text-cyan-DEFAULT font-mono text-xs tracking-widest hover:shadow-cyan transition-all">
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5}/>REGISTER UAV
        </button>
      </div>

      {showForm&&(
        <div className="bg-bg-surface border border-border-active rounded p-5 shadow-cyan-sm">
          <p className="font-mono text-2xs text-cyan-DEFAULT tracking-widest mb-4">NEW ASSET REGISTRATION</p>
          <UAVForm onSuccess={()=>{setShowForm(false);qc.invalidateQueries({queryKey:["fleet"]});}} onCancel={()=>setShowForm(false)}/>
        </div>
      )}

      {isLoading?(
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[1,2,3].map(i=><div key={i} className="h-48 bg-bg-surface rounded animate-pulse"/>)}
        </div>
      ):!fleet?.length?(
        <div className="flex flex-col items-center justify-center h-64 gap-3 border border-dashed border-border-dim rounded">
          <Plane className="w-8 h-8 text-text-dim" strokeWidth={1}/>
          <p className="font-mono text-xs text-text-dim">No assets registered</p>
          <button onClick={()=>setShowForm(true)} className="font-mono text-xs text-cyan-DEFAULT hover:underline">Register your first UAV →</button>
        </div>
      ):(
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {fleet.map(uav=>{
            const telem=snapshots.get(uav.id);
            const cfg=STATUS_CFG[uav.status]??STATUS_CFG.OFFLINE;
            const isLive=!!telem;
            return (
              <div key={uav.id} className={clsx(
                "bg-bg-surface border rounded p-4 space-y-3 transition-all",
                isLive?"border-border-active shadow-cyan-sm":"border-border-dim hover:border-border-active")}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={clsx("w-2 h-2 rounded-full shrink-0 mt-0.5",cfg.dot,isLive&&"animate-pulse-slow")}/>
                    <div>
                      <p className="font-mono text-sm text-text-primary font-medium leading-none">{uav.callsign}</p>
                      <p className="font-mono text-2xs text-text-secondary mt-0.5">{uav.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={clsx("font-mono text-2xs px-1.5 py-0.5 rounded border",
                      isLive?"border-border-active text-cyan-DEFAULT bg-cyan-subtle":"border-border-dim text-text-dim")}>{cfg.label}</span>
                    <button onClick={()=>handleDelete(uav.id)} disabled={deleting===uav.id}
                      className="p-1 rounded text-text-dim hover:text-threat-high transition-colors">
                      <Trash2 className="w-3 h-3" strokeWidth={1.5}/>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-2xs text-text-dim border border-border-dim rounded px-1.5 py-0.5">{CLASS_LABELS[uav.uav_class]??uav.uav_class}</span>
                  {uav.has_eo&&<Eye className="w-3 h-3 text-text-secondary" strokeWidth={1.5}/>}
                  {uav.has_ir&&<Thermometer className="w-3 h-3 text-text-secondary" strokeWidth={1.5}/>}
                  {uav.has_lidar&&<Layers className="w-3 h-3 text-text-secondary" strokeWidth={1.5}/>}
                </div>
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-border-dim">
                  <Sp label="MAX SPD" value={`${uav.max_speed_ms.toFixed(0)} m/s`}/>
                  <Sp label="RANGE"   value={`${uav.max_range_km} km`}/>
                  <Sp label="ENDUR"   value={`${uav.endurance_min} min`}/>
                </div>
                {isLive?(
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <TR icon={Navigation} label="ALT"  value={`${telem.altitude_m.toFixed(0)} m`}/>
                    <TR icon={Gauge}      label="SPD"  value={`${telem.speed_ms.toFixed(1)} m/s`}/>
                    <TR icon={Battery}    label="BAT"  value={`${telem.battery_pct.toFixed(0)}%`}
                      vc={telem.battery_pct<30?"text-threat-high":telem.battery_pct<50?"text-threat-medium":undefined}/>
                    <TR icon={Wifi}       label="LINK" value={`${(telem.link_quality*100).toFixed(0)}%`}/>
                  </div>
                ):(
                  <div className="flex items-center gap-2 py-1">
                    <Wifi className="w-3 h-3 text-text-dim" strokeWidth={1.5}/>
                    <span className="font-mono text-2xs text-text-dim">offline — no telemetry</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Sp({label,value}:{label:string;value:string}){return(
  <div className="text-center">
    <p className="font-mono text-2xs text-text-dim">{label}</p>
    <p className="font-mono text-xs text-text-primary mt-0.5">{value}</p>
  </div>
);}

function TR({icon:Icon,label,value,vc}:{icon:any;label:string;value:string;vc?:string}){return(
  <div className="flex items-center gap-1.5">
    <Icon className="w-3 h-3 text-text-dim shrink-0" strokeWidth={1.5}/>
    <span className="font-mono text-2xs text-text-dim w-8">{label}</span>
    <span className={clsx("font-mono text-2xs tabular-nums",vc??"text-text-secondary")}>{value}</span>
  </div>
);}
