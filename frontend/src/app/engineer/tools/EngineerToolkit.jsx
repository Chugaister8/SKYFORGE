import { useState, useCallback, useRef, useEffect } from "react";

// ─────────────────────────────────────────────
// PHYSICS ENGINE (real equations)
// ─────────────────────────────────────────────

const PHYSICS = {
  // Air density by altitude (ISA model)
  airDensity(alt_m) {
    const T0 = 288.15, L = 0.0065, g = 9.80665, R = 287.05, P0 = 101325;
    const T = T0 - L * alt_m;
    const P = P0 * Math.pow(T / T0, g / (R * L));
    return P / (R * T);
  },

  // Propeller thrust (actuator disk theory)
  // T = rho * A * v_e * (v_e - v_inf)  →  simplified: T = Ct * rho * n^2 * d^4
  propellerThrust(kv_rpm_per_v, voltage, diameter_in, efficiency = 0.75) {
    const n_rpm = kv_rpm_per_v * voltage;
    const n_rps = n_rpm / 60;
    const d_m   = diameter_in * 0.0254;
    const rho   = 1.225;
    const Ct    = 0.12 * efficiency; // typical Ct for 2-blade prop
    return Ct * rho * Math.pow(n_rps, 2) * Math.pow(d_m, 4);
  },

  // Propeller power draw
  propellerPower(kv_rpm_per_v, voltage, diameter_in, efficiency = 0.75) {
    const n_rpm = kv_rpm_per_v * voltage;
    const n_rps = n_rpm / 60;
    const d_m   = diameter_in * 0.0254;
    const rho   = 1.225;
    const Cp    = 0.04 * efficiency;
    return Cp * rho * Math.pow(n_rps, 3) * Math.pow(d_m, 5);
  },

  // Motor current draw
  motorCurrent(power_w, voltage, motor_efficiency = 0.85) {
    return power_w / (voltage * motor_efficiency);
  },

  // Hover thrust required per motor
  hoverThrust(total_mass_g, num_motors, thrust_to_weight = 2.0) {
    const mass_kg  = total_mass_g / 1000;
    const total_T  = mass_kg * 9.81 * thrust_to_weight;
    return total_T / num_motors; // N per motor
  },

  // Flight time (battery)
  flightTime(capacity_mah, voltage, current_draw_a) {
    return (capacity_mah / 1000) / current_draw_a * 60; // minutes
  },

  // Range (fixed wing / glide)
  range(capacity_wh, power_cruise_w, airspeed_ms) {
    const time_h = capacity_wh / power_cruise_w;
    return time_h * airspeed_ms * 3.6; // km
  },

  // Wing loading
  wingLoading(mass_g, wing_area_dm2) {
    return (mass_g / 1000 * 9.81) / (wing_area_dm2 / 100); // N/m²
  },

  // Stall speed
  stallSpeed(mass_g, wing_area_dm2, cl_max = 1.4) {
    const W   = (mass_g / 1000) * 9.81;
    const S   = wing_area_dm2 / 100;
    const rho = 1.225;
    return Math.sqrt((2 * W) / (rho * S * cl_max)); // m/s
  },

  // Link budget (Friis)
  linkBudget(tx_power_dbm, tx_gain_dbi, rx_gain_dbi, freq_mhz, distance_m) {
    const lambda = 3e8 / (freq_mhz * 1e6);
    const fspl   = 20 * Math.log10(4 * Math.PI * distance_m / lambda);
    return tx_power_dbm + tx_gain_dbi + rx_gain_dbi - fspl;
  },

  // Max range from link budget
  maxRange(tx_power_dbm, tx_gain_dbi, rx_gain_dbi, freq_mhz, sensitivity_dbm) {
    const margin = tx_power_dbm + tx_gain_dbi + rx_gain_dbi - sensitivity_dbm;
    const lambda = 3e8 / (freq_mhz * 1e6);
    return (lambda / (4 * Math.PI)) * Math.pow(10, margin / 20);
  },

  // Reynolds number
  reynolds(chord_m, velocity_ms, alt_m = 0) {
    const rho = PHYSICS.airDensity(alt_m);
    const mu  = 1.789e-5; // dynamic viscosity at 15°C
    return (rho * velocity_ms * chord_m) / mu;
  },

  // ESC heat dissipation
  escHeat(current_a, resistance_mohm, ambient_c = 25) {
    const r_ohm = resistance_mohm / 1000;
    const power = Math.pow(current_a, 2) * r_ohm;
    return ambient_c + power * 8; // rough thermal resistance ~8°C/W
  },

  // Battery C-rating check
  cRating(capacity_mah, current_a) {
    return current_a / (capacity_mah / 1000);
  },
};

// ─────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────
const C = {
  bg:      "#080C10",
  surface: "#0D1420",
  raised:  "#121A28",
  border:  "#1E2D3D",
  borderA: "#2A4060",
  cyan:    "#00D4FF",
  cyanDim: "#00D4FF22",
  green:   "#00FF9C",
  amber:   "#FFB800",
  red:     "#FF4444",
  purple:  "#BB86FC",
  textPri: "#E2EAF4",
  textSec: "#7A9BB8",
  textDim: "#3A5570",
};

