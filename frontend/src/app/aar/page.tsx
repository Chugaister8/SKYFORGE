"use client";
import { useState } from "react";
import { useAAR } from "@/lib/hooks/useAAR";
import { useSavedMissions } from "@/lib/hooks/useMission";
import { ScoreCard }      from "@/components/aar/ScoreCard";
import { EventTimeline }  from "@/components/aar/EventTimeline";
import { ReplayControls } from "@/components/aar/ReplayControls";
import { AARMap }         from "@/components/aar/AARMap";
import { ErrorBoundary }  from "@/components/ui/ErrorBoundary";
import { clsx } from "clsx";
import { FileText, BarChart2, FolderOpen, Save, CheckCircle, Loader2 } from "lucide-react";

const DEMO_MISSIONS = [
  { id:"demo-1", name:"MISSION ALPHA — ISR Patrol" },
  { id:"demo-2", name:"MISSION BRAVO — Strike Run" },
  { id:"demo-3", name:"MISSION CHARLIE — SEAD"     },
];

export default function AARPage() {
  const { state, loadFromMission, loadDemo, saveAAR, play, pause, seek, reset } = useAAR();
  const { data: missionsData, isLoading: missionsLoading } = useSavedMissions();
  const [tab, setTab]       = useState<"overview"|"timeline">("overview");
  const [saving,  setSaving] = useState(false);
  const [saveOk,  setSaveOk] = useState(false);

  const savedMissions = missionsData?.data ?? [];
  const cur = state.track.find((r,i) =>
    r.time_s <= state.time_s && (i===state.track.length-1 || state.track[i+1].time_s > state.time_s)
  ) ?? state.track[0];

  const handleSaveAAR = async () => {
    if (!state.missionId || !state.metrics) return;
    setSaving(true);
    await saveAAR(state.missionId, state.metrics, state.events);
    setSaving(false); setSaveOk(true);
    setTimeout(() => setSaveOk(false), 3000);
  };

  return (
    <div className="flex h-full overflow-hidden">

      {/* Left — selectors + score */}
      <div className="w-72 shrink-0 flex flex-col border-r border-border-dim bg-bg-surface overflow-hidden">
        <div className="p-3 border-b border-border-dim">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="w-3.5 h-3.5 text-text-secondary" strokeWidth={1.5}/>
            <p className="font-mono text-2xs text-text-secondary tracking-widest">SAVED MISSIONS</p>
          </div>

          {/* Real missions from DB */}
          <div className="space-y-1 max-h-44 overflow-y-auto mb-2">
            {missionsLoading ? (
              <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-text-dim"/></div>
            ) : savedMissions.length === 0 ? (
              <p className="font-mono text-2xs text-text-dim text-center py-2">No saved missions</p>
            ) : savedMissions.map(m => (
              <button key={m.id}
                onClick={() => loadFromMission(m.id, m.name, m.waypoints?.length ?? 0, m.score ?? 0)}
                className={clsx(
                  "w-full text-left px-2.5 py-2 rounded border font-mono text-xs transition-all",
                  state.missionId === m.id
                    ? "border-border-active bg-cyan-subtle text-cyan-DEFAULT"
                    : "border-border-dim hover:border-border-active text-text-primary",
                )}>
                <p className="truncate font-medium">{m.name}</p>
                <p className="text-2xs text-text-dim mt-0.5">
                  {m.waypoints?.length ?? 0} WP
                  {m.score > 0 && ` · Score ${m.score}`}
                  {(m as any).flight_log ? " · ✓ log" : ""}
                </p>
              </button>
            ))}
          </div>

          {/* Demo missions */}
          <p className="font-mono text-2xs text-text-dim tracking-widest mb-1">DEMO</p>
          {DEMO_MISSIONS.map(m => (
            <button key={m.id} onClick={() => loadDemo(m.name)}
              className="w-full text-left px-2.5 py-1.5 mb-0.5 rounded border border-border-dim hover:border-border-active font-mono text-xs text-text-secondary hover:text-text-primary transition-all">
              {m.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {state.loading ? (
            <div className="flex items-center justify-center h-32 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-text-dim"/>
              <p className="font-mono text-xs text-text-dim">Loading flight log…</p>
            </div>
          ) : state.metrics ? (
            <>
              <ScoreCard metrics={state.metrics}/>
              {state.missionId && !state.missionId.startsWith("demo") && (
                <button onClick={handleSaveAAR} disabled={saving || saveOk}
                  className={clsx(
                    "w-full mt-3 flex items-center justify-center gap-1.5 py-1.5 rounded border font-mono text-2xs tracking-widest transition-all",
                    saveOk
                      ? "border-threat-low/40 bg-threat-low/5 text-threat-low"
                      : "border-border-active bg-cyan-subtle text-cyan-DEFAULT hover:shadow-cyan-sm",
                    saving && "opacity-60 cursor-not-allowed",
                  )}>
                  {saving  ? <><Loader2 className="w-3 h-3 animate-spin"/>SAVING</>
                   : saveOk ? <><CheckCircle className="w-3 h-3"/>SAVED</>
                   : <><Save className="w-3 h-3"/>SAVE AAR</>}
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="font-mono text-xs text-text-dim">Select a mission to review</p>
            </div>
          )}
        </div>
      </div>

      {/* Center — map + controls */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 relative">
          {state.track.length > 0 ? (
            <ErrorBoundary context="AARMap">
              <AARMap track={state.track} events={state.events} current={state.time_s}/>
            </ErrorBoundary>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="font-mono text-xs text-text-dim">Load a mission to view replay</p>
            </div>
          )}

          {/* Telemetry overlay */}
          {cur && (
            <div className="absolute top-3 right-3 z-[1000] bg-bg-base/90 border border-border-dim rounded p-2.5 space-y-1">
              {([
                ["ALT", `${cur.altitude_m.toFixed(0)} m`],
                ["SPD", `${cur.speed_ms.toFixed(1)} m/s`],
                ["HDG", `${cur.heading_deg.toFixed(0)}°`],
                ["BAT", `${cur.battery_pct.toFixed(0)}%`],
                ["EW",  cur.ew_threat],
              ] as [string,string][]).map(([l,v]) => (
                <div key={l} className="flex items-center gap-3 justify-between">
                  <span className="font-mono text-2xs text-text-dim">{l}</span>
                  <span className={clsx("font-mono text-2xs tabular-nums",
                    l==="EW" && v!=="NONE" ? "text-threat-high" : "text-text-primary")}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {state.duration > 0 && (
          <div className="p-3 border-t border-border-dim bg-bg-surface">
            <ReplayControls
              playing={state.playing} time_s={state.time_s} duration={state.duration}
              onPlay={play} onPause={pause} onSeek={seek} onReset={reset}/>
          </div>
        )}
      </div>

      {/* Right — tabs */}
      <div className="w-72 shrink-0 border-l border-border-dim bg-bg-surface flex flex-col overflow-hidden">
        <div className="flex border-b border-border-dim">
          {([
            ["overview", BarChart2, "Overview"],
            ["timeline", FileText,  "Timeline"],
          ] as const).map(([key, Icon, label]) => (
            <button key={key} onClick={() => setTab(key as any)}
              className={clsx(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 font-mono text-2xs tracking-widest transition-all border-b-2",
                tab===key ? "border-border-active text-cyan-DEFAULT" : "border-transparent text-text-secondary hover:text-text-primary",
              )}>
              <Icon className="w-3 h-3" strokeWidth={1.5}/>{label.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {tab === "overview" ? (
            state.metrics ? (
              <div className="space-y-3">
                <p className="font-mono text-2xs text-text-secondary tracking-widest">DEBRIEF</p>
                <div className="bg-bg-raised border border-border-dim rounded p-3 space-y-3">
                  {[
                    { k:"s", label:"✓ STRENGTHS",  color:"text-threat-low",
                      text: state.metrics.waypoints_hit === state.metrics.waypoints_total
                        ? `All ${state.metrics.waypoints_hit} waypoints reached. ${state.metrics.threats_evaded > 0 ? `Evaded ${state.metrics.threats_evaded} threat(s).` : ""}`
                        : `Reached ${state.metrics.waypoints_hit}/${state.metrics.waypoints_total} waypoints.` },
                    { k:"i", label:"△ IMPROVE",    color:"text-threat-medium",
                      text: state.metrics.threats_hit > 0
                        ? `${state.metrics.threats_hit} hit(s) — review threat avoidance procedures. Check NOE profiles.`
                        : state.metrics.time_in_danger_s > 60
                        ? `${state.metrics.time_in_danger_s}s in threat zone — reduce exposure time.`
                        : "Good threat management." },
                    { k:"r", label:"→ RECOMMEND",  color:"text-cyan-DEFAULT",
                      text: `Distance: ${state.metrics.distance_km.toFixed(1)}km · Avg alt: ${state.metrics.avg_altitude_m}m · Fuel: ${state.metrics.fuel_used_pct.toFixed(0)}%` },
                  ].map(({ k, label, color, text }) => (
                    <div key={k}>
                      <p className={clsx("font-mono text-2xs font-medium mb-1", color)}>{label}</p>
                      <p className="font-mono text-2xs text-text-secondary leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32">
                <p className="font-mono text-xs text-text-dim">No mission loaded</p>
              </div>
            )
          ) : (
            <EventTimeline events={state.events} current={state.time_s}/>
          )}
        </div>
      </div>
    </div>
  );
}
