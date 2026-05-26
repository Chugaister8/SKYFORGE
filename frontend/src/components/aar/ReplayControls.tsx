"use client";
import { useState } from "react";
import { clsx } from "clsx";
import { Play, Pause, SkipBack, SkipForward, Rewind, FastForward } from "lucide-react";
import type { AAREvent } from "@/lib/hooks/useAAR";

interface Props {
  playing:   boolean;
  time_s:    number;
  duration:  number;
  events?:   AAREvent[];
  onPlay:    () => void;
  onPause:   () => void;
  onSeek:    (t: number) => void;
  onReset:   () => void;
}

const SPEEDS = [0.5, 1, 2, 4, 8] as const;

function fmt(s: number) {
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const SEV_COLOR: Record<string, string> = {
  danger:  "#EF4444",
  warning: "#F59E0B",
  success: "#10B981",
  info:    "#06B6D4",
};

export function ReplayControls({
  playing, time_s, duration, events = [], onPlay, onPause, onSeek, onReset,
}: Props) {
  const [speed, setSpeed] = useState<typeof SPEEDS[number]>(1);
  const pct = duration > 0 ? (time_s / duration) * 100 : 0;

  const step = (delta: number) => onSeek(Math.max(0, Math.min(duration, time_s + delta)));

  return (
    <div className="space-y-2">
      {/* ── Timeline scrubber with event markers ─────────────── */}
      <div className="relative">
        {/* Clickable track */}
        <div
          className="h-2 bg-bg-base rounded overflow-hidden cursor-pointer group relative"
          onClick={e => {
            const r = e.currentTarget.getBoundingClientRect();
            onSeek(((e.clientX - r.left) / r.width) * duration);
          }}
        >
          {/* Played portion */}
          <div
            className="absolute inset-y-0 left-0 bg-cyan-DEFAULT/70 rounded transition-none"
            style={{ width: `${pct}%` }}
          />
          {/* Hover effect */}
          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
        </div>

        {/* Event markers on timeline */}
        {events.map((ev, i) => {
          if (duration <= 0) return null;
          const left = (ev.time_s / duration) * 100;
          const color = SEV_COLOR[ev.severity] ?? SEV_COLOR.info;
          return (
            <div
              key={i}
              className="absolute top-0 -translate-x-1/2 cursor-pointer group/marker"
              style={{ left: `${left}%` }}
              title={`${fmt(ev.time_s)} — ${ev.title}`}
              onClick={e => { e.stopPropagation(); onSeek(ev.time_s); }}
            >
              <div
                className="w-1 h-2 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
                style={{ background: color }}
              />
              {/* Tooltip on hover */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 hidden group-hover/marker:block z-10 whitespace-nowrap">
                <div className="bg-bg-surface border border-border-dim rounded px-2 py-1">
                  <p className="font-mono text-2xs" style={{ color }}>{ev.title}</p>
                  <p className="font-mono text-2xs text-text-dim">{fmt(ev.time_s)}</p>
                </div>
              </div>
            </div>
          );
        })}

        {/* Playhead */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-cyan-DEFAULT rounded-full border-2 border-bg-base shadow-cyan-sm pointer-events-none"
          style={{ left: `${pct}%`, transition: playing ? "none" : "left 0.1s" }}
        />
      </div>

      {/* ── Controls row ─────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Reset */}
        <button
          onClick={onReset}
          className="p-1.5 rounded border border-border-dim text-text-secondary hover:text-text-primary hover:border-border-active transition-all"
          title="Reset to start"
        >
          <SkipBack className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>

        {/* -30s */}
        <button
          onClick={() => step(-30)}
          className="p-1.5 rounded border border-border-dim text-text-secondary hover:text-text-primary transition-all"
          title="-30s"
        >
          <Rewind className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>

        {/* Play/Pause */}
        <button
          onClick={playing ? onPause : onPlay}
          className={clsx(
            "flex-1 flex items-center justify-center gap-2 py-1.5 rounded border font-mono text-xs tracking-widest transition-all",
            playing
              ? "border-threat-medium bg-threat-medium/10 text-threat-medium hover:bg-threat-medium/20"
              : "border-threat-low bg-threat-low/10 text-threat-low hover:bg-threat-low/20",
          )}
        >
          {playing
            ? <><Pause className="w-3.5 h-3.5" strokeWidth={1.5}/>PAUSE</>
            : <><Play  className="w-3.5 h-3.5" strokeWidth={1.5}/>REPLAY</>
          }
        </button>

        {/* +30s */}
        <button
          onClick={() => step(30)}
          className="p-1.5 rounded border border-border-dim text-text-secondary hover:text-text-primary transition-all"
          title="+30s"
        >
          <FastForward className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>

        {/* Speed control */}
        <div className="flex items-center gap-0.5">
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={clsx(
                "px-1.5 py-1 font-mono text-2xs rounded transition-all",
                speed === s
                  ? "bg-cyan-subtle text-cyan-DEFAULT border border-border-active"
                  : "text-text-dim hover:text-text-secondary border border-transparent",
              )}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* ── Time display ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-2xs text-text-secondary tabular-nums">
          {fmt(time_s)}
        </span>
        <div className="flex items-center gap-2">
          {/* Legend */}
          {[
            { color: SEV_COLOR.danger,  label: "THREAT" },
            { color: SEV_COLOR.warning, label: "EW"     },
            { color: SEV_COLOR.success, label: "WP"     },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-sm" style={{ background: color }} />
              <span className="font-mono text-2xs text-text-dim">{label}</span>
            </div>
          ))}
        </div>
        <span className="font-mono text-2xs text-text-dim tabular-nums">
          {fmt(duration)}
        </span>
      </div>
    </div>
  );
}