const css = String.raw;

// ─────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────

function Badge({ children, color = C.cyan }) {
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 9,
      letterSpacing: 2,
      color,
      border: `1px solid ${color}44`,
      background: `${color}11`,
      padding: "2px 6px",
      borderRadius: 2,
    }}>
      {children}
    </span>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 9,
      letterSpacing: 2,
      color: C.textDim,
      textTransform: "uppercase",
      marginBottom: 4,
    }}>
      {children}
    </div>
  );
}

function Value({ children, color = C.cyan, size = 24 }) {
  return (
    <div style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: size,
      fontWeight: 700,
      color,
      lineHeight: 1,
    }}>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, unit, min, max, step = 1, type = "number" }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Label>{label}{unit ? ` (${unit})` : ""}</Label>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 3,
          padding: "6px 10px",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          color: C.textPri,
          outline: "none",
          boxSizing: "border-box",
        }}
        onFocus={e => e.target.style.borderColor = C.cyan}
        onBlur={e => e.target.style.borderColor = C.border}
      />
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step = 1, unit, color = C.cyan }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <Label>{label}</Label>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color }}
      />
    </div>
  );
}

function ResultRow({ label, value, unit, color, warn }) {
  const c = warn ? C.amber : (color || C.cyan);
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 0",
      borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.textSec }}>
        {label}
      </span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: c, fontWeight: 600 }}>
        {value} <span style={{ fontSize: 10, color: C.textDim }}>{unit}</span>
      </span>
    </div>
  );
}

function Card({ children, title, badge, accent = C.cyan }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      overflow: "hidden",
    }}>
      {title && (
        <div style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: C.raised,
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: 2,
            color: accent,
            textTransform: "uppercase",
          }}>
            {title}
          </span>
          {badge && <Badge color={accent}>{badge}</Badge>}
        </div>
      )}
      <div style={{ padding: 16 }}>
        {children}
      </div>
    </div>
  );
}

function GaugeBar({ value, max, color = C.cyan, label }) {
  const pct = Math.min(100, (value / max) * 100);
  const barColor = pct > 85 ? C.red : pct > 65 ? C.amber : color;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.textDim, letterSpacing: 1 }}>{label}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: barColor }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: 4, background: C.bg, borderRadius: 2 }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
          borderRadius: 2,
          transition: "width 0.3s ease",
          boxShadow: `0 0 6px ${barColor}66`,
        }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB: PROPULSION CALCULATOR
