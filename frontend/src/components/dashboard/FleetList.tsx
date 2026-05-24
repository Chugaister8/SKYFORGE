"use client";
import { useFleet, useTelemetry } from "@/lib/hooks/useFleet";
import { clsx } from "clsx";
import { Wifi, WifiOff, Battery, Gauge, Navigation } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  ONLINE:      { label: "ONLINE",     color: "text-threat-low",    dot: "bg-threat-low"     },
  IN_MISSION:  { label: "IN MISSION", color: "text-cyan-DEFAULT",  dot: "bg-cyan-DEFAULT"   },
  OFFLINE:     { label: "OFFLINE",    color: "text-text-secondary",dot: "bg-text-secondary" },
  MAINTENANCE: { label: "MAINT",      color: "text-threat-medium", dot: "bg-threat-medium"  },
  LOST:        { label: "LOST",       color: "text-threat-high",   dot: "bg-threat-high"    },
};

const CLASS_LABELS: Record<string, string> = {
  NANO: "NANO", MICRO_FPV: "μFPV", STRIKE_FPV: "STRIKE",
  TACTICAL_MULTIROTOR: "MULTI", TACTICAL_VTOL: "VTOL",
  FIXED_WING_ISR: "ISR", LOITERING_MUNITION: "LM", MALE: "MALE", HALE: "HALE",
};

export function FleetList() {
  const { data: fleet,     isLoading: fl } = useFleet();
  const { data: telemetry, isLoading: tl } = useTelemetry();
  const loading = fl || tl;
  const telemetryMap = new Map((telemetry ?? []).map((t) => [t.uav_id, t]));

  if (loading) return (
    <div className="space-y-2">
      {[1,2,3].map((i) => <div key={i} className="h-14 bg-bg-raised rounded animate-pulse" />)}
    </div>
  );

  if (!fleet?.length) return (
    <div className="flex flex-col items-center justify-center h-40 gap-2">
      <p className="font-mono text-xs text-text-dim">— no assets registered —</p>
      <p className="font-mono text-2xs text-text-dim">Add UAV to your fleet to begin</p>
    </div>
  );

  return (
    <div className="space-y-1.5">
      {fleet.map((uav) => {
        const telem = telemetryMap.get(uav.id);
        const cfg   = STATUS_CONFIG[uav.status] ?? STATUS_CONFIG.OFFLINE;
        return (
          <div key={uav.id} className={clsx(
            "flex items-center gap-3 px-3 py-2.5 rounded border border-border-dim",
            "hover:border-border-active bg-bg-raised hover:bg-bg-surface transition-all cursor-pointer group",
            uav.status === "IN_MISSION" && "border-cyan-DEFAULT/30 bg-cyan-subtle",
          )}>
            <span className={clsx("w-2 h-2 rounded-full shrink-0", cfg.dot,
              (uav.status === "ONLINE" || uav.status === "IN_MISSION") && "animate-pulse-slow")} />
            <div className="w-24 shrink-0">
              <p className="font-mono text-xs text-text-primary font-medium leading-none">{uav.callsign}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-2xs text-text-dim">{CLASS_LABELS[uav.uav_class] ?? uav.uav_class}</span>
                <span className={clsx("font-mono text-2xs", cfg.color)}>{cfg.label}</span>
              </div>
            </div>
            {telem ? (
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-text-dim" strokeWidth={1.5} />
                  <span className="font-mono text-2xs text-text-secondary tabular-nums">{telem.altitude_m?.toFixed(0) ?? "—"}m</span>
                </div>
                <div className="flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-text-dim" strokeWidth={1.5} />
                  <span className="font-mono text-2xs text-text-secondary tabular-nums">{telem.speed_ms?.toFixed(1) ?? "—"}m/s</span>
                </div>
                <div className="flex items-center gap-1">
                  <Battery className="w-3 h-3 text-text-dim" strokeWidth={1.5} />
                  <span className={clsx("font-mono text-2xs tabular-nums",
                    (telem.battery_pct ?? 100) < 30 ? "text-threat-high" :
                    (telem.battery_pct ?? 100) < 50 ? "text-threat-medium" : "text-text-secondary")}>
                    {telem.battery_pct?.toFixed(0) ?? "—"}%
                  </span>
                </div>
                <div className="flex items-center gap-1 ml-auto">
                  <Wifi className="w-3 h-3 text-text-dim" strokeWidth={1.5} />
                  <span className="font-mono text-2xs text-text-secondary tabular-nums">
                    {telem.link_quality != null ? `${(telem.link_quality * 100).toFixed(0)}%` : "—"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center gap-1.5">
                <WifiOff className="w-3 h-3 text-text-dim" strokeWidth={1.5} />
                <span className="font-mono text-2xs text-text-dim">no telemetry</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
