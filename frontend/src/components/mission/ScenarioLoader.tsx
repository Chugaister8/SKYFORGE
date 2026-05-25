"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";
import { clsx } from "clsx";
import { Sparkles, X, Loader2 } from "lucide-react";

const SCENARIOS = [
  { id:"isr_patrol",  name:"ISR Patrol",  desc:"Recon patrol with SAM threats",           icon:"👁" },
  { id:"strike_run",  name:"Strike Run",  desc:"Deep strike through air defense network", icon:"⚡" },
  { id:"ew_gauntlet", name:"EW Gauntlet", desc:"GPS-denied navigation through EW zone",   icon:"📡" },
];
const DIFFICULTIES = ["TRAINING","EASY","MEDIUM","HARD","EXPERT"];
const DIFF_CLR: Record<string,string> = {
  TRAINING:"text-threat-low",EASY:"text-threat-low",MEDIUM:"text-cyan-DEFAULT",
  HARD:"text-threat-medium",EXPERT:"text-threat-high",
};

interface Props {
  onLoad:  (mission: any) => void;
  onClose: () => void;
}

export function ScenarioLoader({ onLoad, onClose }: Props) {
  const token = useAuthStore(s => s.accessToken);
  const [selected,   setSelected]   = useState("isr_patrol");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  const handleLoad = async () => {
    if (!token) return;
    setLoading(true); setError("");
    try {
      const res = await api.post<any>("/scenarios/build", {
        scenario_id: selected,
        difficulty,
        center_lat:  48.3794,
        center_lon:  31.1656,
      }, token);
      onLoad(res);
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Failed to load scenario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-surface border border-border-dim rounded w-full max-w-md p-5 space-y-4">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-DEFAULT" strokeWidth={1.5}/>
            <p className="font-mono text-sm text-text-primary font-medium">Load Scenario</p>
          </div>
          <button onClick={onClose} className="p-1 text-text-dim hover:text-text-primary transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5}/>
          </button>
        </div>

        {/* Scenario selector */}
        <div className="space-y-1.5">
          <p className="font-mono text-2xs text-text-secondary tracking-widest">SCENARIO TYPE</p>
          {SCENARIOS.map(s => (
            <button key={s.id} onClick={() => setSelected(s.id)}
              className={clsx(
                "w-full flex items-center gap-3 p-3 rounded border text-left transition-all",
                selected===s.id
                  ? "border-border-active bg-cyan-subtle"
                  : "border-border-dim hover:border-border-active",
              )}>
              <span className="text-lg">{s.icon}</span>
              <div>
                <p className={clsx("font-mono text-xs font-medium", selected===s.id?"text-cyan-DEFAULT":"text-text-primary")}>
                  {s.name}
                </p>
                <p className="font-mono text-2xs text-text-secondary">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Difficulty */}
        <div>
          <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2">DIFFICULTY</p>
          <div className="flex gap-1.5 flex-wrap">
            {DIFFICULTIES.map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={clsx(
                  "px-3 py-1 rounded border font-mono text-2xs tracking-widest transition-all",
                  difficulty===d
                    ? `border-current bg-current/10 ${DIFF_CLR[d]}`
                    : "border-border-dim text-text-secondary hover:text-text-primary",
                )}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="font-mono text-2xs text-threat-high border border-threat-high/30 bg-threat-high/5 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2 rounded border border-border-dim text-text-secondary hover:text-text-primary font-mono text-xs tracking-widest transition-all">
            CANCEL
          </button>
          <button onClick={handleLoad} disabled={loading}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded border font-mono text-xs tracking-widest transition-all",
              loading
                ? "border-border-dim text-text-dim cursor-not-allowed"
                : "border-border-active bg-cyan-subtle text-cyan-DEFAULT hover:shadow-cyan",
            )}>
            {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>BUILDING...</> : "LOAD INTO PLANNER"}
          </button>
        </div>
      </div>
    </div>
  );
}