// ─────────────────────────────────────────────
function PropulsionCalc() {
  const [kv,      setKv]      = useState(2300);
  const [voltage, setVoltage] = useState(14.8);  // 4S
  const [diam,    setDiam]    = useState(5.1);    // inches
  const [motors,  setMotors]  = useState(4);
  const [mass,    setMass]    = useState(250);    // grams
  const [eff,     setEff]     = useState(0.78);

  const T_per   = PHYSICS.propellerThrust(kv, voltage, diam, eff);
  const P_per   = PHYSICS.propellerPower(kv, voltage, diam, eff);
  const I_per   = PHYSICS.motorCurrent(P_per, voltage);
  const T_total = T_per * motors;
  const P_total = P_per * motors;
  const I_total = I_per * motors;
  const T_hover = PHYSICS.hoverThrust(mass, motors, 1.0);
  const twr     = T_total / ((mass / 1000) * 9.81);
  const n_rpm   = kv * voltage;
  const hoverI  = (T_hover / T_per) * I_per * motors;

  const twrColor = twr >= 2 ? C.green : twr >= 1.5 ? C.cyan : twr >= 1.1 ? C.amber : C.red;
  const escWarn  = I_per > 30;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="Motor / Prop Setup">
        <Slider label="Motor KV" value={kv} onChange={setKv} min={800} max={4500} step={50} unit=" rpm/V" color={C.cyan} />
        <Slider label="Voltage" value={voltage} onChange={setVoltage} min={7.4} max={25.2} step={0.4} unit=" V" color={C.purple} />
        <Slider label="Prop Diameter" value={diam} onChange={setDiam} min={2} max={12} step={0.1} unit="\"" color={C.green} />
        <Slider label="Motors" value={motors} onChange={setMotors} min={1} max={8} step={1} unit="x" color={C.amber} />
        <Slider label="Frame Mass" value={mass} onChange={setMass} min={50} max={2000} step={10} unit=" g" color={C.textSec} />
        <Slider label="System Efficiency" value={eff} onChange={setEff} min={0.5} max={0.95} step={0.01} unit="" color={C.cyan} />
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title="Output" accent={twrColor}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div style={{ textAlign: "center", padding: 12, background: C.bg, borderRadius: 3, border: `1px solid ${twrColor}33` }}>
              <Label>Thrust/Weight</Label>
              <Value color={twrColor}>{twr.toFixed(2)}</Value>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.textDim, marginTop: 4 }}>
                {twr >= 2 ? "✓ RACE/ACRO" : twr >= 1.5 ? "✓ GOOD" : twr >= 1.1 ? "⚠ MARGINAL" : "✗ UNDER"}
              </div>
            </div>
            <div style={{ textAlign: "center", padding: 12, background: C.bg, borderRadius: 3, border: `1px solid ${C.purple}33` }}>
              <Label>Motor RPM</Label>
              <Value color={C.purple} size={18}>{(n_rpm / 1000).toFixed(1)}k</Value>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.textDim, marginTop: 4 }}>rpm</div>
            </div>
          </div>
          <ResultRow label="Thrust (per motor)"    value={T_per.toFixed(2)}   unit="N"  />
          <ResultRow label="Thrust (total)"         value={T_total.toFixed(2)} unit="N"  color={C.green} />
          <ResultRow label="Power (per motor)"      value={P_per.toFixed(1)}   unit="W"  />
          <ResultRow label="Power (total)"          value={P_total.toFixed(1)} unit="W"  />
          <ResultRow label="Current (per motor)"    value={I_per.toFixed(1)}   unit="A"  warn={escWarn} />
          <ResultRow label="Current (total)"        value={I_total.toFixed(1)} unit="A"  />
          <ResultRow label="Hover current (total)"  value={hoverI.toFixed(1)}  unit="A"  color={C.amber} />
        </Card>

        <Card title="Load Gauges">
          <GaugeBar value={I_per}           max={40}  label="ESC CURRENT (A)"   color={C.cyan}   />
          <GaugeBar value={P_per / 1000}    max={2}   label="MOTOR POWER (kW)"  color={C.purple} />
          <GaugeBar value={twr}             max={4}   label="THRUST/WEIGHT"     color={twrColor} />
          <GaugeBar value={n_rpm / 1000}    max={50}  label="RPM (×1000)"       color={C.green}  />
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB: BATTERY / ENDURANCE
// ─────────────────────────────────────────────
function BatteryCalc() {
  const [capacity,   setCap]    = useState(1300);
  const [voltage,    setVolt]   = useState(14.8);
  const [hoverI,     setHoverI] = useState(12);
  const [cruiseI,    setCruiseI]= useState(7);
  const [massTotal,  setMass]   = useState(250);
  const [speed,      setSpeed]  = useState(15);
  const [cells,      setCells]  = useState(4);

  const cap_wh      = (capacity / 1000) * voltage;
  const t_hover     = PHYSICS.flightTime(capacity, voltage, hoverI);
  const t_cruise    = PHYSICS.flightTime(capacity, voltage, cruiseI);
  const power_w     = cruiseI * voltage;
  const range_km    = PHYSICS.range(cap_wh, power_w, speed);
  const c_hover     = PHYSICS.cRating(capacity, hoverI);
  const c_max_spike = PHYSICS.cRating(capacity, hoverI * 2.5);
  const cell_v      = voltage / cells;

  const tHoverColor  = t_hover > 20 ? C.green : t_hover > 10 ? C.cyan : C.amber;
  const cellVColor   = cell_v < 3.5 ? C.red : cell_v < 3.7 ? C.amber : C.green;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="Battery Pack">
        <Slider label="Capacity" value={capacity} onChange={setCap} min={300} max={10000} step={100} unit=" mAh" color={C.green} />
        <Slider label="Pack Voltage" value={voltage} onChange={setVolt} min={3.7} max={25.2} step={0.1} unit=" V" color={C.purple} />
        <Slider label="Cells (S)" value={cells} onChange={setCells} min={1} max={6} step={1} unit="S" color={C.amber} />
        <Slider label="Hover Current" value={hoverI} onChange={setHoverI} min={1} max={60} step={0.5} unit=" A" color={C.cyan} />
        <Slider label="Cruise Current" value={cruiseI} onChange={setCruiseI} min={1} max={40} step={0.5} unit=" A" color={C.textSec} />
        <Slider label="Cruise Speed" value={speed} onChange={setSpeed} min={5} max={60} step={1} unit=" m/s" color={C.green} />
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title="Endurance" accent={tHoverColor}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Hover", val: t_hover.toFixed(1), unit: "min", color: tHoverColor },
              { label: "Cruise", val: t_cruise.toFixed(1), unit: "min", color: C.cyan },
              { label: "Range", val: range_km.toFixed(1), unit: "km", color: C.purple },
            ].map(({ label, val, unit: u, color }) => (
              <div key={label} style={{ textAlign: "center", padding: 10, background: C.bg, borderRadius: 3, border: `1px solid ${color}33` }}>
                <Label>{label}</Label>
                <Value color={color} size={20}>{val}</Value>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.textDim, marginTop: 2 }}>{u}</div>
              </div>
            ))}
          </div>
          <ResultRow label="Pack energy"       value={cap_wh.toFixed(2)}        unit="Wh" />
          <ResultRow label="Cell voltage"      value={cell_v.toFixed(2)}         unit="V/cell" color={cellVColor} />
          <ResultRow label="C-rating (hover)"  value={c_hover.toFixed(1)}        unit="C" warn={c_hover > 50} />
          <ResultRow label="C-rating (spike)"  value={c_max_spike.toFixed(1)}    unit="C" warn={c_max_spike > 100} />
          <ResultRow label="Power (cruise)"    value={power_w.toFixed(1)}        unit="W" />
        </Card>

        <Card title="Discharge Profile">
          {/* Visual discharge curve */}
          <svg viewBox="0 0 240 80" style={{ width: "100%", height: 80 }}>
            <defs>
              <linearGradient id="discharge" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={C.green} />
                <stop offset="60%" stopColor={C.cyan} />
                <stop offset="85%" stopColor={C.amber} />
                <stop offset="100%" stopColor={C.red} />
              </linearGradient>
            </defs>
            {/* Grid */}
            {[0, 25, 50, 75, 100].map(x => (
              <line key={x} x1={x * 2.4} y1="0" x2={x * 2.4} y2="70"
                stroke={C.border} strokeWidth="0.5" />
            ))}
            {/* Discharge curve (LiPo approximation) */}
            <polyline
              points={Array.from({ length: 25 }, (_, i) => {
                const soc = 1 - i / 24;
                const v = soc > 0.2
                  ? 3.0 + soc * 1.1 + Math.pow(soc, 3) * 0.9
                  : 3.0 + soc * 2.5;
                const x = i / 24 * 240;
                const y = 70 - (v - 3.0) / 1.2 * 60;
                return `${x},${Math.max(5, y)}`;
              }).join(" ")}
              fill="none"
              stroke="url(#discharge)"
              strokeWidth="2"
            />
            {/* Labels */}
            {[["0%", 0], ["50%", 120], ["100%", 228]].map(([l, x]) => (
              <text key={l} x={x} y="78" fill={C.textDim}
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7 }}>{l}</text>
            ))}
            <text x="2" y="12" fill={C.textDim}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7 }}>4.2V</text>
            <text x="2" y="68" fill={C.textDim}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7 }}>3.0V</text>
          </svg>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB: AERODYNAMICS (Fixed Wing)
