"use client";
import { SystemTime } from "@/components/ui/SystemTime";
import { useAuthStore } from "@/lib/store/auth.store";
import { useTelemetryStore } from "@/lib/store/telemetry.store";
import { APP_NAME } from "@/lib/constants";
import { Shield, Wifi, WifiOff, Bell } from "lucide-react";
import { clsx } from "clsx";

const ROLE_COLORS: Record<string, string> = {
  PILOT:      "text-cyan-DEFAULT",
  ENGINEER:   "text-threat-low",
  COMMANDER:  "text-threat-medium",
  INSTRUCTOR: "text-purple-400",
  ADMIN:      "text-threat-high",
};

export function Topbar() {
  const { user }   = useAuthStore();
  const wsState    = useTelemetryStore(s => s.wsState);
  const roleColor  = ROLE_COLORS[user?.role ?? "PILOT"];

  const wsOk = wsState === "connected";

  return (
    <header className="h-11 flex items-center justify-between px-4 border-b border-border-dim bg-bg-surface shrink-0 z-40">
      {/* Left — logo (desktop) + system status */}
      <div className="flex items-center gap-3 ml-9 md:ml-0">
        <div className="hidden md:flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-cyan-DEFAULT" strokeWidth={1.5} />
          <span className="font-mono font-medium text-sm tracking-[0.2em] text-cyan-DEFAULT">
            {APP_NAME}
          </span>
        </div>
        <div className="hidden md:block h-3 w-px bg-border-dim" />
        <div className="flex items-center gap-1.5">
          <span className={clsx(
            "w-1.5 h-1.5 rounded-full",
            wsOk ? "bg-threat-low animate-pulse-slow" : "bg-threat-high",
          )} />
          <span className={clsx(
            "font-mono text-2xs tracking-widest hidden sm:block",
            wsOk ? "text-threat-low" : "text-threat-high",
          )}>
            {wsOk ? "SYS NOMINAL" : "LINK LOST"}
          </span>
        </div>
      </div>

      {/* Center — time */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          {wsOk
            ? <Wifi    className="w-3 h-3 text-text-secondary" strokeWidth={1.5} />
            : <WifiOff className="w-3 h-3 text-threat-high"   strokeWidth={1.5} />}
          <span className={clsx(
            "font-mono text-2xs hidden md:block",
            wsOk ? "text-text-secondary" : "text-threat-high",
          )}>
            {wsOk ? "LINK OK" : "RECONNECTING"}
          </span>
        </div>
        <SystemTime />
      </div>

      {/* Right — user */}
      <div className="flex items-center gap-3">
        <button className="relative p-1.5 rounded hover:bg-bg-raised transition-colors">
          <Bell className="w-4 h-4 text-text-secondary" strokeWidth={1.5} />
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-threat-high rounded-full" />
        </button>
        <div className="h-3 w-px bg-border-dim hidden sm:block" />
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="font-mono text-xs text-text-primary leading-none">
              {user?.username ?? "GUEST"}
            </p>
            <p className={clsx("font-mono text-2xs leading-none mt-0.5", roleColor)}>
              {user?.role ?? "—"}
            </p>
          </div>
          <div className="w-7 h-7 rounded flex items-center justify-center bg-cyan-subtle border border-border-dim font-mono text-xs text-cyan-DEFAULT font-medium">
            {(user?.username?.[0] ?? "G").toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
