"use client";
import { clsx } from "clsx";
import type { AARMetrics } from "@/lib/hooks/useAAR";

const GRADE_CFG: Record<string, { color:string; glow:string; bg:string }> = {
  S: { color:"text-purple-400", glow:"#a855f7", bg:"bg-purple-500/20"  },
  A: { color:"text-threat-low", glow:"#10b981", bg:"bg-threat-low/10"  },
  B: { color:"text-cyan-DEFAULT",glow:"#06b6d4",bg:"bg-cyan-subtle"    },
  C: { color:"text-threat-medium",glow:"#f59e0b",bg:"bg-threat-medium/10"},
  F: { color:"text-threat-high", glow:"#ef4444", bg:"bg-threat-high/10" },
};

// ── Radar chart (SVG) ─────────────────────────────────────────────
function RadarChart({ metrics }: { metrics: AARMetrics }) {
  const cx = 80, cy = 80, r = 60;
  const axes = [
    { label:"WP",    value: metrics.waypoints_total > 0 ? metrics.waypoints_hit / metrics.waypoints_total : 0 },
    { label:"EVADE", value: metrics.threats_detected > 0 ? metrics.threats_evaded / metrics.threats_detected : 1 },
    { label:"TIME",  value: Math.max(0, 1 - metrics.duration_s / 900) },
    { label:"ALT",   value: Math.min(1, metrics.avg_altitude_m / 300) },
    { label:"FUEL",  value: Math.max(0, 1 - metrics.fuel_used_pct / 100) },
  ];

  const n = axes.length;
  const angleStep = (2 * Math.PI) / n;

  // Grid rings
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];

  const axisPoints = axes.map((_, i) => {
    const angle = i * angleStep - Math.PI / 2;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      lx: cx + (r + 16) * Math.cos(angle),
      ly: cy + (r + 16) * Math.sin(angle),
    };
  });

  const dataPoints = axes.map((ax, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const val   = ax.value * r;
    return {
      x: cx + val * Math.cos(angle),
      y: cy + val * Math.sin(angle),
    };
  });

  const polygon = dataPoints.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox="0 0 160 160" className="w-full" style={{ maxHeight: 160 }}>
      {/* Grid rings */}
      {rings.map(ring => {
        const pts = axes.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const rv = ring * r;
          return `${cx + rv * Math.cos(angle)},${cy + rv * Math.sin(angle)}`;
        }).join(" ");
        return (
          <polygon key={ring} points={pts}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        );
      })}

      {/* Axis lines */}
      {axisPoints.map((pt, i) => (
        <line key={i} x1={cx} y1={cy} x2={pt.x} y2={pt.y}
          stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}

      {/* Data polygon (fill) */}
      <polygon points={polygon}
        fill="rgba(6,182,212,0.15)" stroke="#06B6D4" strokeWidth="1.5"
        strokeLinejoin="round" />

      {/* Data points */}
      {dataPoints.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r="3"
          fill="#06B6D4" stroke="rgba(6,182,212,0.4)" strokeWidth="2" />
      ))}

      {/* Axis labels */}
      {axisPoints.map((pt, i) => (
        <text key={i} x={pt.lx} y={pt.ly}
          textAnchor="middle" dominantBaseline="middle"
          fontSize="8" fill="rgba(100,116,139,0.9)"
          fontFamily="monospace">
          {axes[i].label}
        </text>
      ))}

      {/* Center score */}
      <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
        fontSize="18" fontWeight="bold" fill="#E2E8F0" fontFamily="monospace">
        {metrics.score}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle"
        fontSize="7" fill="rgba(100,116,139,0.7)" fontFamily="monospace">
        SCORE
      </text>
    </svg>
  );
}