// ─────────────────────────────────────────────
function AeroCalc() {
  const [mass,    setMass]  = useState(1500);
  const [span,    setSpan]  = useState(120);   // cm
  const [chord,   setChord] = useState(18);    // cm
  const [speed,   setSpeed] = useState(18);    // m/s
  const [alt,     setAlt]   = useState(100);
  const [aoa,     setAoa]   = useState(4);     // degrees

  const area_m2    = (span / 100) * (chord / 100);
  const ar         = (span / 100) / (chord / 100);
  const wl         = PHYSICS.wingLoading(mass, area_m2 * 100);
  const v_stall    = PHYSICS.stallSpeed(mass, area_m2 * 100);
  const rho        = PHYSICS.airDensity(alt);
  const Re         = PHYSICS.reynolds(chord / 100, speed, alt);

  // Lift & Drag (simplified thin airfoil)
  const cl         = 2 * Math.PI * (aoa * Math.PI / 180);
  const cd         = 0.02 + cl * cl / (Math.PI * ar * 0.85);   // Oswald eff 0.85
  const q          = 0.5 * rho * speed * speed;
  const lift       = cl * q * area_m2;
  const drag       = cd * q * area_m2;
  const ld_ratio   = cl / cd;
  const weight_N   = (mass / 1000) * 9.81;
  const load_g     = lift / weight_N;

  const stallColor = speed < v_stall * 1.1 ? C.red : speed < v_stall * 1.3 ? C.amber : C.green;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="Wing Geometry & Conditions">
        <Slider label="Mass" value={mass} onChange={setMass} min={200} max={10000} step={50} unit=" g" color={C.textSec} />
        <Slider label="Wingspan" value={span} onChange={setSpan} min={30} max={400} step={5} unit=" cm" color={C.cyan} />
        <Slider label="Mean Chord" value={chord} onChange={setChord} min={5} max={100} step={1} unit=" cm" color={C.purple} />
        <Slider label="Airspeed" value={speed} onChange={setSpeed} min={5} max={80} step={0.5} unit=" m/s" color={C.green} />
        <Slider label="Altitude" value={alt} onChange={setAlt} min={0} max={5000} step={50} unit=" m" color={C.amber} />
        <Slider label="Angle of Attack" value={aoa} onChange={setAoa} min={-4} max={16} step={0.5} unit="°" color={C.red} />
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title="Aerodynamic Output" accent={stallColor}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "L/D Ratio", val: ld_ratio.toFixed(1), color: C.green },
              { label: "Lift", val: `${lift.toFixed(1)}N`, color: C.cyan },
              { label: "Drag", val: `${drag.toFixed(2)}N`, color: C.amber },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign: "center", padding: 10, background: C.bg, borderRadius: 3, border: `1px solid ${color}33` }}>
                <Label>{label}</Label>
                <Value color={color} size={16}>{val}</Value>
              </div>
            ))}
          </div>
          <ResultRow label="Wing area"        value={area_m2.toFixed(4)}     unit="m²"  />
          <ResultRow label="Aspect ratio"     value={ar.toFixed(2)}          unit=""    />
          <ResultRow label="Wing loading"     value={wl.toFixed(1)}          unit="N/m²" />
          <ResultRow label="Stall speed"      value={v_stall.toFixed(1)}     unit="m/s" color={stallColor} />
          <ResultRow label="Current speed"    value={speed.toFixed(1)}       unit="m/s" color={stallColor} />
          <ResultRow label="Speed margin"     value={`${((speed / v_stall - 1) * 100).toFixed(0)}%`} unit="" color={stallColor} />
          <ResultRow label="CL"               value={cl.toFixed(3)}          unit=""    />
          <ResultRow label="CD"               value={cd.toFixed(4)}          unit=""    />
          <ResultRow label="Reynolds number"  value={`${(Re / 1e5).toFixed(2)}×10⁵`} unit="" />
          <ResultRow label="Load factor"      value={load_g.toFixed(2)}      unit="g"   warn={load_g > 3} />
          <ResultRow label="Air density"      value={rho.toFixed(4)}         unit="kg/m³" />
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB: LINK / RF
// ─────────────────────────────────────────────
function LinkCalc() {
  const [txPow,   setTxPow]   = useState(27);   // dBm
  const [txGain,  setTxGain]  = useState(3);    // dBi
  const [rxGain,  setRxGain]  = useState(6);
  const [freq,    setFreq]    = useState(868);  // MHz
  const [sens,    setSens]    = useState(-95);  // dBm
  const [dist,    setDist]    = useState(5000); // m

  const rssi    = PHYSICS.linkBudget(txPow, txGain, rxGain, freq, dist);
  const margin  = rssi - sens;
  const maxR    = PHYSICS.maxRange(txPow, txGain, rxGain, freq, sens);
  const lambda  = 3e8 / (freq * 1e6);

  const rssiColor = margin > 20 ? C.green : margin > 10 ? C.cyan : margin > 0 ? C.amber : C.red;

  // Multipath / Fresnel zone
  const fresnelR = 0.5 * Math.sqrt(lambda * dist);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="RF Link Parameters">
        <Slider label="TX Power" value={txPow} onChange={setTxPow} min={10} max={36} step={1} unit=" dBm" color={C.purple} />
        <Slider label="TX Antenna Gain" value={txGain} onChange={setTxGain} min={0} max={12} step={0.5} unit=" dBi" color={C.cyan} />
        <Slider label="RX Antenna Gain" value={rxGain} onChange={setRxGain} min={0} max={12} step={0.5} unit=" dBi" color={C.green} />
        <Slider label="Frequency" value={freq} onChange={setFreq} min={433} max={5800} step={1} unit=" MHz" color={C.amber} />
        <Slider label="RX Sensitivity" value={sens} onChange={setSens} min={-115} max={-60} step={1} unit=" dBm" color={C.textSec} />
        <Slider label="Distance" value={dist} onChange={setDist} min={100} max={50000} step={100} unit=" m" color={C.red} />
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title="Link Budget Analysis" accent={rssiColor}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ textAlign: "center", padding: 12, background: C.bg, borderRadius: 3, border: `1px solid ${rssiColor}33` }}>
              <Label>RSSI @ {(dist / 1000).toFixed(1)}km</Label>
              <Value color={rssiColor} size={22}>{rssi.toFixed(1)}</Value>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.textDim, marginTop: 2 }}>dBm</div>
            </div>
            <div style={{ textAlign: "center", padding: 12, background: C.bg, borderRadius: 3, border: `1px solid ${C.cyan}33` }}>
              <Label>Max Range</Label>
              <Value color={C.cyan} size={18}>{(maxR / 1000).toFixed(1)}</Value>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.textDim, marginTop: 2 }}>km</div>
            </div>
          </div>
          <ResultRow label="Link margin"       value={`${margin.toFixed(1)} dB`}       unit="" color={rssiColor} />
          <ResultRow label="FSPL"              value={`${(txPow + txGain + rxGain - rssi).toFixed(1)} dB`} unit="" />
          <ResultRow label="Wavelength"        value={`${(lambda * 100).toFixed(1)} cm`} unit="" />
          <ResultRow label="Fresnel zone R"    value={`${fresnelR.toFixed(1)} m`}       unit="" />
          <ResultRow label="TX power"          value={`${(Math.pow(10, txPow / 10) / 1000 * 1000).toFixed(0)} mW`} unit="" color={C.purple} />
          <ResultRow label="Status"            value={margin > 0 ? "LINK OK" : "NO LINK"} unit="" color={rssiColor} />
        </Card>

        <Card title="Frequency Bands">
          {[
            { band: "433 MHz", use: "Long-range telemetry", pen: "High" },
            { band: "868 MHz", use: "ExpressLRS / ELRS EU", pen: "High" },
            { band: "915 MHz", use: "ExpressLRS US", pen: "High" },
            { band: "1.3 GHz", use: "FPV analog video", pen: "Medium" },
            { band: "2.4 GHz", use: "Crossfire / RC", pen: "Medium" },
            { band: "5.8 GHz", use: "FPV digital HD", pen: "Low" },
          ].map(({ band, use, pen }) => (
            <div key={band} style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.cyan }}>{band}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.textSec }}>{use}</span>
              <Badge color={pen === "High" ? C.green : pen === "Medium" ? C.amber : C.red}>{pen}</Badge>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB: COMPONENT SELECTOR
