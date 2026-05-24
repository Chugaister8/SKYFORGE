"use client";
import { useState } from "react";
import { useLibrary, useLibraryEntry, LibraryMeta, Faction, Category, ThreatLevel } from "@/lib/hooks/useLibrary";
import { Search, ChevronRight, Shield, Radio, Truck, Plane, Crosshair } from "lucide-react";
import { clsx } from "clsx";

const CATEGORIES: { key: Category | "ALL"; label: string; icon: any }[] = [
  { key: "ALL",            label: "All",        icon: Crosshair },
  { key: "UAV",            label: "UAV",         icon: Plane     },
  { key: "AIR_DEFENSE",   label: "Air Defense", icon: Shield    },
  { key: "EW_SYSTEM",     label: "EW Systems",  icon: Radio     },
  { key: "GROUND_VEHICLE",label: "Ground",      icon: Truck     },
];

const FACTION_CFG: Record<Faction, { dot: string }> = {
  FRIENDLY: { dot: "bg-threat-low"    },
  HOSTILE:  { dot: "bg-threat-high"   },
  NEUTRAL:  { dot: "bg-text-secondary"},
};

const THREAT_CFG: Record<ThreatLevel, { color: string; bars: number }> = {
  LOW:      { color: "bg-threat-low",    bars: 1 },
  MEDIUM:   { color: "bg-threat-medium", bars: 2 },
  HIGH:     { color: "bg-threat-high",   bars: 3 },
  CRITICAL: { color: "bg-purple-400",    bars: 4 },
};

const THREAT_TEXT: Record<ThreatLevel, string> = {
  LOW: "text-threat-low", MEDIUM: "text-threat-medium",
  HIGH: "text-threat-high", CRITICAL: "text-purple-400",
};

function ThreatBars({ level }: { level: ThreatLevel }) {
  const cfg = THREAT_CFG[level];
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4].map((i) => (
        <div key={i} className={clsx("w-1 rounded-sm", i <= cfg.bars ? cfg.color : "bg-border-dim")}
          style={{ height: `${4 + i * 2}px` }} />
      ))}
    </div>
  );
}

function LibraryCard({ entry, onClick }: { entry: LibraryMeta; onClick: () => void }) {
  return (
    <button onClick={onClick} className={clsx(
      "w-full text-left flex items-center gap-3 px-3 py-2.5 rounded",
      "border border-border-dim hover:border-border-active bg-bg-raised hover:bg-bg-surface transition-all group",
      entry.faction === "HOSTILE"  && "hover:border-threat-high/40",
      entry.faction === "FRIENDLY" && "hover:border-threat-low/40",
    )}>
      <span className={clsx("w-2 h-2 rounded-full shrink-0", FACTION_CFG[entry.faction].dot)} />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs text-text-primary truncate font-medium">{entry.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-2xs text-text-dim">{entry.subtype}</span>
          <span className="font-mono text-2xs text-text-dim">·</span>
          <span className="font-mono text-2xs text-text-dim">{entry.country}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ThreatBars level={entry.threat_level} />
        <span className={clsx("font-mono text-2xs w-8 text-right", THREAT_TEXT[entry.threat_level])}>
          {entry.threat_level === "CRITICAL" ? "CRIT" : entry.threat_level}
        </span>
      </div>
      <ChevronRight className="w-3 h-3 text-text-dim group-hover:text-text-secondary shrink-0" strokeWidth={1.5} />
    </button>
  );
}

