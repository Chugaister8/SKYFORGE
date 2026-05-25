"use client";
import { useState, useCallback } from "react";
import { useMission, useSavedMissions } from "@/lib/hooks/useMission";
import { GlobeToggle }       from "@/components/globe/GlobeToggle";
import { WaypointList }      from "@/components/mission/WaypointList";
import { MissionToolbar }    from "@/components/mission/MissionToolbar";
import { ScenarioLoader }    from "@/components/mission/ScenarioLoader";
import { clsx } from "clsx";
import { Save, FolderOpen, Trash2, CheckCircle, Loader2, WifiOff } from "lucide-react";
import { SkeletonList } from "@/components/ui/Skeleton";
import type { Waypoint, ThreatSite } from "@/lib/hooks/useMission";

type Tool = "select"|"waypoint"|"sam"|"ew";

export default function MissionsPage() {
  const [tool,           setTool]           = useState<Tool>("waypoint");
  const [samPreset,      setSamPreset]      = useState("tor-m1");
  const [showLoad,       setShowLoad]       = useState(false);
  const [showScenario,   setShowScenario]   = useState(false);

  const {
    mission, setMission,
    addWaypoint, updateWaypoint, removeWaypoint,
    addSite, analyzeThreat, saveMission, loadMission, deleteMission, clear,
  } = useMission();

  const { data: savedData, isLoading: savedLoading } = useSavedMissions();
  const savedMissions = savedData?.data ?? [];

  const moveUp   = useCallback((idx:number) => {
    setMission(m => { if(idx===0) return m; const w=[...m.waypoints];[w[idx-1],w[idx]]=[w[idx],w[idx-1]];return{...m,waypoints:w}; });
  },[setMission]);

  const moveDown = useCallback((idx:number) => {
    setMission(m => { if(idx>=m.waypoints.length-1) return m; const w=[...m.waypoints];[w[idx],w[idx+1]]=[w[idx+1],w[idx]];return{...m,waypoints:w}; });
  },[setMission]);

  /** Load a generated scenario into the planner. */
  const handleScenarioLoad = useCallback((scenarioData: any) => {
    setMission(m => ({
      ...m,
      name:         scenarioData.name ?? m.name,
      waypoints:    (scenarioData.waypoints ?? []) as Waypoint[],
      sites:        (scenarioData.threat_sites ?? []) as ThreatSite[],
      uav_rcs:      scenarioData.uav_rcs  ?? m.uav_rcs,
      uav_speed:    scenarioData.uav_speed ?? m.uav_speed,
      overall_risk: 0,
      saved:        false,
      id:           null,
    }));
  }, [setMission]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MissionToolbar
        tool={tool} samPreset={samPreset} onTool={setTool} onSamPreset={setSamPreset}
        onAnalyze={analyzeThreat} onClear={clear} analyzing={mission.analyzing}
        wpCount={mission.waypoints.length} siteCount={mission.sites.length}
        overallRisk={mission.overall_risk}
        onLoadScenario={() => setShowScenario(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Map / Globe */}
        <div className="flex-1 relative">
          <GlobeToggle
            waypoints={mission.waypoints} sites={mission.sites}
            tool={tool} samPreset={samPreset}
            onAddWaypoint={addWaypoint} onAddSite={addSite}
          />
        </div>

        {/* Right panel */}
        <div className="w-72 shrink-0 border-l border-border-dim bg-bg-surface flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border-dim space-y-2">
            <input value={mission.name} onChange={e=>setMission(m=>({...m,name:e.target.value}))}
              className="w-full bg-transparent font-mono text-sm text-text-primary focus:outline-none"/>
            <p className="font-mono text-2xs text-text-dim">
              {mission.waypoints.length} WP · {mission.sites.length} threats
              {mission.id && <span className="ml-2 opacity-40">#{mission.id.slice(0,8)}</span>}
            </p>
            <div className="flex gap-1.5">
              <button onClick={saveMission} disabled={mission.saving}
                className={clsx("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded border font-mono text-2xs tracking-widest transition-all",
                  mission.saved?"border-threat-low/40 text-threat-low bg-threat-low/5":"border-border-active bg-cyan-subtle text-cyan-DEFAULT hover:shadow-cyan-sm",
                  mission.saving&&"opacity-60 cursor-not-allowed")}>
                {mission.saving?<><Loader2 className="w-3 h-3 animate-spin"/>SAVING</>
                 :mission.saved?<><CheckCircle className="w-3 h-3"/>SAVED</>
                 :<><Save className="w-3 h-3"/>SAVE</>}
              </button>
              <button onClick={()=>setShowLoad(!showLoad)}
                className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono text-2xs tracking-widest transition-all",
                  showLoad?"border-border-active bg-cyan-subtle text-cyan-DEFAULT":"border-border-dim text-text-secondary hover:text-text-primary")}>
                <FolderOpen className="w-3 h-3"/>LOAD
              </button>
            </div>

            {showLoad && (
              <div className="bg-bg-base border border-border-dim rounded overflow-hidden max-h-48 overflow-y-auto">
                {savedLoading
                  ? <SkeletonList count={3} />
                  : savedMissions.length===0
                  ? <p className="p-3 font-mono text-2xs text-text-dim text-center">No saved missions</p>
                  : savedMissions.map(m => (
                    <div key={m.id} className="flex items-center gap-2 px-2.5 py-2 border-b border-border-dim last:border-0 hover:bg-bg-surface transition-colors">
                      <button onClick={()=>{loadMission(m);setShowLoad(false);}} className="flex-1 text-left">
                        <p className="font-mono text-2xs text-text-primary">{m.name}</p>
                        <p className="font-mono text-2xs text-text-dim">{m.waypoints?.length??0} WP</p>
                      </button>
                      <button onClick={()=>deleteMission(m.id)} className="p-1 text-text-dim hover:text-threat-high transition-colors">
                        <Trash2 className="w-3 h-3"/>
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* UAV params */}
          <div className="p-3 border-b border-border-dim">
            <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2">UAV PARAMS</p>
            <div className="grid grid-cols-2 gap-2">
              {[{label:"RCS (m²)",key:"uav_rcs",val:mission.uav_rcs,min:0.01,max:10,step:0.01},
                {label:"SPEED m/s",key:"uav_speed",val:mission.uav_speed,min:1,max:300,step:1}].map(({label,key,val,min,max,step})=>(
                <div key={key}>
                  <label className="font-mono text-2xs text-text-dim block mb-0.5">{label}</label>
                  <input type="number" value={val} min={min} max={max} step={step}
                    onChange={e=>setMission(m=>({...m,[key]:Number(e.target.value),saved:false}))}
                    className="w-full bg-bg-base border border-border-dim rounded px-2 py-1 font-mono text-2xs text-text-primary focus:outline-none focus:border-border-active"/>
                </div>
              ))}
            </div>
          </div>

          {mission.overall_risk>0 && (
            <div className={clsx("mx-3 mt-3 p-2.5 rounded border",
              mission.overall_risk>0.7?"border-purple-400/40 bg-purple-500/10":mission.overall_risk>0.4?"border-threat-high/40 bg-threat-high/10":
              mission.overall_risk>0.15?"border-threat-medium/40 bg-threat-medium/10":"border-threat-low/40 bg-threat-low/10")}>
              <p className="font-mono text-2xs text-text-secondary">OVERALL RISK</p>
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

      {showScenario && (
        <ScenarioLoader onLoad={handleScenarioLoad} onClose={() => setShowScenario(false)}/>
      )}
    </div>
  );
}
