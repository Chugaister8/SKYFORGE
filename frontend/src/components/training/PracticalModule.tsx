"use client";
/**
 * Practical exam — real simulator scenario instead of quiz.
 * Loads a pre-built scenario, runs the simulator, grades by outcomes.
 */
import { useState, useCallback, useRef } from "react";
import { clsx } from "clsx";
import {
  Play, Square, CheckCircle, XCircle, Clock,
  ChevronLeft, Navigation, AlertTriangle, Loader2,
  Crosshair, Award,
} from "lucide-react";
import { useSimulatorWS } from "@/lib/hooks/useSimulatorWS";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";

const SCENARIOS: Record<string, {
  name:        string;
  description: string;
  libraryId:   string;
  waypoints:   Array<{ id:string; lat:number; lon:number; alt_m:number; speed_ms:number; action:string; risk:string; max_pk:number }>;
  timeLimit:   number; // seconds
  objectives:  string[];
  passScore:   number;
}> = {
  "fpv-strike-m6": {
    name:      "Strike Run — Practical Exam",
    description:"Complete a NOE strike approach, evade one SAM site, reach the target.",
    libraryId: "mavic-3t",
    waypoints: [
      { id:"wp1", lat:48.3800, lon:31.1600, alt_m:50,  speed_ms:22, action:"WAYPOINT", risk:"SAFE",   max_pk:0 },
      { id:"wp2", lat:48.3850, lon:31.1700, alt_m:30,  speed_ms:25, action:"WAYPOINT", risk:"MEDIUM", max_pk:0.2 },
      { id:"wp3", lat:48.3900, lon:31.1800, alt_m:20,  speed_ms:28, action:"WAYPOINT", risk:"HIGH",   max_pk:0.4 },
      { id:"wp4", lat:48.3950, lon:31.1900, alt_m:15,  speed_ms:28, action:"WAYPOINT", risk:"HIGH",   max_pk:0.4 },
      { id:"wp5", lat:48.4000, lon:31.2000, alt_m:100, speed_ms:20, action:"LAND",     risk:"SAFE",   max_pk:0 },
    ],
    timeLimit:  180,
    objectives: [
      "Navigate all 5 waypoints",
      "Maintain NOE (≤50m) through threat zone",
      "Complete within time limit",
      "Land safely at final waypoint",
    ],
    passScore: 80,
  },
  "isr-tactical-m6": {
    name:       "ISR Patrol — Practical Exam",
    description:"Execute a full ISR patrol pattern, maintain altitude, reach all waypoints.",
    libraryId:  "leleka-100",
    waypoints: [
      { id:"wp1", lat:48.3700, lon:31.1500, alt_m:300, speed_ms:22, action:"WAYPOINT", risk:"SAFE", max_pk:0 },
      { id:"wp2", lat:48.3750, lon:31.1650, alt_m:300, speed_ms:22, action:"WAYPOINT", risk:"SAFE", max_pk:0 },
      { id:"wp3", lat:48.3800, lon:31.1800, alt_m:300, speed_ms:22, action:"WAYPOINT", risk:"SAFE", max_pk:0 },
      { id:"wp4", lat:48.3850, lon:31.1950, alt_m:300, speed_ms:22, action:"WAYPOINT", risk:"SAFE", max_pk:0 },
      { id:"wp5", lat:48.3900, lon:31.2100, alt_m:300, speed_ms:22, action:"WAYPOINT", risk:"SAFE", max_pk:0 },
      { id:"wp6", lat:48.3700, lon:31.1500, alt_m:150, speed_ms:18, action:"LAND",     risk:"SAFE", max_pk:0 },
    ],
    timeLimit:  240,
    objectives: [
      "Complete all 6 patrol waypoints",
      "Maintain altitude ≥250m throughout patrol",
      "Return to base within time limit",
    ],
    passScore: 78,
  },
  "mission-cmd-m6": {
    name:       "Command Mission — Practical Exam",
    description:"Plan and execute a complex multi-waypoint mission with threat avoidance.",
    libraryId:  "bayraktar-tb2",
    waypoints: [
      { id:"wp1", lat:48.3600, lon:31.1400, alt_m:500, speed_ms:35, action:"WAYPOINT", risk:"SAFE",   max_pk:0   },
      { id:"wp2", lat:48.3700, lon:31.1600, alt_m:400, speed_ms:35, action:"WAYPOINT", risk:"LOW",    max_pk:0.1 },
      { id:"wp3", lat:48.3800, lon:31.1800, alt_m:300, speed_ms:30, action:"WAYPOINT", risk:"MEDIUM", max_pk:0.3 },
      { id:"wp4", lat:48.3900, lon:31.2000, alt_m:250, speed_ms:30, action:"WAYPOINT", risk:"HIGH",   max_pk:0.5 },
      { id:"wp5", lat:48.3800, lon:31.2200, alt_m:400, speed_ms:35, action:"WAYPOINT", risk:"LOW",    max_pk:0.1 },
      { id:"wp6", lat:48.3600, lon:31.2000, alt_m:500, speed_ms:35, action:"LAND",     risk:"SAFE",   max_pk:0   },
    ],
    timeLimit:  360,
    objectives: [
      "Complete all 6 mission waypoints",
      "Avoid SAM engagement (no THREAT_HIT events)",
      "Maintain fuel > 20% at completion",
      "Complete within 6 minute time limit",
    ],
    passScore: 85,
  },
};

