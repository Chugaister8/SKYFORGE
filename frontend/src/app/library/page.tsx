"use client";
import { useState, useCallback } from "react";
import { useLibrary, useLibraryUnit } from "@/lib/hooks/useLibrary";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Search, ChevronRight, Shield, Radio, Truck, Plane, Crosshair, X } from "lucide-react";
import { clsx } from "clsx";

// ── Types ─────────────────────────────────────────────────────────
type Category = "UAV"|"AIR_DEFENSE"|"EW_SYSTEM"|"GROUND_VEHICLE";
type Faction  = "FRIENDLY"|"HOSTILE"|"NEUTRAL";
type ThreatLevel = "LOW"|"MEDIUM"|"HIGH"|"CRITICAL";

const CATEGORIES: { key: Category|"ALL"; label: string; icon: any }[] = [
  { key:"ALL",            label:"All",        icon:Crosshair },
  { key:"UAV",            label:"UAV",         icon:Plane     },
  { key:"AIR_DEFENSE",   label:"Air Defense", icon:Shield    },
  { key:"EW_SYSTEM",     label:"EW Systems",  icon:Radio     },
  { key:"GROUND_VEHICLE",label:"Ground",      icon:Truck     },
];

const FACTION_DOT: Record<string,string> = {
  FRIENDLY:"bg-threat-low", HOSTILE:"bg-threat-high", NEUTRAL:"bg-text-secondary",
};

const THREAT_CFG: Record<string,{color:string;bars:number;text:string}> = {
  LOW:     { color:"bg-threat-low",    bars:1, text:"text-threat-low"    },
  MEDIUM:  { color:"bg-threat-medium", bars:2, text:"text-threat-medium" },
  HIGH:    { color:"bg-threat-high",   bars:3, text:"text-threat-high"   },
  CRITICAL:{ color:"bg-purple-400",    bars:4, text:"text-purple-400"    },
};

function ThreatBars({ level }: { level: string }) {
  const cfg = THREAT_CFG[level] ?? THREAT_CFG.LOW;
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4].map(i => (
        <div key={i}
          className={clsx("w-1 rounded-sm", i <= cfg.bars ? cfg.color : "bg-border-dim")}
          style={{ height: `${4 + i * 2}px` }}
        />
      ))}
    </div>
  );
}

function LibraryCard({ entry, active, onClick }: {
  entry:   any;
  active:  boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full text-left flex items-center gap-3 px-3 py-2.5 rounded border transition-all group",
        active
          ? "border-border-active bg-cyan-subtle"
          : [
              "border-border-dim hover:border-border-active bg-bg-raised hover:bg-bg-surface",
              entry.faction === "HOSTILE"  && "hover:border-threat-high/40",
              entry.faction === "FRIENDLY" && "hover:border-threat-low/40",
            ],
      )}
    >
      <span className={clsx(
        "w-2 h-2 rounded-full shrink-0",
        FACTION_DOT[entry.faction] ?? "bg-text-secondary",
      )} />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs text-text-primary truncate font-medium">{entry.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="font-mono text-2xs text-text-dim">{entry.subtype ?? entry.category}</span>
          {entry.country && (
            <>
              <span className="font-mono text-2xs text-text-dim">·</span>
              <span className="font-mono text-2xs text-text-dim">{entry.country}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ThreatBars level={entry.threat_level ?? "LOW"} />
        <span className={clsx(
          "font-mono text-2xs w-10 text-right",
          (THREAT_CFG[entry.threat_level]?.text ?? "text-text-dim"),
        )}>
          {entry.threat_level === "CRITICAL" ? "CRIT" : entry.threat_level}
        </span>
      </div>
      <ChevronRight className="w-3 h-3 text-text-dim group-hover:text-text-secondary shrink-0" strokeWidth={1.5} />
    </button>
  );
}