// ── Bar stat row ──────────────────────────────────────────────────
function StatBar({ label, value, max, color, text }: {
  label:string; value:number; max:number; color:string; text:string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-2xs text-text-dim">{label}</span>
        <span className={clsx("font-mono text-2xs tabular-nums", color)}>{text}</span>
      </div>
      <div className="h-1 bg-bg-base rounded overflow-hidden">
        <div className={clsx("h-full rounded transition-all", color.replace("text-","bg-"))}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label:string; value:string; color?:string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border-dim last:border-0">
      <span className="font-mono text-2xs text-text-dim">{label}</span>
      <span className={clsx("font-mono text-xs tabular-nums", color ?? "text-text-primary")}>{value}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export function ScoreCard({ metrics }: { metrics: AARMetrics }) {
  const g   = GRADE_CFG[metrics.grade] ?? GRADE_CFG.B;
  const min = Math.floor(metrics.duration_s / 60);
  const sec = Math.floor(metrics.duration_s % 60);
  const wpPct = metrics.waypoints_total > 0
    ? (metrics.waypoints_hit / metrics.waypoints_total) * 100 : 0;
  const evadePct = metrics.threats_detected > 0
    ? (metrics.threats_evaded / metrics.threats_detected) * 100 : 100;

  return (
    <div className="space-y-4">
      {/* Grade + radar chart */}
      <div className="flex gap-3 items-center">
        {/* Grade badge */}
        <div className="shrink-0">
          <div
            className={clsx(
              "w-14 h-14 rounded flex items-center justify-center font-mono font-bold text-2xl border-2",
              g.color, g.bg, "border-current",
            )}
            style={{ boxShadow: `0 0 12px ${g.glow}44` }}
          >
            {metrics.grade}
          </div>
          <p className="font-mono text-2xs text-text-dim text-center mt-1">
            {metrics.score}<span className="text-2xs opacity-60">pts</span>
          </p>
        </div>

        {/* Radar chart */}
        <div className="flex-1">
          <RadarChart metrics={metrics} />
        </div>
      </div>

      {/* Performance bars */}
      <div className="space-y-2 bg-bg-raised rounded border border-border-dim p-3">
        <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2">PERFORMANCE</p>
        <StatBar
          label="Waypoints"
          value={metrics.waypoints_hit}
          max={metrics.waypoints_total || 1}
          color={wpPct === 100 ? "text-threat-low" : "text-threat-medium"}
          text={`${metrics.waypoints_hit}/${metrics.waypoints_total}`}
        />
        <StatBar
          label="Threat Evasion"
          value={metrics.threats_evaded}
          max={metrics.threats_detected || 1}
          color={evadePct > 70 ? "text-threat-low" : "text-threat-medium"}
          text={`${evadePct.toFixed(0)}%`}
        />
        <StatBar
          label="Fuel Efficiency"
          value={Math.max(0, 100 - metrics.fuel_used_pct)}
          max={100}
          color="text-cyan-DEFAULT"
          text={`${(100 - metrics.fuel_used_pct).toFixed(0)}% remaining`}
        />
      </div>

      {/* Stats table */}
      <div className="bg-bg-raised rounded border border-border-dim p-3">
        <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2">MISSION DATA</p>
        <StatRow label="Duration"       value={`${min}m ${sec}s`} />
        <StatRow label="Distance"       value={`${metrics.distance_km.toFixed(1)} km`} />
        <StatRow label="Avg Altitude"   value={`${metrics.avg_altitude_m} m`} />
        <StatRow label="Threats Hit"
          value={String(metrics.threats_hit)}
          color={metrics.threats_hit > 0 ? "text-threat-high" : "text-threat-low"} />
        <StatRow label="Max P(k)"
          value={`${(metrics.max_threat_pk * 100).toFixed(0)}%`}
          color={metrics.max_threat_pk > 0.6 ? "text-threat-high" :
                 metrics.max_threat_pk > 0.3 ? "text-threat-medium" : undefined} />
        <StatRow label="Time in Danger"
          value={`${metrics.time_in_danger_s}s`}
          color={metrics.time_in_danger_s > 60 ? "text-threat-medium" : undefined} />
      </div>
    </div>
  );
}
