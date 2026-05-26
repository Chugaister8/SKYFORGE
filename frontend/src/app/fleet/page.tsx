import { toast } from "@/components/ui/Toast";
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFleet, useFleetStats, useDeleteUAV, useUpdateUAV } from "@/lib/hooks/useFleet";
import { UAVForm }          from "@/components/fleet/UAVForm";
import { SkeletonCard }     from "@/components/ui/Skeleton";
import { useTelemetryStore } from "@/lib/store/telemetry.store";
import { clsx } from "clsx";
import {
  Plus, Plane, Battery, Wifi, Navigation, Gauge, Eye,
  Thermometer, Layers, Trash2, Play, WifiOff, Wrench,
} from "lucide-react";

const STATUS_CFG: Record<string,{label:string;color:string;dot:string}> = {
  ONLINE:      { label:"ONLINE",     color:"text-threat-low",   dot:"bg-threat-low"    },
  IN_MISSION:  { label:"IN MISSION", color:"text-cyan-DEFAULT", dot:"bg-cyan-DEFAULT"  },
  OFFLINE:     { label:"OFFLINE",    color:"text-text-secondary",dot:"bg-text-dim"     },
  MAINTENANCE: { label:"MAINT",      color:"text-threat-medium",dot:"bg-threat-medium" },
  LOST:        { label:"LOST",       color:"text-threat-high",  dot:"bg-threat-high"   },
};

const CLASS_LABELS: Record<string,string> = {
  NANO:"NANO", MICRO_FPV:"μFPV", STRIKE_FPV:"STRIKE", TACTICAL_MULTIROTOR:"MULTI",
  TACTICAL_VTOL:"VTOL", FIXED_WING_ISR:"ISR", LOITERING_MUNITION:"LOITER",
  MALE:"MALE", HALE:"HALE",
};

const STATUS_TABS = ["ALL","ONLINE","IN_MISSION","OFFLINE","MAINTENANCE"] as const;

function StatBadge({ label, value, color }: { label:string; value:string|number; color:string }) {
  return (
    <div className="text-center">
      <p className={clsx("font-mono text-base font-medium tabular-nums", color)}>{value}</p>
      <p className="font-mono text-2xs text-text-dim">{label}</p>
    </div>
  );
}

function TelRow({ icon:Icon, label, value, vc }: {
  icon:any; label:string; value:string; vc?:string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3 text-text-dim shrink-0" strokeWidth={1.5}/>
      <span className="font-mono text-2xs text-text-dim w-8">{label}</span>
      <span className={clsx("font-mono text-2xs tabular-nums", vc ?? "text-text-secondary")}>
        {value}
      </span>
    </div>
  );
}

function SpecCell({ label, value }: { label:string; value:string }) {
  return (
    <div className="text-center">
      <p className="font-mono text-2xs text-text-dim">{label}</p>
      <p className="font-mono text-xs text-text-primary mt-0.5">{value}</p>
    </div>
  );
}

