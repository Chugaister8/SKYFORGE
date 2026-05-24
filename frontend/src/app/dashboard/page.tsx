"use client";
import { Plane, Map, Shield, Star } from "lucide-react";
import { StatCard }    from "@/components/dashboard/StatCard";
import { FleetList }   from "@/components/dashboard/FleetList";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { useFleetStats } from "@/lib/hooks/useFleet";

export default function DashboardPage() {
  const { data: stats, isLoading } = useFleetStats();
  return (
    <div className="p-5 space-y-5 max-w-[1600px]">
      <div>
        <p className="font-mono text-2xs text-text-secondary tracking-widest mb-0.5">OVERVIEW</p>
        <h1 className="font-mono text-base text-text-primary tracking-wide">Mission Control</h1>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Active Fleet"   value={stats?.active ?? "—"} unit={`of ${stats?.total ?? "—"} total`} icon={Plane}  color="cyan"  loading={isLoading} />
        <StatCard label="Missions Today" value="3"                     unit="ops completed"                     icon={Map}    color="green" trend="+1 vs yesterday" />
        <StatCard label="Active Threats" value="7"                     unit="detected"                          icon={Shield} color="red"   trend="2 high priority" />
        <StatCard label="Training Score" value="847"                   unit="pts this week"                     icon={Star}   color="amber" trend="↑ 12% vs last week" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-bg-surface border border-border-dim rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-2xs text-text-secondary tracking-widest">ACTIVE FLEET</p>
            <span className="font-mono text-2xs text-cyan-DEFAULT cursor-pointer hover:underline">View All →</span>
          </div>
          <FleetList />
        </div>
        <div className="bg-bg-surface border border-border-dim rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-2xs text-text-secondary tracking-widest">ALERTS</p>
            <span className="font-mono text-2xs text-text-dim">3 active</span>
          </div>
          <AlertsPanel />
        </div>
      </div>
    </div>
  );
}
