"use client";
import { useState, useCallback, useEffect } from "react";
import { useEventStore }          from "@/lib/store/event.store";
import { usePushNotifications }   from "@/lib/hooks/usePushNotifications";
import { useRouter } from "next/navigation";
import { useSimulatorWS as useSimulator } from "@/lib/hooks/useSimulatorWS";
import { useSavedMissions } from "@/lib/hooks/useMission";
import { useAuthStore } from "@/lib/store/auth.store";
import { api } from "@/lib/api";
import { SimViewport }       from "@/components/simulator/SimViewport";
import { FlightInstruments } from "@/components/simulator/FlightInstruments";
import { ControlPanel }      from "@/components/simulator/ControlPanel";
import { EWPanel }           from "@/components/simulator/EWPanel";
import { ErrorBoundary }     from "@/components/ui/ErrorBoundary";
import { clsx } from "clsx";
import {
  ChevronLeft, Eye, Crosshair, Map, Target, CheckCircle,
  Play, Square, RotateCcw, Navigation, AlertTriangle,
  Loader2, Save,
} from "lucide-react";
import Link from "next/link";
import type { SavedMission } from "@/lib/hooks/useMission";

const PRESETS = [
  {id:"mavic-3t",     label:"Mavic 3T",       type:"MULTI"},
  {id:"leleka-100",   label:"Leleka-100",      type:"FW"},
  {id:"bayraktar-tb2",label:"Bayraktar TB2",   type:"FW"},
  {id:"uj-22",        label:"UJ-22 Airborne",  type:"FW"},
];

type ViewMode = "fpv"|"third"|"map";
const VIEW_MODES: [ViewMode, any, string][] = [
  ["fpv",   Crosshair, "FPV"],
  ["third", Eye,       "3RD"],
  ["map",   Map,       "MAP"],
];

