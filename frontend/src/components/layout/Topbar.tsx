"use client";
import { SystemTime } from "@/components/ui/SystemTime";
import { useAuthStore } from "@/lib/store/auth.store";
import { APP_NAME } from "@/lib/constants";
import { Shield, Wifi, Bell } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  PILOT: "text-cyan-DEFAULT", ENGINEER: "text-threat-low",
  COMMANDER: "text-threat-medium", INSTRUCTOR: "text-purple-400", ADMIN: "text-threat-high",
};

export function Topbar() {
  const { user } = useAuthStore();
  const roleColor = ROLE_COLORS[user?.role ?? "PILOT"];
  return (
    <header className="h-11 flex items-center justify-between px-4 border-b border-border-dim bg-bg-surface shrink-0 z-50">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-cyan-DEFAULT" strokeWidth={1.5} />
          <span className="font-mono font-medium text-sm tracking-[0.2em] text-cyan-DEFAULT">{APP_NAME}</span>
        </div>
        <div className="h-3 w-px bg-border-dim" />
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-threat-low animate-pulse-slow" />
          <span className="font-mono text-2xs text-threat-low tracking-widest">SYS NOMINAL</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-1.5">
          <Wifi className="w-3 h-3 text-text-secondary" />
          <span className="font-mono text-2xs text-text-secondary">LINK OK</span>
        </div>
        <SystemTime />
      </div>
      <div className="flex items-center gap-3">
        <button className="relative p-1.5 rounded hover:bg-bg-raised transition-colors">
          <Bell className="w-4 h-4 text-text-secondary" />
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-threat-high rounded-full" />
        </button>
        <div className="h-3 w-px bg-border-dim" />
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="font-mono text-xs text-text-primary leading-none">{user?.username ?? "GUEST"}</p>
            <p className={`font-mono text-2xs leading-none mt-0.5 ${roleColor}`}>{user?.role ?? "—"}</p>
          </div>
          <div className="w-7 h-7 rounded flex items-center justify-center bg-cyan-subtle border border-border-dim font-mono text-xs text-cyan-DEFAULT font-medium">
            {(user?.username?.[0] ?? "G").toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