function Row({ label, value, vc }: { label: string; value: string; vc?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-2xs text-text-dim">{label}</span>
      <span className={clsx("font-mono text-2xs", vc ?? "text-text-primary")}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2 border-b border-border-dim pb-1">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = useLibraryEntry(id);
  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <span className="font-mono text-xs text-text-dim animate-pulse">LOADING...</span>
    </div>
  );
  if (!data) return null;
  const d    = data as any;
  const perf = d.performance;
  const sigs = d.signatures;
  const vuln = d.vulnerability;
  const nav  = d.navigation;
  const radar= d.radar;
  const miss = d.missile;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-start justify-between p-4 border-b border-border-dim shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={clsx("w-2 h-2 rounded-full", d.faction === "HOSTILE" ? "bg-threat-high" : "bg-threat-low")} />
            <span className="font-mono text-2xs text-text-secondary tracking-widest">{d.category} · {d.faction}</span>
          </div>
          <h2 className="font-mono text-sm text-text-primary font-medium">{d.name}</h2>
          {d.nato_designation && <p className="font-mono text-2xs text-cyan-DEFAULT mt-0.5">NATO: {d.nato_designation}</p>}
        </div>
        <button onClick={onClose} className="font-mono text-xs text-text-secondary hover:text-text-primary p-1">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <p className="font-mono text-xs text-text-secondary leading-relaxed">{d.description}</p>
        {perf && <Section title="PERFORMANCE">
          <Row label="Max Speed"  value={`${perf.max_speed_kmh} km/h`} />
          <Row label="Cruise"     value={`${perf.cruise_speed_kmh} km/h`} />
          <Row label="Range"      value={`${perf.max_range_km} km`} />
          <Row label="Endurance"  value={`${perf.endurance_hrs} hrs`} />
          <Row label="Max Alt"    value={`${perf.max_altitude_m} m`} />
        </Section>}
        {radar && <Section title="RADAR">
          <Row label="Band"         value={radar.band} />
          <Row label="Search Range" value={`${radar.search_range_km} km`} />
          <Row label="Min RCS"      value={`${radar.min_rcs_m2} m²`} />
          <Row label="Max Targets"  value={String(radar.max_targets)} />
        </Section>}
        {miss && <Section title="MISSILE">
          <Row label="Type"     value={miss.designation} />
          <Row label="Speed"    value={`Mach ${miss.speed_mach}`} />
          <Row label="Range"    value={`${miss.min_range_km}–${miss.max_range_km} km`} />
          <Row label="Altitude" value={`${miss.min_altitude_m}–${miss.max_altitude_m} m`} />
          <Row label="Guidance" value={miss.guidance} />
        </Section>}
        {nav && <Section title="NAVIGATION">
          <Row label="GPS Bands"    value={nav.gps_bands.join(", ") || "—"} />
          <Row label="INS Backup"   value={nav.has_ins ? "YES" : "NO"} />
          <Row label="Fire & Forget"value={nav.is_fire_and_forget ? "YES" : "NO"} />
          {nav.datalink_range_km && <Row label="Datalink" value={`${nav.datalink_range_km} km`} />}
        </Section>}
        {sigs && <Section title="SIGNATURES">
          <Row label="RCS"      value={`${sigs.rcs_m2} m²`} />
          <Row label="IR"       value={sigs.ir_signature} />
          <Row label="Acoustic" value={sigs.acoustic_signature} />
          <Row label="Visual"   value={sigs.visual_signature} />
        </Section>}
        {vuln && <Section title="VULNERABILITY">
          {Object.entries(vuln).filter(([k]) => k.startsWith("vs_")).map(([k, v]) => (
            <Row key={k} label={k.replace("vs_","").replace(/_/g," ").toUpperCase()} value={String(v)}
              vc={v==="CRITICAL"?"text-purple-400":v==="HIGH"?"text-threat-high":v==="MEDIUM"?"text-threat-medium":"text-threat-low"} />
          ))}
        </Section>}
        {d.how_to_detect?.length > 0 && <Section title="HOW TO DETECT">
          {d.how_to_detect.map((tip: string, i: number) => (
            <p key={i} className="font-mono text-2xs text-text-secondary leading-relaxed">→ {tip}</p>
          ))}
        </Section>}
        {d.how_to_counter?.length > 0 && <Section title="HOW TO COUNTER">
          {d.how_to_counter.map((tip: string, i: number) => (
            <p key={i} className="font-mono text-2xs text-text-secondary leading-relaxed">→ {tip}</p>
          ))}
        </Section>}
        <div className="flex flex-wrap gap-1.5 pt-2">
          {d.tags?.map((tag: string) => (
            <span key={tag} className="font-mono text-2xs text-text-dim border border-border-dim rounded px-1.5 py-0.5">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const [category, setCategory] = useState<Category | "ALL">("ALL");
  const [faction,  setFaction]  = useState<Faction | "ALL">("ALL");
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data: entries, isLoading } = useLibrary({
    faction:  faction  !== "ALL" ? faction  as Faction  : undefined,
    category: category !== "ALL" ? category as Category : undefined,
    search:   search || undefined,
  });

  return (
    <div className="flex h-full overflow-hidden">
      <div className={clsx("flex flex-col border-r border-border-dim transition-all duration-200", selected ? "w-[420px] shrink-0" : "flex-1")}>
        <div className="p-4 border-b border-border-dim space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-2xs text-text-secondary tracking-widest">UNIT LIBRARY</p>
              <p className="font-mono text-xs text-text-primary mt-0.5">{entries?.length ?? "—"} entries</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-dim" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search units, tags..."
              className="w-full pl-8 pr-3 py-1.5 rounded bg-bg-base border border-border-dim font-mono text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-border-active transition-colors" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setCategory(key)}
                className={clsx("flex items-center gap-1 px-2 py-1 rounded border font-mono text-2xs transition-all",
                  category === key ? "border-border-active bg-cyan-subtle text-cyan-DEFAULT"
                                   : "border-border-dim text-text-secondary hover:text-text-primary hover:border-border-active")}>
                <Icon className="w-2.5 h-2.5" strokeWidth={1.5} />{label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {(["ALL","FRIENDLY","HOSTILE"] as const).map((f) => (
              <button key={f} onClick={() => setFaction(f)}
                className={clsx("px-2.5 py-1 rounded border font-mono text-2xs transition-all flex-1",
                  faction === f
                    ? f==="HOSTILE"  ? "border-threat-high/60 bg-threat-high/10 text-threat-high"
                    : f==="FRIENDLY" ? "border-threat-low/60 bg-threat-low/10 text-threat-low"
                    : "border-border-active bg-cyan-subtle text-cyan-DEFAULT"
                    : "border-border-dim text-text-secondary hover:text-text-primary")}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading
            ? Array.from({length:8}).map((_,i)=><div key={i} className="h-12 bg-bg-raised rounded animate-pulse"/>)
            : !entries?.length
            ? <div className="flex items-center justify-center h-40"><p className="font-mono text-xs text-text-dim">— no entries found —</p></div>
            : entries.map((e)=><LibraryCard key={e.id} entry={e} onClick={()=>setSelected(e.id)}/>)
          }
        </div>
      </div>
      {selected && (
        <div className="flex-1 bg-bg-surface overflow-hidden">
          <DetailPanel id={selected} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
