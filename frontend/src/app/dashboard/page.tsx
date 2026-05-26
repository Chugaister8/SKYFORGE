"use client";
import { Plane, Map, Shield, Star } from "lucide-react";
import { StatCard }    from "@/components/dashboard/StatCard";
import { FleetList }   from "@/components/dashboard/FleetList";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { MiniMap }     from "@/components/dashboard/MiniMap";
import { Skeleton }    from "@/components/ui/Skeleton";
import { useFleetStats } from "@/lib/hooks/useFleet";
import { useSavedMissions } from "@/lib/hooks/useMission";
import { useTelemetryStore } from "@/lib/store/telemetry.store";
import { useAuthStore } from "@/lib/store/auth.store";
import { clsx } from "clsx";

export default function DashboardPage() {
  const { data: stats,   isLoading: statsLoading, isError: statsError } = useFleetStats();
  const { data: missions, isError: missionsError } = useSavedMissions(10);
  const snapshots  = useTelemetryStore(s => s.snapshots);
  const wsState    = useTelemetryStore(s => s.wsState);
  const { user }   = useAuthStore();

  const completedMissions = missions?.data?.filter(m => m.status === "COMPLETED").length ?? 0;
  const wsOk    = wsState === "connected";
  const hasError = statsError || missionsError;

  return (
    <div className="p-4 md:p-5 space-y-4 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-2xs text-text-secondary tracking-widest mb-0.5">OVERVIEW</p>
          <h1 className="font-mono text-base text-text-primary tracking-wide">Mission Control</h1>
        </div>
        {hasError && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-threat-high/40 bg-threat-high/5 text-threat-high font-mono text-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-threat-high"/>
            API ERROR
          </div>
        )}
        <div className={clsx(
          "flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-2xs",
          wsOk
            ? "border-threat-low/40 bg-threat-low/5 text-threat-low"
            : "border-threat-high/40 bg-threat-high/5 text-threat-high animate-pulse",
        )}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {wsOk ? `${snapshots.size} LIVE` : "OFFLINE"}
        </div>
      </div>

      {/* Stat cards — 2 cols on mobile, 4 on xl */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Active Fleet"
          value={statsLoading ? "—" : (stats?.active ?? 0)}
          unit={`of ${stats?.total ?? 0} total`}
          icon={Plane} color="cyan" loading={statsLoading}
        />
        <StatCard
          label="Missions Done"
          value={completedMissions}
          unit="completed total"
          icon={Map} color="green"
        />
        <StatCard
          label="Fleet Online"
          value={snapshots.size}
          unit="UAVs live"
          icon={Shield} color="amber"
        />
        <StatCard
          label="In Mission"
          value={statsLoading ? "—" : (stats?.in_mission ?? 0)}
          unit="active ops"
          icon={Star} color="red" loading={statsLoading}
        />
      </div>

      {/* Main content — stack on mobile, 3-col on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-bg-surface border border-border-dim rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-2xs text-text-secondary tracking-widest">ACTIVE FLEET</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className={clsx("w-1.5 h-1.5 rounded-full", wsOk?"bg-threat-low animate-pulse-slow":"bg-threat-high")}/>
                <span className={clsx("font-mono text-2xs", wsOk?"text-threat-low":"text-threat-high")}>
                  {wsOk?"WS LIVE":"WS DOWN"}
                </span>
              </div>
              <a href="/fleet" className="font-mono text-2xs text-cyan-DEFAULT hover:underline">
                View All →
              </a>
            </div>
          </div>
          <FleetList />
        </div>

        <div className="bg-bg-surface border border-border-dim rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-2xs text-text-secondary tracking-widest">ALERTS</p>
          </div>
          <AlertsPanel />
        </div>
      </div>

      {/* Map — hidden on small screens */}
      <div
        className="hidden md:block bg-bg-surface border border-border-dim rounded overflow-hidden"
        style={{ height: "320px" }}
      >
        <MiniMap />
      </div>
    </div>
  );
}