function getScenarioKey(courseId: string, moduleId: string): string {
  return `${courseId}-${moduleId}`;
}

interface Props {
  courseId:   string;
  moduleId:   string;
  moduleTitle:string;
  passScore:  number;
  onBack:     () => void;
  onComplete: (score: number, grade: string, timeSpentS: number) => void;
}

export function PracticalModule({ courseId, moduleId, moduleTitle, passScore, onBack, onComplete }: Props) {
  const token    = useAuthStore(s => s.accessToken);
  const key      = getScenarioKey(courseId, moduleId);
  const scenario = SCENARIOS[key] ?? SCENARIOS["fpv-strike-m6"];

  const mission = {
    id: null, name: scenario.name,
    waypoints: scenario.waypoints,
    threat_sites: [],
    uav_rcs: 0.05, uav_speed: scenario.waypoints[0]?.speed_ms ?? 22,
    status: "DRAFT", overall_risk: 0, score: 0, created_at: new Date().toISOString(),
  };

  const sim = useSimulatorWS(scenario.libraryId, mission as any);

  const [phase,       setPhase]       = useState<"brief"|"fly"|"debrief">("brief");
  const [elapsed,     setElapsed]     = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout|null>(null);

  const startExam = useCallback(() => {
    setPhase("fly");
    setTimerActive(true);
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(e => {
        const next = e + 1;
        if (next >= scenario.timeLimit) {
          clearInterval(timerRef.current!);
          handleStop(next);
        }
        return next;
      });
    }, 1000);
    sim.start();
  }, [sim, scenario.timeLimit]);

  const handleStop = useCallback(async (timeS?: number) => {
    const spent = timeS ?? elapsed;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setTimerActive(false);
    await sim.stop();

    // Grade based on outcomes
    const log  = sim.flightLog.getFullLog();
    const events = log.events ?? [];
    const totalWP  = scenario.waypoints.length;
    const reachedWP= events.filter(e => e.type === "WAYPOINT_REACHED").length;
    const hits     = events.filter(e => e.type === "THREAT_HIT").length;
    const completed= sim.missionComplete;

    let score = 0;
    score += Math.round((reachedWP / totalWP) * 50);       // 50pts — waypoints
    score += completed ? 20 : 0;                            // 20pts — mission complete
    score += hits === 0 ? 20 : Math.max(0, 20 - hits * 10);// 20pts — no hits
    // 10pts — time bonus
    const timeRatio = spent / scenario.timeLimit;
    score += timeRatio < 0.7 ? 10 : timeRatio < 0.9 ? 5 : 0;

    score = Math.max(0, Math.min(100, score));
    const grade = score >= 95 ? "S" : score >= 85 ? "A" : score >= 75 ? "B" : score >= 65 ? "C" : "F";

    setPhase("debrief");
    // Brief pause before callback so debrief renders
    setTimeout(() => onComplete(score, grade, spent), 100);
  }, [elapsed, sim, scenario, onComplete]);

  const timeLeft  = scenario.timeLimit - elapsed;
  const timeColor = timeLeft < 30 ? "text-threat-high" : timeLeft < 60 ? "text-threat-medium" : "text-threat-low";
  const pctDone   = sim.wpStatus.index / scenario.waypoints.length;

  // ── Brief ─────────────────────────────────────────────────────
  if (phase === "brief") return (
    <div className="h-full flex flex-col p-6 max-w-lg mx-auto">
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary font-mono text-xs mb-6 transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5}/>BACK
      </button>

      <div className="flex-1 space-y-5">
        <div>
          <span className="font-mono text-2xs text-purple-400 tracking-widest">PRACTICAL EXAM</span>
          <h2 className="font-mono text-base text-text-primary font-medium mt-1">{moduleTitle}</h2>
          <p className="font-mono text-xs text-text-secondary mt-2 leading-relaxed">{scenario.description}</p>
        </div>

        <div className="bg-bg-raised border border-border-dim rounded p-4 space-y-3">
          <p className="font-mono text-2xs text-text-secondary tracking-widest">MISSION PARAMETERS</p>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="font-mono text-2xs text-text-dim">UAV</p>
              <p className="font-mono text-xs text-text-primary">{scenario.libraryId.toUpperCase()}</p></div>
            <div><p className="font-mono text-2xs text-text-dim">TIME LIMIT</p>
              <p className="font-mono text-xs text-text-primary">{Math.floor(scenario.timeLimit/60)}:{String(scenario.timeLimit%60).padStart(2,"0")}</p></div>
            <div><p className="font-mono text-2xs text-text-dim">WAYPOINTS</p>
              <p className="font-mono text-xs text-text-primary">{scenario.waypoints.length} checkpoints</p></div>
            <div><p className="font-mono text-2xs text-text-dim">PASS SCORE</p>
              <p className="font-mono text-xs text-threat-low">{passScore}%</p></div>
          </div>
        </div>

        <div>
          <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2">OBJECTIVES</p>
          <ul className="space-y-1.5">
            {scenario.objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2">
                <Crosshair className="w-3 h-3 text-cyan-DEFAULT shrink-0 mt-0.5" strokeWidth={1.5}/>
                <span className="font-mono text-xs text-text-secondary">{obj}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-bg-raised border border-border-dim rounded p-3">
          <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2">SCORING</p>
          {[
            ["Waypoints completed", "50 pts"],
            ["Mission complete",    "20 pts"],
            ["No threat hits",      "20 pts"],
            ["Time bonus (<70%)",   "10 pts"],
          ].map(([l,v]) => (
            <div key={l} className="flex justify-between py-0.5">
              <span className="font-mono text-2xs text-text-secondary">{l}</span>
              <span className="font-mono text-2xs text-text-primary">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={startExam}
        className="w-full flex items-center justify-center gap-2 py-3 rounded border border-border-active bg-cyan-subtle text-cyan-DEFAULT font-mono text-sm tracking-widest hover:shadow-cyan transition-all mt-6">
        <Play className="w-4 h-4" strokeWidth={1.5}/>START PRACTICAL EXAM
      </button>
    </div>
  );

  // ── Flying ────────────────────────────────────────────────────
  if (phase === "fly") return (
    <div className="h-full flex flex-col bg-bg-base">
      {/* HUD */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-surface border-b border-border-dim shrink-0">
        <span className="font-mono text-2xs text-purple-400 tracking-widest">PRACTICAL EXAM</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Navigation className="w-3 h-3 text-text-secondary" strokeWidth={1.5}/>
            <span className="font-mono text-2xs text-text-secondary">
              WP {sim.wpStatus.index}/{scenario.waypoints.length}
            </span>
            <div className="w-20 h-1 bg-bg-base rounded overflow-hidden ml-1">
              <div className="h-full bg-cyan-DEFAULT transition-all" style={{width:`${pctDone*100}%`}}/>
            </div>
          </div>
          <div className={clsx("font-mono text-sm font-medium tabular-nums", timeColor)}>
            {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,"0")}
          </div>
        </div>
        <button onClick={() => handleStop()}
          className="flex items-center gap-1.5 px-3 py-1 rounded border border-threat-high/40 bg-threat-high/10 text-threat-high font-mono text-2xs tracking-widest hover:bg-threat-high/20 transition-all">
          <Square className="w-3 h-3" strokeWidth={1.5}/>END
        </button>
      </div>

      {/* Sim telemetry */}
      <div className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-3 gap-6 p-6">
          {[
            { label:"ALTITUDE",  value:`${sim.state.altitude_m.toFixed(0)} m` },
            { label:"SPEED",     value:`${sim.state.groundspeed_ms.toFixed(1)} m/s` },
            { label:"HEADING",   value:`${(sim.state.yaw*180/Math.PI).toFixed(0)}°` },
            { label:"THROTTLE",  value:`${(sim.state.actual_throttle*100).toFixed(0)}%` },
            { label:"BATTERY",   value:`${(sim.state.fuel_remaining*100).toFixed(0)}%`,
              color: sim.state.fuel_remaining < 0.2 ? "text-threat-high" : undefined },
            { label:"DIST TO WP",value: sim.wpStatus.dist_m < 1000
                ? `${sim.wpStatus.dist_m.toFixed(0)} m`
                : `${(sim.wpStatus.dist_m/1000).toFixed(1)} km` },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="font-mono text-2xs text-text-dim tracking-widest mb-1">{label}</p>
              <p className={clsx("font-mono text-xl font-medium tabular-nums", color ?? "text-text-primary")}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {sim.missionComplete && (
        <div className="p-4 border-t border-border-dim flex items-center justify-between bg-bg-surface">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-threat-low" strokeWidth={1.5}/>
            <span className="font-mono text-xs text-threat-low">Mission Complete!</span>
          </div>
          <button onClick={() => handleStop()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded border border-threat-low bg-threat-low/10 text-threat-low font-mono text-xs tracking-widest hover:bg-threat-low/20 transition-all">
            <CheckCircle className="w-3 h-3" strokeWidth={1.5}/>FINISH
          </button>
        </div>
      )}
    </div>
  );

  // ── Debrief ───────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 gap-4">
      <Loader2 className="w-6 h-6 animate-spin text-text-dim"/>
      <p className="font-mono text-xs text-text-dim">Calculating score…</p>
    </div>
  );
}
