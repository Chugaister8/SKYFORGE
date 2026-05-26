"use client";
import { useEffect, useState, useCallback } from "react";
import { clsx } from "clsx";
import { AlertTriangle, Radio, Shield, Info, Wifi, Battery, X } from "lucide-react";
import { useTelemetryStore } from "@/lib/store/telemetry.store";
import { useEventStore } from "@/lib/store/event.store";

type AlertType = "THREAT"|"EW"|"SYSTEM"|"INFO"|"BATTERY"|"LINK";
type AlertSeverity = "critical"|"warning"|"info";

interface Alert {
  id:       string;
  type:     AlertType;
  title:    string;
  message:  string;
  time:     string;
  severity: AlertSeverity;
  uav_id?:  string;
}

const CFG: Record<AlertType, { icon:any; color:string; border:string; bg:string }> = {
  THREAT:  { icon:Shield,        color:"text-threat-high",   border:"border-l-threat-high",   bg:"bg-threat-high/5"   },
  EW:      { icon:Radio,         color:"text-purple-400",    border:"border-l-purple-500",    bg:"bg-purple-500/5"    },
  SYSTEM:  { icon:AlertTriangle, color:"text-threat-medium", border:"border-l-threat-medium", bg:"bg-threat-medium/5" },
  BATTERY: { icon:Battery,       color:"text-threat-medium", border:"border-l-threat-medium", bg:"bg-threat-medium/5" },
  LINK:    { icon:Wifi,          color:"text-threat-high",   border:"border-l-threat-high",   bg:"bg-threat-high/5"   },
  INFO:    { icon:Info,          color:"text-cyan-DEFAULT",  border:"border-l-cyan-DEFAULT",  bg:"bg-cyan-subtle"     },
};

function now() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

const MAX_ALERTS = 20;

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const snapshots = useTelemetryStore(s => s.snapshots);
  const lastTick  = useTelemetryStore(s => s.lastTick);
  const wsState   = useTelemetryStore(s => s.wsState);

  // Track previous snapshot state for delta detection
  const prevSnaps = useState<Map<string, any>>(new Map())[0];

  const push = useCallback((a: Omit<Alert,"id"|"time">) => {
    setAlerts(prev => {
      const next = [{ ...a, id: makeId(), time: now() }, ...prev];
      return next.slice(0, MAX_ALERTS);
    });
  }, []);

  // 1. WS disconnection alert
  useEffect(() => {
    if (wsState === "disconnected" || wsState === "error") {
      push({ type:"SYSTEM", title:"LINK LOST", severity:"critical",
        message:"WebSocket telemetry connection dropped — reconnecting…" });
    }
  }, [wsState]);

  // 2. Watch telemetry snapshots for anomalies
  useEffect(() => {
    snapshots.forEach((snap, uav_id) => {
      const prev = prevSnaps.get(uav_id);
      prevSnaps.set(uav_id, snap);

      // UAV went offline (status changed)
      if (prev && prev.status !== "OFFLINE" && snap.status === "OFFLINE") {
        push({ type:"LINK", title:`${snap.callsign} OFFLINE`, severity:"critical",
          message:`Link lost — last pos recorded`, uav_id });
      }

      // UAV entered mission
      if (prev && prev.status !== "IN_MISSION" && snap.status === "IN_MISSION") {
        push({ type:"INFO", title:`${snap.callsign} LAUNCHED`, severity:"info",
          message:`Mission started — telemetry active`, uav_id });
      }

      // Low battery alert (once per crossing 20%)
      if (prev && (prev.battery_pct ?? 100) > 20 && (snap.battery_pct ?? 100) <= 20) {
        push({ type:"BATTERY", title:`${snap.callsign} LOW BAT`, severity:"warning",
          message:`Battery at ${snap.battery_pct?.toFixed(0)}% — RTH recommended`, uav_id });
      }

      // Critical battery (5%)
      if (prev && (prev.battery_pct ?? 100) > 5 && (snap.battery_pct ?? 100) <= 5) {
        push({ type:"BATTERY", title:`${snap.callsign} CRITICAL BAT`, severity:"critical",
          message:`Battery at ${snap.battery_pct?.toFixed(0)}% — LAND NOW`, uav_id });
      }

      // Low link quality
      if (prev && (prev.link_quality ?? 1) > 0.5 && (snap.link_quality ?? 1) <= 0.5) {
        push({ type:"LINK", title:`${snap.callsign} WEAK LINK`, severity:"warning",
          message:`Link quality ${((snap.link_quality ?? 0)*100).toFixed(0)}% — possible EW activity`, uav_id });
      }
    });
  }, [lastTick]);

  // 3. Event bus — simulator events
  const lastFailure = useEventStore(s => s.last("FAILURE_INJECTED"));
  useEffect(() => {
    if (!lastFailure) return;
    const f = lastFailure.payload as any;
    push({ type:"SYSTEM", title:`FAILURE: ${f.name}`, severity:"critical",
      message:f.procedures?.[0] ?? "Follow emergency checklist" });
    useEventStore.getState().consume("FAILURE_INJECTED");
  }, [lastFailure?.id]);

  const lastAlert = useEventStore(s => s.last("ALERT"));
  useEffect(() => {
    if (!lastAlert) return;
    const a = lastAlert.payload as any;
    push({ type: a.type ?? "INFO", title: a.title ?? "ALERT", severity: a.severity ?? "info",
      message: a.message ?? "" });
    useEventStore.getState().consume("ALERT");
  }, [lastAlert?.id]);

  const dismiss = useCallback((id: string) => {
    setAlerts(p => p.filter(a => a.id !== id));
  }, []);

  const dismissAll = useCallback(() => setAlerts([]), []);

  if (!alerts.length) return (
    <div className="flex flex-col items-center justify-center h-32 gap-1">
      <div className="w-2 h-2 rounded-full bg-threat-low animate-pulse-slow" />
      <p className="font-mono text-xs text-threat-low">SYSTEM NOMINAL</p>
      <p className="font-mono text-2xs text-text-dim">No active alerts</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Header with count + dismiss all */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-2xs text-text-secondary">
          {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
        </span>
        {alerts.length > 1 && (
          <button onClick={dismissAll}
            className="font-mono text-2xs text-text-dim hover:text-text-secondary transition-colors">
            dismiss all
          </button>
        )}
      </div>

      {/* Alert list */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
        {alerts.map((alert) => {
          const cfg  = CFG[alert.type];
          const Icon = cfg.icon;
          return (
            <div key={alert.id}
              className={clsx(
                "flex gap-2 p-2.5 rounded border-l-2 border border-border-dim transition-all",
                cfg.border, cfg.bg,
                alert.severity === "critical" && "animate-pulse-slow",
              )}>
              <Icon
                className={clsx("w-3.5 h-3.5 shrink-0 mt-0.5", cfg.color)}
                strokeWidth={1.5}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={clsx("font-mono text-2xs font-medium tracking-wide", cfg.color)}>
                    {alert.title}
                  </p>
                  <span className="font-mono text-2xs text-text-dim shrink-0">{alert.time}</span>
                </div>
                <p className="font-mono text-2xs text-text-secondary mt-0.5 leading-relaxed">
                  {alert.message}
                </p>
              </div>
              <button
                onClick={() => dismiss(alert.id)}
                className="shrink-0 p-0.5 text-text-dim hover:text-text-secondary transition-colors rounded"
              >
                <X className="w-3 h-3" strokeWidth={1.5}/>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