// ─────────────────────────────────────────────
function ComponentSelector() {
  const [frameSize, setFrameSize] = useState(220); // mm
  const [useCase,   setUseCase]   = useState("fpv_freestyle");
  const [budget,    setBudget]    = useState("mid");

  const configs = {
    fpv_freestyle: {
      name: "FPV Freestyle",
      color: C.purple,
      motor:   { name: "2306 / 2400KV",  notes: "High RPM, responsive", kv: 2400 },
      esc:     { name: "35–40A BLHeli32", notes: "DShot600, telemetry" },
      fc:      { name: "F7 / H7",         notes: "Gyro fast loop 8kHz" },
      prop:    { name: "5\" tri-blade",   notes: "5149–5152" },
      vtx:     { name: "400–800mW",       notes: "ELRS 2.4G RC" },
      battery: { name: "4S 1300–1500mAh", notes: "45–75C discharge" },
    },
    fpv_long_range: {
      name: "FPV Long Range",
      color: C.cyan,
      motor:   { name: "2207 / 1700KV",  notes: "Efficient, lower KV", kv: 1700 },
      esc:     { name: "30A BLHeli32",    notes: "Efficient at mid throttle" },
      fc:      { name: "F4 + GPS",        notes: "GPS rescue, failsafe" },
      prop:    { name: "5–6\" bi-blade",  notes: "Efficient pitch" },
      vtx:     { name: "ELRS 915MHz",     notes: "Long range telemetry" },
      battery: { name: "4S 2200mAh",      notes: "Soft pack, high cap" },
    },
    fpv_analog: {
      name: "FPV Analog Budget",
      color: C.amber,
      motor:   { name: "2204 / 2300KV",  notes: "Budget brushless", kv: 2300 },
      esc:     { name: "20–30A BLHeli_S", notes: "DShot300" },
      fc:      { name: "F4 AIO",          notes: "All-in-one, compact" },
      prop:    { name: "5\" bi/tri",      notes: "5040–5045" },
      vtx:     { name: "200mW analog",    notes: "FrSky D8/D16" },
      battery: { name: "3S 1500mAh",      notes: "XT30 connector" },
    },
    tactical_multirotor: {
      name: "Tactical Multirotor",
      color: C.green,
      motor:   { name: "4008 / 380KV",   notes: "High torque, efficient", kv: 380 },
      esc:     { name: "60A OPTO",        notes: "Opto isolated, robust" },
      fc:      { name: "Cube Orange+",    notes: "Redundant IMU, ArduPilot" },
      prop:    { name: "15\" CF bi",      notes: "T-motor / Tarot" },
      vtx:     { name: "1W MIMO 2.4G",   notes: "Encrypted datalink" },
      battery: { name: "6S 10Ah LiPo",   notes: "Smart BMS, balancer" },
    },
    fixed_wing_isr: {
      name: "Fixed Wing ISR",
      color: C.red,
      motor:   { name: "4012 / 340KV",   notes: "Pusher/puller tractor", kv: 340 },
      esc:     { name: "40A SimonK",      notes: "Smooth throttle" },
      fc:      { name: "Pixhawk 6C",      notes: "TECS, L1 nav, VTOL" },
      prop:    { name: "12–14\" 2-blade", notes: "High pitch efficiency" },
      vtx:     { name: "900MHz 1W",       notes: "Long range SRTL" },
      battery: { name: "4S 5000mAh",      notes: "Or 2×3S parallel" },
    },
  };

  const cfg = configs[useCase] || configs.fpv_freestyle;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
      <Card title="Build Configurator">
        <Label>Frame Size (mm)</Label>
        <select
          value={frameSize}
          onChange={e => setFrameSize(Number(e.target.value))}
          style={{
            width: "100%", background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 3, padding: "6px 10px", fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11, color: C.textPri, outline: "none", marginBottom: 12,
          }}
        >
          {[65, 100, 150, 180, 220, 250, 280, 300, 360, 450, 500].map(s => (
            <option key={s} value={s}>{s}mm</option>
          ))}
        </select>

        <Label>Use Case</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
          {Object.entries(configs).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setUseCase(key)}
              style={{
                background: useCase === key ? `${val.color}22` : "transparent",
                border: `1px solid ${useCase === key ? val.color : C.border}`,
                borderRadius: 3,
                padding: "6px 10px",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: useCase === key ? val.color : C.textSec,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              {val.name}
            </button>
          ))}
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card title={`Recommended Build — ${cfg.name}`} badge="COMPONENTS" accent={cfg.color}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "Motor", ...cfg.motor, icon: "⚙️" },
              { label: "ESC", ...cfg.esc, icon: "⚡" },
              { label: "Flight Controller", ...cfg.fc, icon: "🧠" },
              { label: "Propeller", ...cfg.prop, icon: "🌀" },
              { label: "Video / TX", ...cfg.vtx, icon: "📡" },
              { label: "Battery", ...cfg.battery, icon: "🔋" },
            ].map(({ label, name, notes, icon }) => (
              <div key={label} style={{
                padding: 12,
                background: C.bg,
                border: `1px solid ${cfg.color}22`,
                borderRadius: 3,
              }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                <Label>{label}</Label>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: cfg.color, fontWeight: 600, marginBottom: 3 }}>
                  {name}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.textDim, lineHeight: 1.5 }}>
                  {notes}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Compatibility Check" accent={C.green}>
          {[
            ["Motor ↔ ESC", "Current margin ≥ 20%", true],
            ["ESC ↔ FC", "DShot protocol supported", true],
            ["Battery ↔ ESC", "Voltage within rating", true],
            ["Frame ↔ Prop", `${frameSize}mm → prop OK`, frameSize >= 200],
            ["VTX power", "Within legal limits", true],
          ].map(([label, note, ok]) => (
            <div key={label as string} style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 0",
              borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ color: ok ? C.green : C.red, fontSize: 12 }}>{ok ? "✓" : "✗"}</span>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.textPri }}>{label as string}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.textDim }}>{note as string}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB: TELEMETRY ANALYZER
