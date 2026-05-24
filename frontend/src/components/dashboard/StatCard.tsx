import { clsx } from "clsx";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string; value: string | number; unit: string;
  icon: LucideIcon; color: "cyan" | "green" | "amber" | "red";
  trend?: string; loading?: boolean;
}

const COLOR_MAP = {
  cyan:  { text: "text-cyan-DEFAULT",  bg: "bg-cyan-subtle",     border: "hover:border-border-active" },
  green: { text: "text-threat-low",    bg: "bg-threat-low/5",    border: "hover:border-threat-low/40" },
  amber: { text: "text-threat-medium", bg: "bg-threat-medium/5", border: "hover:border-threat-medium/40" },
  red:   { text: "text-threat-high",   bg: "bg-threat-high/5",   border: "hover:border-threat-high/40" },
};

export function StatCard({ label, value, unit, icon: Icon, color, trend, loading }: StatCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div className={clsx("bg-bg-surface border border-border-dim rounded p-4 transition-all duration-200", c.border)}>
      <div className="flex items-start justify-between mb-3">
        <p className="font-mono text-2xs text-text-secondary tracking-widest uppercase">{label}</p>
        <div className={clsx("p-1.5 rounded", c.bg)}>
          <Icon className={clsx("w-3.5 h-3.5", c.text)} strokeWidth={1.5} />
        </div>
      </div>
      {loading ? (
        <div className="h-7 w-16 bg-bg-raised rounded animate-pulse" />
      ) : (
        <p className={clsx("font-mono text-2xl font-medium leading-none", c.text)}>{value}</p>
      )}
      <div className="flex items-center justify-between mt-1.5">
        <p className="font-mono text-2xs text-text-dim">{unit}</p>
        {trend && <p className="font-mono text-2xs text-text-secondary">{trend}</p>}
      </div>
    </div>
  );
}
