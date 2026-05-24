export default function DashboardPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <p className="font-mono text-2xs text-text-secondary tracking-widest mb-1">
          OVERVIEW
        </p>
        <h1 className="font-mono text-lg text-text-primary tracking-wide">
          Mission Control
        </h1>
      </div>

      {/* Stat cards placeholder */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Active Fleet",    value: "—", unit: "UAVs",     color: "text-cyan-DEFAULT"  },
          { label: "Missions Today",  value: "—", unit: "ops",      color: "text-threat-low"    },
          { label: "Active Threats",  value: "—", unit: "detected", color: "text-threat-high"   },
          { label: "Training Score",  value: "—", unit: "pts",      color: "text-threat-medium" },
        ].map((card) => (
          <div
            key={card.label}
            className="
              bg-bg-surface border border-border-dim rounded p-4
              hover:border-border-active transition-colors
            "
          >
            <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2">
              {card.label}
            </p>
            <p className={`font-mono text-2xl font-medium ${card.color}`}>
              {card.value}
            </p>
            <p className="font-mono text-2xs text-text-dim mt-0.5">
              {card.unit}
            </p>
          </div>
        ))}
      </div>

      {/* Content row placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-bg-surface border border-border-dim rounded p-4 min-h-64">
          <p className="font-mono text-2xs text-text-secondary tracking-widest mb-3">
            ACTIVE FLEET
          </p>
          <div className="flex items-center justify-center h-40 text-text-dim font-mono text-xs">
            — no assets connected —
          </div>
        </div>
        <div className="bg-bg-surface border border-border-dim rounded p-4 min-h-64">
          <p className="font-mono text-2xs text-text-secondary tracking-widest mb-3">
            ALERTS
          </p>
          <div className="flex items-center justify-center h-40 text-text-dim font-mono text-xs">
            — system nominal —
          </div>
        </div>
      </div>
    </div>
  );
}