export default function SimulatorPage() {
  const router = useRouter();
  const token  = useAuthStore(s => s.accessToken);
  const [selectedUAV,  setSelectedUAV]  = useState(PRESETS[0].id);
  const [viewMode,     setViewMode]     = useState<ViewMode>("third");
  const [showEW,       setShowEW]       = useState(false);
  const [activeMission,setActiveMission]= useState<SavedMission|null>(null);
  const [showMissions, setShowMissions] = useState(false);
  const [savingAAR,    setSavingAAR]    = useState(false);
  const [aarSaved,     setAARSaved]     = useState(false);
  const [autopilot,    setAutopilot]    = useState(false);
  const [injectedFailure, setInjectedFailure] = useState<any>(null);

  // Send threat alerts to dashboard
  useEffect(() => {
    if (sim.ewState.radar_lock) {
      useEventStore.getState().emit("ALERT", {
        type: "THREAT", severity: "critical",
        title: "RADAR LOCK",
        message: `${sim.ewState.threat_level} threat — simulator active`,
      });
    }
  }, [sim.ewState.radar_lock]);

  // Read injected failure from event bus
  const failureEvent = useEventStore(s => s.last("FAILURE_INJECTED"));
  useEffect(() => {
    if (failureEvent) {
      setInjectedFailure(failureEvent.payload as any);
      useEventStore.getState().consume("FAILURE_INJECTED");
    }
  }, [failureEvent]);

  const { data: missionsData } = useSavedMissions();
  const savedMissions = missionsData?.data ?? [];

  const sim  = useSimulator(selectedUAV, activeMission);
  const push = usePushNotifications();
  const wsConnected = (sim as any).connected ?? true;

  // Local push notification on threat detection
  const prevRadarRef = useState(false);
  useEffect(() => {
    if (sim.ewState.radar_warning && !prevRadarRef[0]) {
      push.notify("⚠️ RADAR DETECTED", `Threat level: ${sim.ewState.threat_level}`, "skyforge-threat");
    }
    prevRadarRef[1](sim.ewState.radar_warning);
  }, [sim.ewState.radar_warning]);

  // Save AAR when mission completes
  const handleSaveAAR = useCallback(async () => {
    if (!activeMission?.id || !token) return;
    setSavingAAR(true);
    try {
      const log = sim.flightLog.getFullLog();
      await api.post(`/missions/${activeMission.id}/aar`, {
        aar_data:   { events: log.events, metrics: { duration_s: log.duration_s } },
        duration_s: log.duration_s,
        score:      0,   // server computes from log
        flight_log: log,
      }, token);
      setAARSaved(true);
    } finally {
      setSavingAAR(false);
    }
  }, [activeMission, token, sim.flightLog]);

  // View AAR
  const handleViewAAR = useCallback(() => {
    router.push("/aar");
  }, [router]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-base">
      {/* Injected failure banner */}
      {injectedFailure && (
        <div className="fixed top-0 inset-x-0 z-50 bg-threat-high/90 border-b border-threat-high px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-white" strokeWidth={1.5}/>
            <span className="font-mono text-xs text-white font-medium">
              FAILURE INJECTED: {injectedFailure.name}
            </span>
            {!injectedFailure.can_continue && (
              <span className="font-mono text-2xs text-white bg-white/20 px-2 py-0.5 rounded">
                LAND NOW
              </span>
            )}
          </div>
          <button onClick={() => setInjectedFailure(null)} className="font-mono text-2xs text-white/70 hover:text-white">
            dismiss ×
          </button>
        </div>
      )}

      {/* Left panel */}
      <div className="w-64 shrink-0 flex flex-col border-r border-border-dim bg-bg-surface overflow-y-auto">
        <div className="p-3 border-b border-border-dim flex items-center gap-2 shrink-0">
          <Link href="/dashboard"
            className="p-1 rounded hover:bg-bg-raised text-text-secondary hover:text-text-primary transition-colors">
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5}/>
          </Link>
          <span className="font-mono text-xs text-text-primary tracking-widest">SIMULATOR</span>
        </div>

        {/* Mission selector */}
        <div className="p-3 border-b border-border-dim shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-2xs text-text-secondary tracking-widest">MISSION</p>
            <button onClick={() => setShowMissions(!showMissions)}
              className="font-mono text-2xs text-cyan-DEFAULT hover:underline">
              {showMissions ? "hide" : "select"}
            </button>
          </div>

          {activeMission ? (
            <div className="bg-bg-raised border border-border-active rounded p-2">
              <p className="font-mono text-xs text-cyan-DEFAULT font-medium truncate">{activeMission.name}</p>
              <p className="font-mono text-2xs text-text-dim mt-0.5">
                {activeMission.waypoints?.length ?? 0} WP · {activeMission.threat_sites?.length ?? 0} threats
              </p>
              <button onClick={() => setActiveMission(null)}
                className="font-mono text-2xs text-text-dim hover:text-threat-high mt-1 transition-colors">
                clear ×
              </button>
            </div>
          ) : (
            <p className="font-mono text-2xs text-text-dim">No mission loaded — free flight</p>
          )}

          {showMissions && (
            <div className="mt-2 bg-bg-base border border-border-dim rounded overflow-hidden max-h-36 overflow-y-auto">
              {savedMissions.length === 0 ? (
                <p className="p-2 font-mono text-2xs text-text-dim text-center">
                  No saved missions.{" "}
                  <Link href="/missions" className="text-cyan-DEFAULT hover:underline">Create one →</Link>
                </p>
              ) : savedMissions.map(m => (
                <button key={m.id}
                  onClick={() => { setActiveMission(m); setShowMissions(false); sim.reset(); }}
                  className="w-full text-left px-2.5 py-2 hover:bg-bg-surface border-b border-border-dim last:border-0 transition-colors">
                  <p className="font-mono text-2xs text-text-primary truncate">{m.name}</p>
                  <p className="font-mono text-2xs text-text-dim">{m.waypoints?.length ?? 0} WP</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* UAV selector */}
        <div className="p-3 border-b border-border-dim shrink-0">
          <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2">UAV</p>
          <div className="space-y-1">
            {PRESETS.map(p => (
              <button key={p.id}
                onClick={() => { sim.reset(); setSelectedUAV(p.id); }}
                disabled={sim.running}
                className={clsx(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded border text-left transition-all",
                  selectedUAV===p.id
                    ? "border-border-active bg-cyan-subtle"
                    : "border-border-dim hover:border-border-active bg-bg-raised",
                  sim.running && "opacity-50 cursor-not-allowed",
                )}>
                <span className={clsx("font-mono text-xs", selectedUAV===p.id?"text-cyan-DEFAULT":"text-text-primary")}>
                  {p.label}
                </span>
                <span className="font-mono text-2xs text-text-dim">{p.type}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Autopilot toggle */}
        {activeMission?.waypoints?.length ? (
          <div className="p-3 border-b border-border-dim shrink-0">
            <div className="flex items-center justify-between">
              <p className="font-mono text-2xs text-text-secondary tracking-widest">AUTOPILOT</p>
              <button onClick={() => setAutopilot(!autopilot)}
                className={clsx("w-10 h-5 rounded-full transition-colors relative",
                  autopilot ? "bg-cyan-DEFAULT" : "bg-bg-base border border-border-dim")}>
                <span className={clsx("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                  autopilot?"left-5":"left-0.5")}/>
              </button>
            </div>
            {autopilot && (
              <div className="mt-2 space-y-1">
                <p className="font-mono text-2xs text-text-dim">
                  WP {sim.wpStatus.index + 1}/{activeMission.waypoints.length}
                </p>
                <div className="h-1 bg-bg-base rounded overflow-hidden">
                  <div className="h-full bg-cyan-DEFAULT transition-all"
                    style={{width:`${(sim.wpStatus.index/activeMission.waypoints.length)*100}%`}}/>
                </div>
                <p className="font-mono text-2xs text-text-dim">
                  {sim.wpStatus.dist_m < 1000
                    ? `${sim.wpStatus.dist_m.toFixed(0)}m to next`
                    : `${(sim.wpStatus.dist_m/1000).toFixed(1)}km to next`}
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* Controls */}
        <div className="p-3 shrink-0">
          <ControlPanel sim={sim}/>
        </div>

        {/* Mission complete + save AAR */}
        {sim.missionComplete && (
          <div className="p-3 border-t border-border-dim shrink-0">
            <div className="bg-threat-low/10 border border-threat-low/40 rounded p-3 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-threat-low" strokeWidth={1.5}/>
                <p className="font-mono text-xs text-threat-low font-medium">Mission Complete!</p>
              </div>
              {!aarSaved ? (
                <button onClick={handleSaveAAR} disabled={savingAAR}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-border-active bg-cyan-subtle text-cyan-DEFAULT font-mono text-2xs tracking-widest transition-all disabled:opacity-60">
                  {savingAAR
                    ? <><Loader2 className="w-3 h-3 animate-spin"/>SAVING AAR...</>
                    : <><Save className="w-3 h-3"/>SAVE AAR</>}
                </button>
              ) : (
                <button onClick={handleViewAAR}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-threat-low bg-threat-low/10 text-threat-low font-mono text-2xs tracking-widest hover:bg-threat-low/20 transition-all">
                  <CheckCircle className="w-3 h-3"/>VIEW AAR
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* View toggle */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-dim bg-bg-surface shrink-0">
          <div className="flex items-center gap-1">
            {VIEW_MODES.map(([mode, Icon, label]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-2xs tracking-widest transition-all",
                  viewMode===mode ? "bg-cyan-subtle text-cyan-DEFAULT border border-border-active" : "text-text-secondary hover:text-text-primary",
                )}>
                <Icon className="w-3 h-3" strokeWidth={1.5}/>{label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowEW(!showEW)}
            className={clsx("flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-2xs tracking-widest transition-all",
              showEW ? "border-purple-400/60 bg-purple-500/10 text-purple-400" : "border-border-dim text-text-secondary hover:text-text-primary")}>
            <AlertTriangle className="w-3 h-3" strokeWidth={1.5}/>EW
          {!wsConnected && sim.running && (
            <span className="font-mono text-2xs text-threat-high border border-threat-high/40 px-2 py-1 rounded">WS OFFLINE</span>
          )}
          </button>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <ErrorBoundary context="SimViewport">
            <SimViewport state={sim.state} ewState={sim.ewState} viewMode={viewMode}
              mission={activeMission}/>
          </ErrorBoundary>

          {showEW && (
            <div className="absolute top-2 right-2 z-10 w-64">
              <EWPanel ewState={sim.ewState} onUpdate={sim.updateEW}/>
            </div>
          )}

          {/* Waypoint HUD overlay */}
          {activeMission && sim.running && !sim.missionComplete && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <div className="flex items-center gap-2 bg-bg-base/80 border border-border-active rounded px-3 py-1.5">
                <Navigation className="w-3 h-3 text-cyan-DEFAULT" strokeWidth={1.5}/>
                <span className="font-mono text-2xs text-cyan-DEFAULT">
                  WP {sim.wpStatus.index + 1}/{activeMission.waypoints?.length ?? 0}
                  {" · "}
                  {sim.wpStatus.dist_m < 1000
                    ? `${sim.wpStatus.dist_m.toFixed(0)}m`
                    : `${(sim.wpStatus.dist_m/1000).toFixed(1)}km`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Instruments */}
        <div className="shrink-0 border-t border-border-dim">
          <FlightInstruments state={sim.state}/>
        </div>
      </div>
    </div>
  );
}
