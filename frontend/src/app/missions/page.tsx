"use client";
import { useState, useCallback } from "react";
import { useMission } from "@/lib/hooks/useMission";
import { MissionMap }     from "@/components/mission/MissionMap";
import { WaypointList }   from "@/components/mission/WaypointList";
import { MissionToolbar } from "@/components/mission/MissionToolbar";
import { clsx } from "clsx";

type Tool="select"|"waypoint"|"sam"|"ew";

export default function MissionsPage(){
  const [tool,setTool]=useState<Tool>("waypoint");
  const [samPreset,setSamPreset]=useState("tor-m1");
  const {mission,addWaypoint,updateWaypoint,removeWaypoint,addSite,analyzeThreat,clear,setMission}=useMission();

  const moveUp=useCallback((idx:number)=>{
    setMission(m=>{if(idx===0) return m; const wps=[...m.waypoints];[wps[idx-1],wps[idx]]=[wps[idx],wps[idx-1]];return{...m,waypoints:wps};});
  },[setMission]);

  const moveDown=useCallback((idx:number)=>{
    setMission(m=>{if(idx>=m.waypoints.length-1) return m; const wps=[...m.waypoints];[wps[idx],wps[idx+1]]=[wps[idx+1],wps[idx]];return{...m,waypoints:wps};});
  },[setMission]);

  return(
    <div className="flex flex-col h-full overflow-hidden">
      <MissionToolbar
        tool={tool} samPreset={samPreset} onTool={setTool} onSamPreset={setSamPreset}
        onAnalyze={analyzeThreat} onClear={clear} analyzing={mission.analyzing}
        wpCount={mission.waypoints.length} siteCount={mission.sites.length} overallRisk={mission.overall_risk}/>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <MissionMap waypoints={mission.waypoints} sites={mission.sites}
            tool={tool} samPreset={samPreset} onAddWaypoint={addWaypoint} onAddSite={addSite}/>
        </div>
        <div className="w-72 shrink-0 border-l border-border-dim bg-bg-surface flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border-dim">
            <input value={mission.name} onChange={e=>setMission(m=>({...m,name:e.target.value}))}
              className="w-full bg-transparent font-mono text-sm text-text-primary focus:outline-none"/>
            <p className="font-mono text-2xs text-text-dim mt-0.5">{mission.waypoints.length} waypoints · {mission.sites.length} threats</p>
          </div>
          <div className="p-3 border-b border-border-dim">
            <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2">UAV PARAMS</p>
            <div className="grid grid-cols-2 gap-2">
              {[{label:"RCS (m²)",key:"uav_rcs",val:mission.uav_rcs,min:0.01,max:10,step:0.01},
                {label:"SPEED (m/s)",key:"uav_speed",val:mission.uav_speed,min:1,max:300,step:1}].map(({label,key,val,min,max,step})=>(
                <div key={key}>
                  <label className="font-mono text-2xs text-text-dim block mb-0.5">{label}</label>
                  <input type="number" value={val} min={min} max={max} step={step}
                    onChange={e=>setMission(m=>({...m,[key]:Number(e.target.value)}))}
                    className="w-full bg-bg-base border border-border-dim rounded px-2 py-1 font-mono text-2xs text-text-primary focus:outline-none focus:border-border-active"/>
                </div>
              ))}
            </div>
          </div>
          {mission.overall_risk>0&&(
            <div className={clsx("mx-3 mt-3 p-2.5 rounded border",
              mission.overall_risk>0.7?"border-purple-400/40 bg-purple-500/10":
              mission.overall_risk>0.4?"border-threat-high/40 bg-threat-high/10":
              mission.overall_risk>0.15?"border-threat-medium/40 bg-threat-medium/10":"border-threat-low/40 bg-threat-low/10")}>
              <p className="font-mono text-2xs text-text-secondary">OVERALL ROUTE RISK</p>
              <p className={clsx("font-mono text-xl font-medium mt-0.5",
                mission.overall_risk>0.7?"text-purple-400":mission.overall_risk>0.4?"text-threat-high":
                mission.overall_risk>0.15?"text-threat-medium":"text-threat-low")}>
                {(mission.overall_risk*100).toFixed(0)}%
              </p>
            </div>
          )}
          <div className="flex-1 overflow-hidden p-3">
            <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2">WAYPOINTS</p>
            <WaypointList waypoints={mission.waypoints} onUpdate={updateWaypoint}
              onRemove={removeWaypoint} onMoveUp={moveUp} onMoveDown={moveDown}/>
          </div>
        </div>
      </div>
    </div>
  );
}