// ─────────────────────────────────────────────
function TelemetryAnalyzer() {
  const [running, setRunning] = useState(false);
  const [data, setData] = useState([]);
  const [cursor, setCursor] = useState(null);
  const intervalRef = useRef(null);
  const timeRef = useRef(0);

  // Simulate live telemetry stream
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        timeRef.current += 0.5;
        const t = timeRef.current;
        setData(prev => {
          const next = [...prev, {
            t,
            alt:     50 + Math.sin(t * 0.1) * 30 + t * 0.5,
            speed:   15 + Math.sin(t * 0.15) * 5,
            battery: Math.max(10, 98 - t * 0.4),
            rssi:    -60 - Math.abs(Math.sin(t * 0.05)) * 20 + Math.random() * 5,
            gps_sats:12 + Math.floor(Math.random() * 3),
            vario:   Math.sin(t * 0.1) * 2,
          }];
          return next.slice(-120);
        });
      }, 100);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const latest = data[data.length - 1];
  const W = 600, H = 120;

  function renderChart(key, color, label, unit, minY, maxY) {
    if (data.length < 2) return null;
    const vals = data.map(d => d[key]);
    const lo = Math.min(...vals, minY);
    const hi = Math.max(...vals, maxY);
    const range = hi - lo || 1;

    const pts = data.map((d, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((d[key] - lo) / range) * (H - 10) - 5;
      return `${x},${y}`;
    }).join(" ");

    const fill = data.map((d, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((d[key] - lo) / range) * (H - 10) - 5;
      return `${x},${y}`;
    });
    fill.push(`${W},${H}`, `0,${H}`);
    const fillPts = fill.join(" ");

    return (
      <div key={key} style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color, letterSpacing: 1 }}>{label}</span>
          {latest && (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color, fontWeight: 600 }}>
              {typeof latest[key] === "number" ? latest[key].toFixed(1) : latest[key]} {unit}
            </span>
          )}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H * 0.6, display: "block" }}>
          <defs>
            <linearGradient id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={fillPts} fill={`url(#fill-${key})`} />
          <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
        </svg>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
      <Card title="Live Telemetry Stream" badge={running ? "LIVE" : "STOPPED"} accent={running ? C.green : C.textDim}>
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => { setRunning(!running); if (!running) { setData([]); timeRef.current = 0; } }}
            style={{
              background: running ? `${C.red}22` : `${C.green}22`,
              border: `1px solid ${running ? C.red : C.green}`,
              borderRadius: 3,
              padding: "6px 20px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: 2,
              color: running ? C.red : C.green,
              cursor: "pointer",
              marginRight: 8,
            }}
          >
            {running ? "■ STOP" : "▶ START"}
          </button>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.textDim }}>
            {data.length} samples · {timeRef.current.toFixed(1)}s
          </span>
        </div>

        {renderChart("alt",     C.cyan,   "ALTITUDE",  "m",    0,   200)}
        {renderChart("speed",   C.green,  "AIRSPEED",  "m/s",  0,   40 )}
        {renderChart("battery", C.amber,  "BATTERY",   "%",    0,   100)}
        {renderChart("rssi",    C.purple, "RSSI",      "dBm",  -100,-40 )}
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card title="Current Values">
          {latest ? (
            <>
              <GaugeBar value={latest.alt}     max={300}  label="ALTITUDE (m)"  color={C.cyan}   />
              <GaugeBar value={latest.speed}   max={40}   label="SPEED (m/s)"   color={C.green}  />
              <GaugeBar value={latest.battery} max={100}  label="BATTERY (%)"   color={latest.battery < 20 ? C.red : latest.battery < 40 ? C.amber : C.green} />
              <GaugeBar value={-latest.rssi}   max={60}   label="RSSI (−dBm)"   color={C.purple} />
              <div style={{ marginTop: 8 }}>
                <ResultRow label="GPS Sats"   value={latest.gps_sats}              unit=""    color={latest.gps_sats >= 10 ? C.green : C.amber} />
                <ResultRow label="Vario"      value={latest.vario.toFixed(2)}      unit="m/s" color={latest.vario > 0 ? C.green : C.red} />
                <ResultRow label="Time"       value={`${timeRef.current.toFixed(1)}s`} unit="" />
              </div>
            </>
          ) : (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.textDim, textAlign: "center", padding: 24 }}>
              Start stream to see live data
            </div>
          )}
        </Card>

        <Card title="Alerts">
          {latest ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {latest.battery < 20 && <Alert color={C.red}   msg="LOW BATTERY" sub={`${latest.battery.toFixed(0)}% — land now`} />}
              {latest.battery < 40 && latest.battery >= 20 && <Alert color={C.amber} msg="BATTERY WARN" sub={`${latest.battery.toFixed(0)}% — RTH soon`} />}
              {latest.rssi < -85   && <Alert color={C.red}   msg="WEAK SIGNAL"  sub={`${latest.rssi.toFixed(0)} dBm`} />}
              {latest.gps_sats < 8 && <Alert color={C.amber} msg="GPS DEGRADED" sub={`Only ${latest.gps_sats} sats`} />}
              {latest.battery >= 40 && latest.rssi >= -85 && latest.gps_sats >= 8 &&
                <Alert color={C.green} msg="ALL SYSTEMS" sub="Nominal" />}
            </div>
          ) : (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.textDim, textAlign: "center", padding: 12 }}>
              —
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Alert({ color, msg, sub }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 8px",
      background: `${color}11`,
      border: `1px solid ${color}44`,
      borderRadius: 3,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color, letterSpacing: 1 }}>{msg}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.textDim }}>{sub}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
