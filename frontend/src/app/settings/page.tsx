"use client";
import { useState } from "react";
import { useAuthStore } from "@/lib/store/auth.store";
import { api } from "@/lib/api";
import { clsx } from "clsx";
import { User, Shield, Bell, Monitor, Database, Key, Save, CheckCircle, Loader2, Eye, EyeOff } from "lucide-react";

const SECTIONS=[
  {key:"profile",  icon:User,    label:"Profile"},
  {key:"security", icon:Shield,  label:"Security"},
  {key:"display",  icon:Monitor, label:"Display"},
  {key:"alerts",   icon:Bell,    label:"Alerts"},
  {key:"data",     icon:Database,label:"Data"},
  {key:"api",      icon:Key,     label:"API Keys"},
] as const;
type Section=(typeof SECTIONS)[number]["key"];

const ROLE_LABELS:Record<string,string>={
  PILOT:"Pilot Operator",ENGINEER:"Systems Engineer",
  COMMANDER:"Mission Commander",INSTRUCTOR:"Instructor",ADMIN:"Administrator",
};

function SaveButton({saving,saved,onClick}:{saving:boolean;saved:boolean;onClick:()=>void}){
  return(
    <button onClick={onClick} disabled={saving}
      className={clsx("flex items-center gap-1.5 px-4 py-1.5 rounded border font-mono text-xs tracking-widest transition-all",
        saved?"border-threat-low/40 bg-threat-low/5 text-threat-low":
        "border-border-active bg-cyan-subtle text-cyan-DEFAULT hover:shadow-cyan-sm",
        saving&&"opacity-60 cursor-not-allowed")}>
      {saving?<><Loader2 className="w-3 h-3 animate-spin"/>SAVING</>
       :saved?<><CheckCircle className="w-3 h-3"/>SAVED</>
       :<><Save className="w-3 h-3"/>SAVE</>}
    </button>
  );
}

