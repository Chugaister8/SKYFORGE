"use client";
import { clsx } from "clsx";
import { AlertTriangle, Radio, Shield, Info } from "lucide-react";
import { useState } from "react";

interface Alert {
  id: string; type: "THREAT" | "EW" | "SYSTEM" | "INFO";
  title: string; message: string; time: string; dismissed: boolean;
}

const MOCK_ALERTS: Alert[] = [
  { id: "1", type: "EW",     title: "GPS JAMMING",   message: "Signal degradation detected — sector NE",           time: "14:31:02", dismissed: false },
  { id: "2", type: "THREAT", title: "SAM ACTIVITY",  message: "Radar emission 47.3N 31.8E — probable Tor-M1",     time: "14:28:45", dismissed: false },
  { id: "3", type: "SYSTEM", title: "UAV-03 OFFLINE", message: "Link lost — last known pos 47.21N 31.45E",         time: "14:22:11", dismissed: false },
  { id: "4", type: "INFO",   title: "MISSION COMPLETE",message: "ALPHA-7 — ISR patrol finished. AAR ready.",       time: "14:15:00", dismissed: false },
];

const ALERT_CONFIG = {
  THREAT: { icon: Shield,        color: "text-threat-high",   border: "border-l-threat-high",   bg: "bg-threat-high/5"   },
  EW:     { icon: Radio,         color: "text-purple-400",    border: "border-l-purple-500",    bg: "bg-purple-500/5"    },
  SYSTEM: { icon: AlertTriangle, color: "text-threat-medium", border: "border-l-threat-medium", bg: "bg-threat-medium/5" },
  INFO:   { icon: Info,          color: "text-cyan-DEFAULT",  border: "border-l-cyan-DEFAULT",  bg: "bg-cyan-subtle"     },
};

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const dismiss = (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  if (!alerts.length) return (
    <div className="flex items-center justify-center h-32">
      <p className="font-mono text-xs text-text-dim">— system nominal —</p>
    </div>
  );

  return (
    <div className="space-y-1.5">
      {alerts.map((alert) => {
        const cfg = ALERT_CONFIG[alert.type];
        const Icon = cfg.icon;
        return (
          <div key={alert.id} className={clsx("flex gap-2.5 p-2.5 rounded border-l-2", cfg.border, cfg.bg, "border border-border-dim")}>
            <Icon className={clsx("w-3.5 h-3.5 shrink-0 mt-0.5", cfg.color)} strokeWidth={1.5} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={clsx("font-mono text-2xs font-medium tracking-wide", cfg.color)}>{alert.title}</p>
                <span className="font-mono text-2xs text-text-dim shrink-0">{alert.time}</span>
              </div>
              <p className="font-mono text-2xs text-text-secondary mt-0.5 leading-relaxed">{alert.message}</p>
            </div>
            <button onClick={() => dismiss(alert.id)} className="shrink-0 text-text-dim hover:text-text-secondary font-mono text-2xs">✕</button>
          </div>
        );
      })}
    </div>
  );
}