export default function FleetPage() {
  const router   = useRouter();
  const [tab,      setTab]      = useState<typeof STATUS_TABS[number]>("ALL");
  const [showForm, setShowForm] = useState(false);

  const [limit, setLimit] = useState(24);
  const { data: fleet, isLoading, isError } = useFleet(limit, tab !== "ALL" ? tab : undefined);
  const { data: stats, isLoading: sl } = useFleetStats();
  const snapshots = useTelemetryStore(s => s.snapshots);
  const deleteUAV = useDeleteUAV();
  const updateUAV = useUpdateUAV();

  const units = fleet?.items ?? [];

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this UAV from fleet?")) return;
    deleteUAV.mutate(id, {
      onSuccess: () => toast.success("UAV removed"),
      onError:   (e:any) => toast.error("Delete failed", e?.message),
    });
  };

  const handleToggleOnline = (uav: any) => {
    const next = uav.status === "ONLINE" ? "OFFLINE" : "ONLINE";
    updateUAV.mutate({ id: uav.id, status: next }, {
      onSuccess: () => toast.info(`${uav.callsign} set ${next}`),
      onError:   (e:any) => toast.error("Update failed", e?.message),
    });
  };

  const handleSimulate = (uav: any) => {
    // Navigate to simulator with UAV preselected
    router.push(`/simulator?uav=${uav.library_id ?? uav.uav_class?.toLowerCase()}`);
  };

  return (
    <div className="p-4 md:p-5 space-y-4 max-w-[1400px]">
      {isError && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded border border-threat-high/40 bg-threat-high/5 font-mono text-xs text-threat-high">
          <span>⚠ Failed to load data — check your connection and try refreshing.</span>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-2xs text-text-secondary tracking-widest mb-0.5">MANAGEMENT</p>
          <h1 className="font-mono text-base text-text-primary tracking-wide">Fleet Registry</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded border border-border-active bg-cyan-subtle text-cyan-DEFAULT font-mono text-xs tracking-widest hover:shadow-cyan transition-all"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5}/>
          REGISTER UAV
        </button>
      </div>

      {/* Stats row */}
      <div className="bg-bg-surface border border-border-dim rounded p-4">
        <div className="grid grid-cols-4 gap-4">
          <StatBadge label="Total"      value={sl ? "…" : stats?.total      ?? 0} color="text-text-primary"/>
          <StatBadge label="Online"     value={sl ? "…" : stats?.active     ?? 0} color="text-threat-low"/>
          <StatBadge label="In Mission" value={sl ? "…" : stats?.in_mission ?? 0} color="text-cyan-DEFAULT"/>
          <StatBadge label="Offline"    value={sl ? "…" : stats?.offline    ?? 0} color="text-text-secondary"/>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-border-dim">
        {STATUS_TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "px-3 py-2 font-mono text-2xs tracking-widest transition-all border-b-2 -mb-px",
              tab === t
                ? "border-border-active text-cyan-DEFAULT"
                : "border-transparent text-text-secondary hover:text-text-primary",
            )}
          >
            {t.replace("_"," ")}
          </button>
        ))}
      </div>

      {/* Registration form */}
      {showForm && (
        <div className="bg-bg-surface border border-border-active rounded p-5 shadow-cyan-sm">
          <p className="font-mono text-2xs text-cyan-DEFAULT tracking-widest mb-4">
            NEW ASSET REGISTRATION
          </p>
          <UAVForm
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* UAV grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => <SkeletonCard key={i}/>)}
        </div>
      ) : units.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 border border-dashed border-border-dim rounded">
          <Plane className="w-8 h-8 text-text-dim" strokeWidth={1}/>
          <p className="font-mono text-xs text-text-dim">
            {tab !== "ALL" ? `No ${tab.replace("_"," ")} UAVs` : "No assets registered"}
          </p>
          {tab === "ALL" && (
            <button
              onClick={() => setShowForm(true)}
              className="font-mono text-xs text-cyan-DEFAULT hover:underline"
            >
              Register your first UAV →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {units.map(uav => {
            const telem = snapshots.get(uav.id);
            const cfg   = STATUS_CFG[uav.status] ?? STATUS_CFG.OFFLINE;
            const isLive= !!telem;

            return (
              <div
                key={uav.id}
                className={clsx(
                  "bg-bg-surface border rounded p-4 space-y-3 transition-all",
                  isLive
                    ? "border-border-active shadow-cyan-sm"
                    : "border-border-dim hover:border-border-active",
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      "w-2 h-2 rounded-full shrink-0 mt-0.5",
                      cfg.dot,
                      isLive && "animate-pulse-slow",
                    )}/>
                    <div>
                      <p className="font-mono text-sm text-text-primary font-medium leading-none">
                        {uav.callsign}
                      </p>
                      <p className="font-mono text-2xs text-text-secondary mt-0.5 truncate max-w-[140px]">
                        {uav.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={clsx(
                      "font-mono text-2xs px-1.5 py-0.5 rounded border",
                      isLive
                        ? "border-border-active text-cyan-DEFAULT bg-cyan-subtle"
                        : "border-border-dim text-text-dim",
                    )}>
                      {cfg.label}
                    </span>
                    <button
                      onClick={() => handleDelete(uav.id)}
                      disabled={deleteUAV.isPending}
                      className="p-1 rounded text-text-dim hover:text-threat-high transition-colors"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1.5}/>
                    </button>
                  </div>
                </div>

                {/* Class + sensors */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-2xs text-text-dim border border-border-dim rounded px-1.5 py-0.5">
                    {CLASS_LABELS[uav.uav_class] ?? uav.uav_class}
                  </span>
                  {uav.has_eo    && <Eye         className="w-3 h-3 text-text-secondary" strokeWidth={1.5}/>}
                  {uav.has_ir    && <Thermometer className="w-3 h-3 text-text-secondary" strokeWidth={1.5}/>}
                  {uav.has_lidar && <Layers className="w-3 h-3 text-text-secondary" strokeWidth={1.5}/>}
                </div>

                {/* Specs */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-border-dim">
                  <SpecCell label="MAX SPD" value={`${uav.max_speed_ms?.toFixed(0) ?? "—"} m/s`}/>
                  <SpecCell label="RANGE"   value={`${uav.max_range_km ?? "—"} km`}/>
                  <SpecCell label="ENDUR"   value={`${uav.endurance_min ?? "—"} min`}/>
                </div>

                {/* Live telemetry or offline message */}
                {isLive && telem ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <TelRow icon={Navigation} label="ALT"  value={`${telem.altitude_m?.toFixed(0) ?? "—"} m`}/>
                    <TelRow icon={Gauge}      label="SPD"  value={`${telem.speed_ms?.toFixed(1) ?? "—"} m/s`}/>
                    <TelRow
                      icon={Battery} label="BAT"
                      value={`${telem.battery_pct?.toFixed(0) ?? "—"}%`}
                      vc={
                        (telem.battery_pct ?? 100) < 20 ? "text-threat-high" :
                        (telem.battery_pct ?? 100) < 40 ? "text-threat-medium" : undefined
                      }
                    />
                    <TelRow icon={Wifi} label="LINK" value={`${((telem.link_quality ?? 0)*100).toFixed(0)}%`}/>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-1">
                    <WifiOff className="w-3 h-3 text-text-dim" strokeWidth={1.5}/>
                    <span className="font-mono text-2xs text-text-dim">offline — no telemetry</span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={() => handleToggleOnline(uav)}
                    disabled={updateUAV.isPending}
                    className={clsx(
                      "flex-1 flex items-center justify-center gap-1 py-1.5 rounded border font-mono text-2xs tracking-widest transition-all",
                      uav.status === "ONLINE"
                        ? "border-border-dim text-text-secondary hover:border-border-active hover:text-text-primary"
                        : "border-threat-low/40 bg-threat-low/5 text-threat-low hover:bg-threat-low/10",
                    )}
                  >
                    {uav.status === "ONLINE"
                      ? <><WifiOff className="w-3 h-3"/>OFFLINE</>
                      : <><Wifi    className="w-3 h-3"/>ONLINE</>
                    }
                  </button>
                  <button
                    onClick={() => handleSimulate(uav)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded border border-border-active bg-cyan-subtle text-cyan-DEFAULT font-mono text-2xs tracking-widest hover:shadow-cyan-sm transition-all"
                  >
                    <Play className="w-3 h-3" strokeWidth={1.5}/>SIMULATE
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