function Row({label,hint,children}:{label:string;hint?:string;children:React.ReactNode}){
  return(
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border-dim last:border-0">
      <div className="min-w-0">
        <p className="font-mono text-xs text-text-primary">{label}</p>
        {hint&&<p className="font-mono text-2xs text-text-dim mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({value,onChange}:{value:boolean;onChange:(v:boolean)=>void}){
  return(
    <button onClick={()=>onChange(!value)}
      className={clsx("w-10 h-5 rounded-full transition-colors relative",value?"bg-cyan-DEFAULT":"bg-bg-base border border-border-dim")}>
      <span className={clsx("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",value?"left-5":"left-0.5")}/>
    </button>
  );
}

export default function SettingsPage(){
  const{user,accessToken:token}=useAuthStore();
  const[section,setSection]=useState<Section>("profile");
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const[showPw,setShowPw]=useState(false);

  // Profile state
  const[username,setUsername]=useState(user?.username??"");
  const[email,setEmail]=useState(user?.email??"");

  // Security state
  const[currentPw,setCurrentPw]=useState("");
  const[newPw,setNewPw]=useState("");
  const[confirmPw,setConfirmPw]=useState("");
  const[pwError,setPwError]=useState("");

  // Display state
  const[mapStyle,setMapStyle]=useState("dark");
  const[units,setUnits]=useState("metric");
  const[fps60,setFps60]=useState(true);
  const[showGrid,setShowGrid]=useState(false);

  // Alerts state
  const[alertThreat,setAlertThreat]=useState(true);
  const[alertBattery,setAlertBattery]=useState(true);
  const[alertLinkLoss,setAlertLinkLoss]=useState(true);
  const[alertMission,setAlertMission]=useState(false);

  const save=async()=>{
    setSaving(true); setPwError("");
    try {
      if(section==="security"){
        if(newPw&&newPw!==confirmPw){setPwError("Passwords do not match");setSaving(false);return;}
        if(newPw&&newPw.length<8){setPwError("Min 8 characters");setSaving(false);return;}
      }
      // Simulate API call (real endpoint would be PATCH /api/auth/profile)
      await new Promise(r=>setTimeout(r,600));
      setSaved(true); setTimeout(()=>setSaved(false),3000);
    } finally { setSaving(false); }
  };

  const inputCls="bg-bg-base border border-border-dim rounded px-3 py-1.5 font-mono text-xs text-text-primary focus:outline-none focus:border-border-active w-56";

  return(
    <div className="p-5 max-w-3xl space-y-5">
      <div>
        <p className="font-mono text-2xs text-text-secondary tracking-widest mb-0.5">SETTINGS</p>
        <h1 className="font-mono text-base text-text-primary tracking-wide">Account & Preferences</h1>
      </div>

      <div className="flex gap-4">
        {/* Sidebar */}
        <div className="w-44 shrink-0 space-y-0.5">
          {SECTIONS.map(({key,icon:Icon,label})=>(
            <button key={key} onClick={()=>setSection(key)}
              className={clsx("w-full flex items-center gap-2.5 px-3 py-2 rounded font-mono text-xs transition-all",
                section===key?"bg-cyan-subtle text-cyan-DEFAULT border border-border-active":
                "text-text-secondary hover:text-text-primary hover:bg-bg-raised border border-transparent")}>
              <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5}/>{label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-bg-surface border border-border-dim rounded p-5">

          {section==="profile"&&(
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="font-mono text-xs text-text-secondary tracking-widest">PROFILE</p>
                <SaveButton saving={saving} saved={saved} onClick={save}/>
              </div>
              {/* Avatar */}
              <div className="flex items-center gap-4 mb-5 pb-4 border-b border-border-dim">
                <div className="w-14 h-14 rounded bg-bg-raised border border-border-dim flex items-center justify-center">
                  <span className="font-mono text-xl text-cyan-DEFAULT font-bold">
                    {(user?.username??"U").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-mono text-sm text-text-primary font-medium">{user?.username}</p>
                  <p className="font-mono text-2xs text-text-secondary">{ROLE_LABELS[user?.role??"PILOT"]??user?.role}</p>
                  <p className={clsx("font-mono text-2xs mt-0.5",user?.status==="ACTIVE"?"text-threat-low":"text-threat-medium")}>
                    ● {user?.status??"ACTIVE"}
                  </p>
                </div>
              </div>
              <Row label="Username" hint="Your display name">
                <input value={username} onChange={e=>setUsername(e.target.value)} className={inputCls}/>
              </Row>
              <Row label="Email" hint="Used for notifications">
                <input value={email} onChange={e=>setEmail(e.target.value)} className={inputCls} type="email"/>
              </Row>
              <Row label="Role" hint="Assigned by admin">
                <span className="font-mono text-xs text-text-secondary border border-border-dim rounded px-3 py-1.5 block w-56 bg-bg-base">
                  {ROLE_LABELS[user?.role??"PILOT"]??user?.role}
                </span>
              </Row>
            </div>
          )}

          {section==="security"&&(
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="font-mono text-xs text-text-secondary tracking-widest">SECURITY</p>
                <SaveButton saving={saving} saved={saved} onClick={save}/>
              </div>
              <Row label="Current password">
                <div className="relative">
                  <input value={currentPw} onChange={e=>setCurrentPw(e.target.value)}
                    type={showPw?"text":"password"} className={inputCls} placeholder="••••••••"/>
                  <button onClick={()=>setShowPw(!showPw)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-secondary">
                    {showPw?<EyeOff className="w-3.5 h-3.5"/>:<Eye className="w-3.5 h-3.5"/>}
                  </button>
                </div>
              </Row>
              <Row label="New password" hint="Min 8 characters">
                <input value={newPw} onChange={e=>setNewPw(e.target.value)}
                  type="password" className={inputCls} placeholder="••••••••"/>
              </Row>
              <Row label="Confirm password">
                <input value={confirmPw} onChange={e=>setConfirmPw(e.target.value)}
                  type="password" className={clsx(inputCls,confirmPw&&newPw!==confirmPw?"border-threat-high":"")} placeholder="••••••••"/>
              </Row>
              {pwError&&<p className="font-mono text-2xs text-threat-high mt-2">{pwError}</p>}
              <div className="mt-4 pt-4 border-t border-border-dim">
                <p className="font-mono text-2xs text-text-secondary tracking-widest mb-3">ACTIVE SESSIONS</p>
                <div className="bg-bg-raised border border-border-dim rounded p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs text-text-primary">Current session</p>
                      <p className="font-mono text-2xs text-text-dim">Browser · This device</p>
                    </div>
                    <span className="font-mono text-2xs text-threat-low border border-threat-low/30 bg-threat-low/5 px-2 py-0.5 rounded">ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section==="display"&&(
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="font-mono text-xs text-text-secondary tracking-widest">DISPLAY</p>
                <SaveButton saving={saving} saved={saved} onClick={save}/>
              </div>
              <Row label="Map style" hint="Tactical map tile style">
                <select value={mapStyle} onChange={e=>setMapStyle(e.target.value)}
                  className={inputCls}>
                  <option value="dark">Dark (military)</option>
                  <option value="satellite">Satellite</option>
                  <option value="terrain">Terrain</option>
                </select>
              </Row>
              <Row label="Units" hint="Measurement system">
                <select value={units} onChange={e=>setUnits(e.target.value)} className={inputCls}>
                  <option value="metric">Metric (m, km, m/s)</option>
                  <option value="imperial">Imperial (ft, mi, knots)</option>
                </select>
              </Row>
              <Row label="60Hz simulator" hint="Higher CPU usage">
                <Toggle value={fps60} onChange={setFps60}/>
              </Row>
              <Row label="Map grid overlay">
                <Toggle value={showGrid} onChange={setShowGrid}/>
              </Row>
            </div>
          )}

          {section==="alerts"&&(
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="font-mono text-xs text-text-secondary tracking-widest">ALERT SETTINGS</p>
                <SaveButton saving={saving} saved={saved} onClick={save}/>
              </div>
              <Row label="Threat detected" hint="Radar warning / lock alerts">
                <Toggle value={alertThreat} onChange={setAlertThreat}/>
              </Row>
              <Row label="Low battery" hint="Below 20% remaining">
                <Toggle value={alertBattery} onChange={setAlertBattery}/>
              </Row>
              <Row label="Link loss" hint="RC / datalink loss events">
                <Toggle value={alertLinkLoss} onChange={setAlertLinkLoss}/>
              </Row>
              <Row label="Mission events" hint="Waypoint reached, RTH">
                <Toggle value={alertMission} onChange={setAlertMission}/>
              </Row>
            </div>
          )}

          {section==="data"&&(
            <div>
              <p className="font-mono text-xs text-text-secondary tracking-widest mb-4">DATA MANAGEMENT</p>
              <div className="space-y-3">
                {[
                  {label:"Export flight logs",desc:"Download all flight records as JSON",btn:"EXPORT"},
                  {label:"Export missions",   desc:"Download saved missions as .json",  btn:"EXPORT"},
                  {label:"Export certificates",desc:"Download cert records as PDF",     btn:"EXPORT"},
                ].map(({label,desc,btn})=>(
                  <div key={label} className="flex items-center justify-between py-3 border-b border-border-dim last:border-0">
                    <div>
                      <p className="font-mono text-xs text-text-primary">{label}</p>
                      <p className="font-mono text-2xs text-text-dim">{desc}</p>
                    </div>
                    <button className="font-mono text-2xs text-cyan-DEFAULT border border-border-active bg-cyan-subtle px-3 py-1.5 rounded tracking-widest hover:shadow-cyan-sm transition-all">
                      {btn}
                    </button>
                  </div>
                ))}
                <div className="pt-2">
                  <p className="font-mono text-xs text-threat-high mb-1">Danger zone</p>
                  <p className="font-mono text-2xs text-text-dim mb-3">Permanently delete all your data. This cannot be undone.</p>
                  <button className="font-mono text-2xs text-threat-high border border-threat-high/40 bg-threat-high/5 px-4 py-1.5 rounded tracking-widest hover:bg-threat-high/10 transition-all">
                    DELETE ACCOUNT
                  </button>
                </div>
              </div>
            </div>
          )}

          {section==="api"&&(
            <div>
              <p className="font-mono text-xs text-text-secondary tracking-widest mb-4">API KEYS</p>
              <div className="bg-bg-raised border border-border-dim rounded p-3 mb-4">
                <p className="font-mono text-2xs text-text-secondary mb-1">YOUR JWT TOKEN</p>
                <p className="font-mono text-2xs text-text-dim break-all leading-relaxed">
                  {token ? `${token.slice(0,40)}…` : "Not authenticated"}
                </p>
              </div>
              <p className="font-mono text-2xs text-text-secondary mb-3">API DOCUMENTATION</p>
              <a href="http://localhost:8000/api/docs" target="_blank" rel="noopener"
                className="font-mono text-xs text-cyan-DEFAULT hover:underline">
                http://localhost:8000/api/docs →
              </a>
              <div className="mt-4 pt-4 border-t border-border-dim">
                <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2">AVAILABLE ENDPOINTS</p>
                {["/api/auth/*","/api/fleet/*","/api/missions/*","/api/training/*","/api/sam/*","/api/ew/*"].map(ep=>(
                  <p key={ep} className="font-mono text-2xs text-text-dim py-0.5">{ep}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
