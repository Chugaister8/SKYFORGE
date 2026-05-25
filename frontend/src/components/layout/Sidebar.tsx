"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard, Map, Plane, GraduationCap, Wrench,
  FileText, Settings, LogOut, ChevronRight, BookOpen,
  Users, Menu, X, Shield,
} from "lucide-react";
import { useAuthStore } from "@/lib/store/auth.store";

const NAV_ITEMS = [
  {
    group: "MAIN",
    items: [
      { label: "Dashboard",      href: "/dashboard",    icon: LayoutDashboard },
      { label: "Missions",       href: "/missions",     icon: Map },
      { label: "Simulator",      href: "/simulator",    icon: Plane },
    ],
  },
  {
    group: "TRAINING",
    items: [
      { label: "Training",       href: "/training",     icon: GraduationCap },
      { label: "After Action",   href: "/aar",          icon: FileText },
      { label: "Multiplayer",    href: "/multiplayer",  icon: Users },
      { label: "Library",        href: "/library",      icon: BookOpen },
    ],
  },
  {
    group: "SYSTEM",
    items: [
      { label: "Fleet",          href: "/fleet",        icon: Plane },
      { label: "Engineer",       href: "/engineer",     icon: Wrench },
      { label: "Settings",       href: "/settings",     icon: Settings },
    ],
  },
] as const;

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname             = usePathname();
  const { clearAuth, user } = useAuthStore();

  return (
    <>
      {/* Logo — mobile only */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-2 md:hidden">
        <Shield className="w-4 h-4 text-cyan-DEFAULT" strokeWidth={1.5} />
        <span className="font-mono font-medium text-sm tracking-[0.2em] text-cyan-DEFAULT">SKYFORGE</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_ITEMS.map((group) => (
          <div key={group.group}>
            <p className="px-2 mb-1 font-mono text-2xs text-text-dim tracking-[0.15em]">
              {group.group}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ label, href, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      className={clsx(
                        "flex items-center gap-2.5 px-2 py-2 rounded transition-all group",
                        active
                          ? "bg-cyan-subtle border border-border-active text-cyan-DEFAULT"
                          : "text-text-secondary hover:text-text-primary hover:bg-bg-raised border border-transparent",
                      )}
                    >
                      <Icon
                        className={clsx(
                          "w-3.5 h-3.5 shrink-0",
                          active ? "text-cyan-DEFAULT" : "text-text-dim group-hover:text-text-secondary",
                        )}
                        strokeWidth={1.5}
                      />
                      <span className="font-mono text-xs">{label}</span>
                      {active && (
                        <ChevronRight className="w-3 h-3 ml-auto text-cyan-DEFAULT opacity-60" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="p-2 border-t border-border-dim">
        <div className="flex items-center gap-2 p-2 rounded bg-bg-raised border border-border-dim mb-2">
          <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 bg-cyan-subtle border border-border-active font-mono text-xs text-cyan-DEFAULT">
            {(user?.username?.[0] ?? "G").toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="font-mono text-xs text-text-primary truncate leading-none">
              {user?.username ?? "guest"}
            </p>
            <p className="font-mono text-2xs text-text-secondary leading-none mt-0.5">
              {user?.role ?? "PILOT"}
            </p>
          </div>
        </div>
        <button
          onClick={() => { clearAuth(); onNavigate?.(); }}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-text-secondary hover:text-threat-high hover:bg-bg-raised transition-all border border-transparent font-mono text-xs"
        >
          <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
          Sign Out
        </button>
      </div>
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col bg-bg-surface border-r border-border-dim h-full overflow-hidden">
        <NavContent />
      </aside>

      {/* ── Mobile: hamburger button ─────────────────────────── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-2.5 left-3 z-50 p-2 rounded border border-border-dim bg-bg-surface text-text-secondary hover:text-text-primary transition-all"
        aria-label="Open menu"
      >
        <Menu className="w-4 h-4" strokeWidth={1.5} />
      </button>

      {/* ── Mobile: backdrop ─────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile: drawer ───────────────────────────────────── */}
      <aside
        className={clsx(
          "md:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-bg-surface border-r border-border-dim",
          "transform transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 p-1.5 rounded text-text-dim hover:text-text-secondary transition-colors"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <NavContent onNavigate={() => setMobileOpen(false)} />
      </aside>
    </>
  );
}
