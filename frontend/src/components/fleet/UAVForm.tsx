"use client";
import { useState } from "react";
import { clsx } from "clsx";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";

const UAV_CLASSES = [
  {value:"NANO",label:"NANO",desc:"< 250g"},{value:"MICRO_FPV",label:"MICRO FPV",desc:"250–500g"},
  {value:"STRIKE_FPV",label:"STRIKE FPV",desc:"0.5–3kg"},{value:"TACTICAL_MULTIROTOR",label:"TACTICAL MULTI",desc:"1–10kg"},
  {value:"TACTICAL_VTOL",label:"TACTICAL VTOL",desc:"5–25kg"},{value:"FIXED_WING_ISR",label:"FIXED WING ISR",desc:"10–150kg"},
  {value:"LOITERING_MUNITION",label:"LOITERING",desc:"5–50kg"},{value:"MALE",label:"MALE",desc:"150–600kg"},{value:"HALE",label:"HALE",desc:"600kg+"},
];

interface UAVFormProps { onSuccess: () => void; onCancel: () => void; }

export function UAVForm({ onSuccess, onCancel }: UAVFormProps) {
  const token = useAuthStore((s) => s.accessToken);
  const [form, setForm] = useState({
    name:"",callsign:"",uav_class:"TACTICAL_MULTIROTOR",manufacturer:"",model:"",
    mass_kg:1.0,max_speed_ms:15.0,cruise_speed_ms:10.0,max_altitude_m:400.0,
    max_range_km:5.0,endurance_min:30.0,motor_type:"electric",battery_mah:"" as any,
    has_eo:false,has_ir:false,has_lidar:false,
  });
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const set=(k:string,v:any)=>setForm(p=>({...p,[k]:v}));

  async function handleSubmit() {
    if(!form.name||!form.callsign){setError("Name and callsign are required");return;}
    setError(null);setLoading(true);
    try {
      await api.post("/fleet/",{...form,battery_mah:form.battery_mah===""?null:Number(form.battery_mah)},token??undefined);
      onSuccess();
    } catch(e:any){setError(e.message);}finally{setLoading(false);}
  }

  return (
    <div className="space-y-5">
      <Sec title="IDENTITY">
        <div className="grid grid-cols-2 gap-3">
          <Fld label="NAME"><Inp value={form.name} onChange={v=>set("name",v)} placeholder="Alpha UAV-1"/></Fld>
          <Fld label="CALLSIGN"><Inp value={form.callsign} onChange={v=>set("callsign",v.toUpperCase())} placeholder="ALPHA-1"/></Fld>
          <Fld label="MANUFACTURER"><Inp value={form.manufacturer} onChange={v=>set("manufacturer",v)} placeholder="DJI / Custom"/></Fld>
          <Fld label="MODEL"><Inp value={form.model} onChange={v=>set("model",v)} placeholder="Mavic 3T"/></Fld>
        </div>
      </Sec>
      <Sec title="CLASS">
        <div className="grid grid-cols-3 gap-1.5">
          {UAV_CLASSES.map(({value,label,desc})=>(
            <button key={value} onClick={()=>set("uav_class",value)} className={clsx(
              "flex flex-col items-start p-2 rounded border text-left transition-all",
              form.uav_class===value?"border-border-active bg-cyan-subtle":"border-border-dim hover:border-border-active bg-bg-raised")}>
              <span className={clsx("font-mono text-2xs font-medium",form.uav_class===value?"text-cyan-DEFAULT":"text-text-primary")}>{label}</span>
              <span className="font-mono text-2xs text-text-dim mt-0.5">{desc}</span>
            </button>
          ))}
        </div>
      </Sec>
      <Sec title="PERFORMANCE">
        <div className="grid grid-cols-3 gap-3">
          <Fld label="MASS (kg)"><Num value={form.mass_kg} onChange={v=>set("mass_kg",v)} min={0.01} step={0.1}/></Fld>
          <Fld label="MAX SPEED (m/s)"><Num value={form.max_speed_ms} onChange={v=>set("max_speed_ms",v)} min={1} step={1}/></Fld>
          <Fld label="CRUISE (m/s)"><Num value={form.cruise_speed_ms} onChange={v=>set("cruise_speed_ms",v)} min={1} step={1}/></Fld>
          <Fld label="MAX ALT (m)"><Num value={form.max_altitude_m} onChange={v=>set("max_altitude_m",v)} min={10} step={10}/></Fld>
          <Fld label="RANGE (km)"><Num value={form.max_range_km} onChange={v=>set("max_range_km",v)} min={0.1} step={0.5}/></Fld>
          <Fld label="ENDURANCE (min)"><Num value={form.endurance_min} onChange={v=>set("endurance_min",v)} min={1} step={5}/></Fld>
        </div>
      </Sec>
      <Sec title="PROPULSION">
        <div className="grid grid-cols-2 gap-3">
          <Fld label="MOTOR TYPE">
            <select value={form.motor_type} onChange={e=>set("motor_type",e.target.value)}
              className="w-full bg-bg-base border border-border-dim rounded px-2.5 py-1.5 font-mono text-xs text-text-primary focus:outline-none focus:border-border-active">
              {["electric","piston","turbine","hybrid"].map(t=><option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
          </Fld>
          <Fld label="BATTERY (mAh)"><Inp value={String(form.battery_mah)} onChange={v=>set("battery_mah",v)} placeholder="5000"/></Fld>
        </div>
      </Sec>
      <Sec title="SENSORS">
        <div className="flex gap-3">
          {[{k:"has_eo",l:"EO Camera"},{k:"has_ir",l:"IR / Thermal"},{k:"has_lidar",l:"LIDAR"}].map(({k,l})=>(
            <button key={k} onClick={()=>set(k,!(form as any)[k])} className={clsx(
              "flex items-center gap-2 px-3 py-2 rounded border transition-all font-mono text-xs",
              (form as any)[k]?"border-border-active bg-cyan-subtle text-cyan-DEFAULT":"border-border-dim text-text-secondary hover:border-border-active")}>
              <span className={clsx("w-1.5 h-1.5 rounded-full",(form as any)[k]?"bg-cyan-DEFAULT":"bg-text-dim")}/>
              {l}
            </button>
          ))}
        </div>
      </Sec>
      {error&&<div className="bg-threat-high/10 border border-threat-high/30 rounded px-3 py-2"><p className="font-mono text-2xs text-threat-high">{error}</p></div>}
      <div className="flex gap-2 pt-2">
        <button onClick={handleSubmit} disabled={loading} className={clsx(
          "flex-1 py-2.5 rounded border font-mono text-xs tracking-widest transition-all",
          loading?"border-border-dim text-text-dim cursor-not-allowed":"border-border-active bg-cyan-subtle text-cyan-DEFAULT hover:shadow-cyan")}>
          {loading?"REGISTERING...":"REGISTER UAV"}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 rounded border border-border-dim text-text-secondary hover:text-text-primary font-mono text-xs transition-all">CANCEL</button>
      </div>
    </div>
  );
}

function Sec({title,children}:{title:string;children:React.ReactNode}){return(
  <div><p className="font-mono text-2xs text-text-secondary tracking-widest mb-2 pb-1 border-b border-border-dim">{title}</p>{children}</div>
);}
function Fld({label,children}:{label:string;children:React.ReactNode}){return(
  <div><label className="block font-mono text-2xs text-text-dim tracking-widest mb-1">{label}</label>{children}</div>
);}
function Inp({value,onChange,placeholder}:{value:string;onChange:(v:string)=>void;placeholder?:string}){return(
  <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    className="w-full bg-bg-base border border-border-dim rounded px-2.5 py-1.5 font-mono text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-border-active transition-colors"/>
);}
function Num({value,onChange,min,step}:{value:number;onChange:(v:number)=>void;min?:number;step?:number}){return(
  <input type="number" value={value} min={min} step={step} onChange={e=>onChange(parseFloat(e.target.value)||0)}
    className="w-full bg-bg-base border border-border-dim rounded px-2.5 py-1.5 font-mono text-xs text-text-primary focus:outline-none focus:border-border-active transition-colors"/>
);}