// ── Row/Section helpers ───────────────────────────────────────────
function Row({ label, value, vc }: { label:string; value:string; vc?:string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="font-mono text-2xs text-text-dim">{label}</span>
      <span className={clsx("font-mono text-2xs", vc ?? "text-text-primary")}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title:string; children:React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-2xs text-text-secondary tracking-widest mb-1.5 pb-1 border-b border-border-dim">
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

// ── Detail panel ─────────────────────────────────────────────────
function DetailPanel({ id, onClose }: { id:string; onClose:()=>void }) {
  const { data, isLoading } = useLibraryUnit(id);

  if (isLoading) return (
    <div className="p-4 space-y-3">
      <div className="h-16 bg-bg-raised rounded animate-pulse"/>
      <div className="h-4 bg-bg-raised rounded w-3/4 animate-pulse"/>
      {[1,2,3].map(i=><div key={i} className="h-24 bg-bg-raised rounded animate-pulse"/>)}
    </div>
  );
  if (!data) return (
    <div className="flex items-center justify-center h-40">
      <p className="font-mono text-xs text-text-dim">Unit not found</p>
    </div>
  );

  const d    = data as any;
  const perf = d.performance;
  const sigs = d.signatures;
  const vuln = d.vulnerability;
  const nav  = d.navigation;
  const radar= d.radar;
  const miss = d.missile;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-border-dim shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={clsx(
              "w-2 h-2 rounded-full",
              d.faction==="HOSTILE" ? "bg-threat-high" :
              d.faction==="FRIENDLY"? "bg-threat-low"  : "bg-text-secondary",
            )}/>
            <span className="font-mono text-2xs text-text-secondary tracking-widest">
              {d.category} · {d.faction}
            </span>
          </div>
          <h2 className="font-mono text-sm text-text-primary font-medium">{d.name}</h2>
          {d.nato_designation && (
            <p className="font-mono text-2xs text-cyan-DEFAULT mt-0.5">NATO: {d.nato_designation}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded text-text-dim hover:text-text-primary hover:bg-bg-raised transition-colors"
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.5}/>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {d.description && (
          <p className="font-mono text-xs text-text-secondary leading-relaxed">{d.description}</p>
        )}

        {perf && (
          <Section title="PERFORMANCE">
            {perf.max_speed_kmh   != null && <Row label="Max Speed"  value={`${perf.max_speed_kmh} km/h`}/>}
            {perf.cruise_speed_kmh!= null && <Row label="Cruise"     value={`${perf.cruise_speed_kmh} km/h`}/>}
            {perf.max_range_km    != null && <Row label="Range"      value={`${perf.max_range_km} km`}/>}
            {perf.endurance_hrs   != null && <Row label="Endurance"  value={`${perf.endurance_hrs} hrs`}/>}
            {perf.max_altitude_m  != null && <Row label="Max Alt"    value={`${perf.max_altitude_m} m`}/>}
            {perf.payload_kg      != null && <Row label="Payload"    value={`${perf.payload_kg} kg`}/>}
          </Section>
        )}

        {radar && (
          <Section title="RADAR">
            {radar.band            && <Row label="Band"         value={radar.band}/>}
            {radar.search_range_km != null && <Row label="Search Range" value={`${radar.search_range_km} km`}/>}
            {radar.track_range_km  != null && <Row label="Track Range"  value={`${radar.track_range_km} km`}/>}
            {radar.min_rcs_m2      != null && <Row label="Min RCS"      value={`${radar.min_rcs_m2} m²`}/>}
            {radar.max_targets     != null && <Row label="Max Targets"  value={String(radar.max_targets)}/>}
          </Section>
        )}

        {miss && (
          <Section title="MISSILE">
            {miss.designation  && <Row label="Type"     value={miss.designation}/>}
            {miss.speed_mach   != null && <Row label="Speed"    value={`Mach ${miss.speed_mach}`}/>}
            {(miss.min_range_km != null && miss.max_range_km != null) && (
              <Row label="Range" value={`${miss.min_range_km}–${miss.max_range_km} km`}/>
            )}
            {(miss.min_altitude_m != null && miss.max_altitude_m != null) && (
              <Row label="Altitude" value={`${miss.min_altitude_m}–${miss.max_altitude_m} m`}/>
            )}
            {miss.guidance     && <Row label="Guidance" value={miss.guidance}/>}
            {miss.warhead_kg   != null && <Row label="Warhead"  value={`${miss.warhead_kg} kg`}/>}
          </Section>
        )}

        {nav && (
          <Section title="NAVIGATION">
            {nav.gps_bands?.length > 0 && <Row label="GPS Bands"     value={nav.gps_bands.join(", ")}/>}
            {nav.has_ins    != null && <Row label="INS Backup"    value={nav.has_ins    ? "YES":"NO"}/>}
            {nav.is_fire_and_forget != null && (
              <Row label="Fire & Forget" value={nav.is_fire_and_forget ? "YES":"NO"}/>
            )}
            {nav.datalink_range_km != null && (
              <Row label="Datalink" value={`${nav.datalink_range_km} km`}/>
            )}
          </Section>
        )}

        {sigs && (
          <Section title="SIGNATURES">
            {sigs.rcs_m2      != null && <Row label="RCS"      value={`${sigs.rcs_m2} m²`}/>}
            {sigs.ir_signature        && <Row label="IR"       value={sigs.ir_signature}/>}
            {sigs.acoustic_signature  && <Row label="Acoustic" value={sigs.acoustic_signature}/>}
            {sigs.visual_signature    && <Row label="Visual"   value={sigs.visual_signature}/>}
          </Section>
        )}

        {vuln && (
          <Section title="VULNERABILITY">
            {Object.entries(vuln)
              .filter(([k]) => k.startsWith("vs_"))
              .map(([k, v]) => (
                <Row
                  key={k}
                  label={k.replace("vs_","").replace(/_/g," ").toUpperCase()}
                  value={String(v)}
                  vc={
                    v==="CRITICAL" ? "text-purple-400" :
                    v==="HIGH"     ? "text-threat-high":
                    v==="MEDIUM"   ? "text-threat-medium":"text-threat-low"
                  }
                />
              ))
            }
          </Section>
        )}

        {d.how_to_detect?.length > 0 && (
          <Section title="HOW TO DETECT">
            {d.how_to_detect.map((tip:string,i:number) => (
              <p key={i} className="font-mono text-2xs text-text-secondary leading-relaxed">→ {tip}</p>
            ))}
          </Section>
        )}

        {d.how_to_counter?.length > 0 && (
          <Section title="HOW TO COUNTER">
            {d.how_to_counter.map((tip:string,i:number) => (
              <p key={i} className="font-mono text-2xs text-text-secondary leading-relaxed">→ {tip}</p>
            ))}
          </Section>
        )}

        {d.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {d.tags.map((tag:string) => (
              <span key={tag} className="font-mono text-2xs text-text-dim border border-border-dim rounded px-1.5 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function LibraryPage() {
  const [category, setCategory] = useState<Category|"ALL">("ALL");
  const [faction,  setFaction]  = useState<string>("ALL");
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<string|null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Simple debounce for search
  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    clearTimeout((handleSearch as any)._t);
    (handleSearch as any)._t = setTimeout(() => setDebouncedSearch(v), 250);
  }, []);

  const { data, isLoading } = useLibrary(
    category !== "ALL" ? category : undefined,
    faction  !== "ALL" ? faction  : undefined,
    debouncedSearch || undefined,
    100,
  );

  const units = data?.units ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex h-full overflow-hidden">
      {/* List panel */}
      <div className={clsx(
        "flex flex-col border-r border-border-dim transition-all duration-200",
        selected ? "w-80 md:w-96 shrink-0" : "flex-1",
      )}>
        {/* Filters */}
        <div className="p-3 border-b border-border-dim space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-2xs text-text-secondary tracking-widest">UNIT LIBRARY</p>
            <span className="font-mono text-2xs text-text-dim">
              {isLoading ? "…" : `${total} entries`}
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-dim" strokeWidth={1.5}/>
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search units, tags…"
              className="w-full pl-8 pr-8 py-1.5 rounded bg-bg-base border border-border-dim font-mono text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-border-active transition-colors"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setDebouncedSearch(""); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-secondary"
              >
                <X className="w-3 h-3" strokeWidth={1.5}/>
              </button>
            )}
          </div>

          {/* Category filter */}
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={clsx(
                  "flex items-center gap-1 px-2 py-1 rounded border font-mono text-2xs transition-all",
                  category === key
                    ? "border-border-active bg-cyan-subtle text-cyan-DEFAULT"
                    : "border-border-dim text-text-secondary hover:text-text-primary",
                )}
              >
                <Icon className="w-2.5 h-2.5" strokeWidth={1.5}/>{label}
              </button>
            ))}
          </div>

          {/* Faction filter */}
          <div className="flex gap-1">
            {(["ALL","FRIENDLY","HOSTILE"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFaction(f)}
                className={clsx(
                  "flex-1 px-2 py-1 rounded border font-mono text-2xs transition-all",
                  faction === f
                    ? f==="HOSTILE"  ? "border-threat-high/60 bg-threat-high/10 text-threat-high"
                    : f==="FRIENDLY" ? "border-threat-low/60 bg-threat-low/10 text-threat-low"
                    : "border-border-active bg-cyan-subtle text-cyan-DEFAULT"
                    : "border-border-dim text-text-secondary hover:text-text-primary",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <SkeletonList count={8}/>
          ) : units.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <p className="font-mono text-xs text-text-dim">No units found</p>
              {(search || category !== "ALL" || faction !== "ALL") && (
                <button
                  onClick={() => { setSearch(""); setDebouncedSearch(""); setCategory("ALL"); setFaction("ALL"); }}
                  className="font-mono text-2xs text-cyan-DEFAULT hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            units.map(u => (
              <LibraryCard
                key={u.id}
                entry={u}
                active={selected === u.id}
                onClick={() => setSelected(u.id === selected ? null : u.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="flex-1 bg-bg-surface overflow-hidden min-w-0">
          <DetailPanel id={selected} onClose={() => setSelected(null)}/>
        </div>
      )}
    </div>
  );
}