const TABS = [
  { id: "propulsion", label: "PROPULSION", sub: "Motor · Prop · Thrust", color: C.cyan },
  { id: "battery",    label: "BATTERY",    sub: "Endurance · Range",      color: C.green },
  { id: "aero",       label: "AERO",       sub: "Lift · Drag · Stall",    color: C.purple },
  { id: "rf",         label: "RF / LINK",  sub: "Friis · Budget · Range", color: C.amber },
  { id: "build",      label: "BUILD",      sub: "Component Selector",     color: C.red },
  { id: "telemetry",  label: "TELEMETRY",  sub: "Live Analysis",          color: C.green },
];

export default function EngineerToolkit() {
  const [tab, setTab] = useState("propulsion");
  const active = TABS.find(t => t.id === tab);

  return (
    <div style={{
      background: C.bg,
      minHeight: "100vh",
      fontFamily: "'JetBrains Mono', monospace",
      color: C.textPri,
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 24px",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: C.surface,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 4, color: C.textDim }}>SKYFORGE</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: active?.color, letterSpacing: 2 }}>
            ENGINEER TOOLKIT
          </div>
        </div>
        <div style={{ width: 1, height: 32, background: C.border }} />
        <div style={{ fontSize: 9, color: C.textDim, lineHeight: 1.8 }}>
          <div>Real physics · Real equations</div>
          <div style={{ color: active?.color }}>{active?.sub}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
          {["PHYS", "ENG", "TOOLS"].map(b => (
            <span key={b} style={{
              fontSize: 8, letterSpacing: 2, color: C.textDim,
              border: `1px solid ${C.border}`, padding: "2px 6px", borderRadius: 2,
            }}>{b}</span>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex",
        borderBottom: `1px solid ${C.border}`,
        background: C.surface,
        overflowX: "auto",
        padding: "0 16px",
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: "none",
              border: "none",
              borderBottom: `2px solid ${tab === t.id ? t.color : "transparent"}`,
              padding: "10px 16px",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: 2,
              color: tab === t.id ? t.color : C.textDim,
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
        {tab === "propulsion" && <PropulsionCalc />}
        {tab === "battery"    && <BatteryCalc />}
        {tab === "aero"       && <AeroCalc />}
        {tab === "rf"         && <LinkCalc />}
        {tab === "build"      && <ComponentSelector />}
        {tab === "telemetry"  && <TelemetryAnalyzer />}
      </div>
    </div>
  );
}
