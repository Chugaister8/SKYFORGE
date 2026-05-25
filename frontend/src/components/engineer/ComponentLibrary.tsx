import { useState, useMemo, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────
// REAL COMPONENT DATABASE
// All specs from manufacturer datasheets / community testing
// ─────────────────────────────────────────────────────────────────

const DB = {

  motors: [
    // FPV Micro/Mini
    { id:"rcinp-1102", brand:"RCINPOWER",  model:"GTS-1102",   kv:8700,  stator:"11×2",  weight:4,   price:12,  maxI:4,   maxP:22,   type:"micro",   volt:[1,2],     useCase:["micro_whoop","tiny_whoop"] },
    { id:"bet-1105",   brand:"BetaFPV",    model:"0802 SE",    kv:19000, stator:"08×2",  weight:2.7, price:9,   maxI:3,   maxP:15,   type:"micro",   volt:[1,2],     useCase:["micro_whoop"] },
    { id:"dys-1306",   brand:"DYS",        model:"1306",       kv:3100,  stator:"13×6",  weight:14,  price:14,  maxI:12,  maxP:80,   type:"mini",    volt:[3,4],     useCase:["3inch","toothpick"] },
    // FPV 5" Freestyle
    { id:"xing2-2207", brand:"iFlight",    model:"XING2 2207", kv:1800,  stator:"22×7",  weight:32,  price:26,  maxI:38,  maxP:560,  type:"5inch",   volt:[4,5,6],   useCase:["5inch_freestyle","5inch_race"] },
    { id:"xing-2207",  brand:"iFlight",    model:"XING 2207",  kv:2450,  stator:"22×7",  weight:31,  price:22,  maxI:35,  maxP:510,  type:"5inch",   volt:[4,5],     useCase:["5inch_freestyle","5inch_race"] },
    { id:"eco2306",    brand:"Emax",       model:"ECO 2306",   kv:2400,  stator:"23×6",  weight:28,  price:15,  maxI:32,  maxP:460,  type:"5inch",   volt:[4,5],     useCase:["5inch_freestyle"] },
    { id:"tmfpv-2306", brand:"T-Motor",    model:"F60 Pro III",kv:1750,  stator:"23×6",  weight:33,  price:35,  maxI:38,  maxP:560,  type:"5inch",   volt:[4,5,6],   useCase:["5inch_freestyle","5inch_race"] },
    { id:"hglrc-2207", brand:"HGLRC",      model:"FD2207",     kv:2550,  stator:"22×7",  weight:31,  price:18,  maxI:35,  maxP:520,  type:"5inch",   volt:[4,5],     useCase:["5inch_race"] },
    // Long Range
    { id:"tpwr-2806",  brand:"T-Motor",    model:"Pacer V2 2806",kv:1300,stator:"28×6",  weight:42,  price:40,  maxI:42,  maxP:620,  type:"5inch",   volt:[4,5,6],   useCase:["5inch_lr","7inch"] },
    { id:"iflt-2806",  brand:"iFlight",    model:"XING2 2806", kv:1300,  stator:"28×6",  weight:43,  price:32,  maxI:40,  maxP:600,  type:"longrange",volt:[4,5,6],  useCase:["7inch","5inch_lr"] },
    // 7inch
    { id:"tpwr-3115",  brand:"T-Motor",    model:"Navigator 3115",kv:900,stator:"31×15", weight:62,  price:45,  maxI:50,  maxP:800,  type:"7inch",   volt:[5,6],     useCase:["7inch","10inch"] },
    { id:"sun-3110",   brand:"SunnySky",   model:"X3110",      kv:1250,  stator:"31×10", weight:75,  price:30,  maxI:48,  maxP:750,  type:"7inch",   volt:[4,5,6],   useCase:["7inch"] },
    // Tactical / Heavy Lift
    { id:"tmhl-4006",  brand:"T-Motor",    model:"MT4006",     kv:740,   stator:"40×6",  weight:110, price:65,  maxI:30,  maxP:450,  type:"heavy",   volt:[4,5,6],   useCase:["heavy_lift","tactical"] },
    { id:"tmhl-4008",  brand:"T-Motor",    model:"MT4008",     kv:380,   stator:"40×8",  weight:115, price:72,  maxI:25,  maxP:370,  type:"heavy",   volt:[6,8,12],  useCase:["heavy_lift","tactical"] },
    { id:"sun-4108",   brand:"SunnySky",   model:"X4108S",     kv:380,   stator:"41×8",  weight:140, price:58,  maxI:28,  maxP:420,  type:"heavy",   volt:[6,12],    useCase:["heavy_lift"] },
    // Fixed Wing
    { id:"sun-2814",   brand:"SunnySky",   model:"X2814",      kv:900,   stator:"28×14", weight:68,  price:32,  maxI:35,  maxP:520,  type:"fw",      volt:[3,4],     useCase:["fixed_wing_1m","fixed_wing_1m5"] },
    { id:"tmfw-at40",  brand:"T-Motor",    model:"AT 4130",    kv:500,   stator:"41×30", weight:138, price:75,  maxI:40,  maxP:600,  type:"fw",      volt:[4,5,6],   useCase:["fixed_wing_2m"] },
    { id:"tmfw-mn40",  brand:"T-Motor",    model:"MN4010",     kv:370,   stator:"40×10", weight:130, price:85,  maxI:30,  maxP:450,  type:"fw",      volt:[6,12],    useCase:["fixed_wing_2m","male_uav"] },
  ],

  escs: [
    { id:"am-blx35",   brand:"AM32",       model:"BLX35",      current:35, burst:45, protocol:["DShot300","DShot600","PWM"], bec:false, weight:5,  price:18, volt:[3,4,5,6],  useCase:["5inch_freestyle","5inch_race","7inch"] },
    { id:"flame-55a",  brand:"iFlight",    model:"FLAME 55A",  current:55, burst:65, protocol:["DShot600","DShot1200"],      bec:false, weight:8,  price:28, volt:[4,5,6],    useCase:["5inch_freestyle","7inch","heavy_lift"] },
    { id:"tbs-75a",    brand:"TBS",        model:"SuperSource 75A",current:75,burst:90,protocol:["DShot600"],               bec:false, weight:12, price:55, volt:[4,5,6],    useCase:["heavy_lift","tactical"] },
    { id:"hol-esc45",  brand:"Holybro",    model:"Kotleta20",  current:20, burst:25, protocol:["DShot300","DShot600"],      bec:true,  weight:3,  price:22, volt:[3,4,5,6],  useCase:["5inch_freestyle","5inch_race"] },
    { id:"bs-30a",     brand:"BLHeli",     model:"BLHeli_32 30A",current:30,burst:40,protocol:["DShot150","DShot300","DShot600"],bec:false,weight:4,price:14,volt:[3,4,5],  useCase:["5inch_freestyle","5inch_race","3inch"] },
    { id:"afro-opto",  brand:"KISS",       model:"KISS 24A",   current:24, burst:32, protocol:["Serial","PWM"],             bec:false, weight:5,  price:20, volt:[2,3,4,5],  useCase:["5inch_race","3inch"] },
    { id:"flt-45a4in1",brand:"Flycolor",   model:"4-in-1 45A", current:45, burst:55, protocol:["DShot300","DShot600"],      bec:true,  weight:22, price:45, volt:[3,4,5,6],  useCase:["5inch_freestyle","5inch_lr"] },
    { id:"tmesc-55",   brand:"T-Motor",    model:"F55A Pro II",current:55, burst:70, protocol:["DShot300","DShot600","Multishot"],bec:false,weight:8,price:40,volt:[4,5,6],  useCase:["7inch","heavy_lift"] },
    { id:"blheli-sb20",brand:"BLHeli_S",   model:"BLHeli_S 20A",current:20,burst:28,protocol:["DShot150","DShot300"],       bec:false, weight:3,  price:9,  volt:[2,3,4],    useCase:["3inch","toothpick","micro_whoop"] },
    { id:"zdm-opto60", brand:"ZDM",        model:"60A OPTO",   current:60, burst:80, protocol:["PWM","OneShot125"],         bec:false, weight:18, price:22, volt:[4,5,6,12], useCase:["heavy_lift","fixed_wing_2m","male_uav"] },
  ],

  flightControllers: [
    { id:"bfcf7",      brand:"Betaflight", model:"F7",         cpu:"STM32F7",  gyro:"ICM42688",  loops:[4000,8000], ports:6, gps:true,  barometer:true,  weight:7,  price:45,  useCase:["5inch_freestyle","5inch_race","7inch"] },
    { id:"sph-f405",   brand:"SpeedyBee",  model:"F405 V3",    cpu:"STM32F4",  gyro:"MPU6000",   loops:[2000,4000], ports:4, gps:true,  barometer:true,  weight:8,  price:30,  useCase:["5inch_freestyle","7inch","fixed_wing_1m"] },
    { id:"mat-h743",   brand:"Matek",      model:"H743-WING",  cpu:"STM32H7",  gyro:"ICM42688",  loops:[4000,8000], ports:8, gps:true,  barometer:true,  weight:10, price:55,  useCase:["fixed_wing_1m","fixed_wing_2m","7inch"] },
    { id:"hol-f7",     brand:"Holybro",    model:"Kakute F7",  cpu:"STM32F7",  gyro:"ICM20689",  loops:[4000,8000], ports:5, gps:true,  barometer:true,  weight:7,  price:40,  useCase:["5inch_freestyle","5inch_lr","7inch"] },
    { id:"pxhk-6c",    brand:"Pixhawk",    model:"6C",         cpu:"STM32H7",  gyro:"ICM-42688-P",loops:[400,1000],ports:16,gps:true,  barometer:true,  weight:38, price:220, useCase:["tactical","heavy_lift","fixed_wing_2m","male_uav"] },
    { id:"cube-org",   brand:"CubePilot",  model:"Cube Orange+",cpu:"STM32H7", gyro:"ICM20649×2",loops:[400,1000], ports:14, gps:true, barometer:true,  weight:35, price:280, useCase:["tactical","heavy_lift","male_uav"] },
    { id:"ardplt-f4",  brand:"Ardupilot",  model:"MatekF405-CTR",cpu:"STM32F4",gyro:"MPU6000",  loops:[2000,4000], ports:6, gps:true,  barometer:true,  weight:9,  price:35,  useCase:["5inch_lr","7inch","fixed_wing_1m"] },
    { id:"aio-f4",     brand:"BetaFPV",    model:"F4 AIO 12A", cpu:"STM32F4",  gyro:"MPU6000",   loops:[2000,4000], ports:2, gps:false, barometer:false, weight:4,  price:28,  useCase:["3inch","toothpick","micro_whoop"] },
    { id:"dji-o3",     brand:"DJI",        model:"O3 Air Unit",cpu:"—",        gyro:"—",         loops:[2000],      ports:3, gps:false, barometer:false, weight:36, price:159, useCase:["5inch_freestyle","7inch"] },
  ],

  batteries: [
    // Micro
    { id:"gnb-1s300",  brand:"GNB",        model:"1S 300mAh",  cells:1, cap:300,  c:90,  weight:8,  wh:1.11, price:5,   useCase:["micro_whoop","tiny_whoop"] },
    { id:"tat-1s450",  brand:"Tattu",      model:"1S 450mAh",  cells:1, cap:450,  c:75,  weight:11, wh:1.66, price:6,   useCase:["micro_whoop","tiny_whoop"] },
    // 3S
    { id:"tat-3s850",  brand:"Tattu",      model:"3S 850mAh",  cells:3, cap:850,  c:75,  weight:75, wh:9.45, price:14,  useCase:["3inch","toothpick"] },
    { id:"gnb-3s1300", brand:"GNB",        model:"3S 1300mAh", cells:3, cap:1300, c:100, weight:110,wh:14.4, price:18,  useCase:["3inch","5inch_freestyle"] },
    // 4S
    { id:"gnb-4s1300", brand:"GNB",        model:"4S 1300mAh", cells:4, cap:1300, c:100, weight:140,wh:19.2, price:22,  useCase:["5inch_freestyle","5inch_race"] },
    { id:"tat-4s1550", brand:"Tattu",      model:"4S 1550mAh", cells:4, cap:1550, c:95,  weight:170,wh:22.9, price:28,  useCase:["5inch_freestyle","5inch_lr"] },
    { id:"lp-4s1800",  brand:"LIPO",       model:"4S 1800mAh", cells:4, cap:1800, c:75,  weight:195,wh:26.6, price:24,  useCase:["5inch_freestyle","5inch_lr","7inch"] },
    { id:"gnb-4s2200", brand:"GNB",        model:"4S 2200mAh", cells:4, cap:2200, c:75,  weight:235,wh:32.5, price:30,  useCase:["5inch_lr","7inch"] },
    // 6S
    { id:"tat-6s1050", brand:"Tattu",      model:"6S 1050mAh", cells:6, cap:1050, c:95,  weight:155,wh:23.3, price:35,  useCase:["5inch_freestyle","5inch_race"] },
    { id:"gnb-6s1300", brand:"GNB",        model:"6S 1300mAh", cells:6, cap:1300, c:100, weight:195,wh:28.8, price:42,  useCase:["5inch_freestyle","7inch"] },
    { id:"tat-6s5000", brand:"Tattu",      model:"6S 5000mAh", cells:6, cap:5000, c:45,  weight:680,wh:111,  price:95,  useCase:["heavy_lift","tactical","fixed_wing_2m"] },
    // 12S
    { id:"tat-12s1600",brand:"Tattu",      model:"12S 1600mAh",cells:12,cap:1600, c:75,  weight:380,wh:71.1, price:125, useCase:["heavy_lift","male_uav"] },
    { id:"brnl-12s8ah", brand:"Bonnel",    model:"12S 8000mAh",cells:12,cap:8000, c:30,  weight:2200,wh:355, price:280, useCase:["male_uav","heavy_lift"] },
  ],

  props: [
    // Micro
    { id:"gemf-2535",  brand:"Gemfan",     model:"2535",  diam:2.5, pitch:3.5, blades:3, weight:1.2, price:5,  material:"PC",       useCase:["micro_whoop","tiny_whoop"] },
    { id:"gemf-3016",  brand:"Gemfan",     model:"3016",  diam:3.0, pitch:1.6, blades:3, weight:2.4, price:6,  material:"PC",       useCase:["3inch","toothpick"] },
    // 5" Freestyle
    { id:"hqp-5148",   brand:"HQProp",     model:"5148 V1S",diam:5.1,pitch:4.8,blades:3,weight:4.8, price:10, material:"Polycarbonate", useCase:["5inch_freestyle"] },
    { id:"gemf-51466", brand:"Gemfan",     model:"51466", diam:5.1, pitch:4.66,blades:3, weight:5.1, price:9,  material:"PC",       useCase:["5inch_freestyle"] },
    { id:"dal-5043",   brand:"DAL",        model:"Cyclone 5043",diam:5.0,pitch:4.3,blades:3,weight:5.5,price:12,material:"PC/CF",  useCase:["5inch_freestyle","5inch_race"] },
    { id:"hqp-v1s4",   brand:"HQProp",     model:"5040 V1S",diam:5.0,pitch:4.0,blades:4, weight:5.8, price:11, material:"PC",       useCase:["5inch_race"] },
    // 5" LR
    { id:"hqp-5130",   brand:"HQProp",     model:"5130 V1S",diam:5.1,pitch:3.0,blades:3,weight:4.2, price:9,  material:"PC",       useCase:["5inch_lr"] },
    // 7"
    { id:"dal-7040",   brand:"DAL",        model:"7040 Fold",diam:7.0,pitch:4.0,blades:2,weight:12, price:18,  material:"CF",       useCase:["7inch"] },
    { id:"hqp-7035",   brand:"HQProp",     model:"7035 V1S",diam:7.0,pitch:3.5,blades:3,weight:14, price:22,  material:"CF",       useCase:["7inch"] },
    // Heavy lift
    { id:"tmot-1555",  brand:"T-Motor",    model:"CF15×5.5",diam:15,pitch:5.5, blades:2, weight:48, price:35,  material:"CF",       useCase:["heavy_lift","tactical"] },
    { id:"tmot-1855",  brand:"T-Motor",    model:"CF18×6.1",diam:18,pitch:6.1, blades:2, weight:62, price:42,  material:"CF",       useCase:["heavy_lift","male_uav"] },
    // Fixed wing
    { id:"apce-1047",  brand:"APC",        model:"10×4.7",diam:10,pitch:4.7,  blades:2, weight:25, price:8,   material:"APC",      useCase:["fixed_wing_1m"] },
    { id:"apce-1260",  brand:"APC",        model:"12×6E", diam:12,pitch:6.0,  blades:2, weight:38, price:12,  material:"APC",      useCase:["fixed_wing_1m5","fixed_wing_2m"] },
  ],

};

// ─────────────────────────────────────────────
// PHYSICS (same as main toolkit)
// ─────────────────────────────────────────────
const PHYS = {
  thrustFromMotor(kv, volt, prop_in, eff = 0.75) {
    const n = kv * volt / 60;
    const d = prop_in * 0.0254;
    return 0.12 * eff * 1.225 * n * n * d * d * d * d;
  },
  powerFromMotor(kv, volt, prop_in, eff = 0.75) {
    const n = kv * volt / 60;
    const d = prop_in * 0.0254;
    return 0.04 * eff * 1.225 * n * n * n * d * d * d * d * d;
  },
  flightTime(cap_mah, volt, current_a) {
    return (cap_mah / 1000) / current_a * 60;
  },
  cRating(cap_mah, current) {
    return current / (cap_mah / 1000);
  },
};

// ─────────────────────────────────────────────
// DESIGN
// ─────────────────────────────────────────────
const C = {
  bg: "#06090E", surface: "#0B1018", raised: "#0F1620",
  border: "#182030", borderA: "#2A4060",
  cyan: "#00C8FF", green: "#00FF94", amber: "#FFB800",
  red: "#FF3E3E", purple: "#C084FC",
  textPri: "#DDE8F5", textSec: "#6A90B0", textDim: "#334455",
};

function M(base, ...overrides) {
  return Object.assign({}, base, ...overrides);
}

const mono = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };

function Tag({ children, color = C.cyan }) {
  return (
    <span style={M(mono, {
      fontSize: 8, letterSpacing: 2, color,
      border: `1px solid ${color}55`, background: `${color}11`,
      padding: "1px 5px", borderRadius: 2, whiteSpace: "nowrap",
    })}>
      {children}
    </span>
  );
}

function Lbl({ children }) {
  return <div style={M(mono, { fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 5 })}>{children}</div>;
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <Lbl>{label}</Lbl>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={M(mono, {
          width: "100%", background: C.bg, border: `1px solid ${C.border}`,
          borderRadius: 3, padding: "7px 10px", fontSize: 11,
          color: C.textPri, outline: "none",
        })}
        onFocus={e => e.target.style.borderColor = C.cyan}
        onBlur={e => e.target.style.borderColor = C.border}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function RangeInput({ label, value, onChange, min, max, step, unit, color = C.cyan }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <Lbl>{label}</Lbl>
        <span style={M(mono, { fontSize: 11, color, marginTop: -4 })}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color }} />
    </div>
  );
}

function StatBox({ label, value, unit, color = C.cyan, note }) {
  return (
    <div style={{
      padding: "12px 14px", background: C.bg,
      border: `1px solid ${color}33`, borderRadius: 3,
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={M(mono, { fontSize: 8, letterSpacing: 2, color: C.textDim, marginBottom: 4 })}>{label}</div>
      <div style={M(mono, { fontSize: 20, fontWeight: 700, color, lineHeight: 1 })}>{value}</div>
      {unit && <div style={M(mono, { fontSize: 8, color: C.textDim, marginTop: 2 })}>{unit}</div>}
      {note && <div style={M(mono, { fontSize: 9, color: C.textSec, marginTop: 4 })}>{note}</div>}
    </div>
  );
}

function ComponentCard({ item, type, selected, onSelect, score, propDiam }) {
  const isSelected = selected?.id === item.id;
  const color = type === "motor" ? C.cyan
    : type === "esc" ? C.amber
    : type === "fc" ? C.purple
    : type === "battery" ? C.green
    : C.red;

  // Calculate performance metrics for motor
  let thrust = null, power = null, current = null;
  if (type === "motor" && propDiam) {
    const volt = item.volt[Math.floor(item.volt.length / 2)] * 3.7 + 0.3;
    thrust  = PHYS.thrustFromMotor(item.kv, volt, propDiam);
    power   = PHYS.powerFromMotor(item.kv, volt, propDiam);
    current = power / volt;
  }

  return (
    <div
      onClick={() => onSelect(item)}
      style={{
        padding: "12px 14px",
        background: isSelected ? `${color}11` : C.surface,
        border: `1px solid ${isSelected ? color : C.border}`,
        borderRadius: 3, cursor: "pointer",
        transition: "all 0.15s",
        position: "relative",
        boxShadow: isSelected ? `0 0 12px ${color}22` : "none",
      }}
    >
      {score !== undefined && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          ...mono, fontSize: 9, color,
          background: `${color}22`, border: `1px solid ${color}44`,
          padding: "1px 6px", borderRadius: 2,
        }}>
          {score}% match
        </div>
      )}

      <div style={{ marginBottom: 6 }}>
        <span style={M(mono, { fontSize: 9, color: C.textDim })}>{item.brand}</span>
        <div style={M(mono, { fontSize: 13, fontWeight: 700, color: isSelected ? color : C.textPri })}>
          {item.model}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {type === "motor" && [
          `${item.kv}KV`, `${item.stator}`, `${item.maxI}A max`, `${item.weight}g`
        ].map(t => <Tag key={t} color={color}>{t}</Tag>)}

        {type === "esc" && [
          `${item.current}A`, `${item.burst}A burst`,
          ...item.protocol.slice(0, 2).map(p => p)
        ].map(t => <Tag key={t} color={color}>{t}</Tag>)}

        {type === "fc" && [
          item.cpu.split("STM32")[1] || item.cpu,
          item.gyro.split("ICM")[1] ? `ICM${item.gyro.split("ICM")[1]}` : item.gyro,
          `${item.ports}× UART`,
          item.gps ? "GPS" : null,
        ].filter(Boolean).map(t => <Tag key={t} color={color}>{t}</Tag>)}

        {type === "battery" && [
          `${item.cells}S`, `${item.cap}mAh`, `${item.c}C`,
          `${item.wh}Wh`, `${item.weight}g`
        ].map(t => <Tag key={t} color={color}>{t}</Tag>)}

        {type === "prop" && [
          `${item.diam}"`, `${item.pitch}" pitch`,
          `${item.blades}B`, item.material
        ].map(t => <Tag key={t} color={color}>{t}</Tag>)}
      </div>

      {type === "motor" && thrust && (
        <div style={{ display: "flex", gap: 12 }}>
          <span style={M(mono, { fontSize: 9, color: C.textSec })}>T: {thrust.toFixed(1)}N</span>
          <span style={M(mono, { fontSize: 9, color: C.textSec })}>P: {power.toFixed(0)}W</span>
          <span style={M(mono, { fontSize: 9, color: C.textSec })}>I: {current.toFixed(1)}A</span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={M(mono, { fontSize: 10, color: C.textDim })}>{item.weight}g</span>
        <span style={M(mono, { fontSize: 10, color: C.textSec })}>${item.price}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SCORING ENGINE
// ─────────────────────────────────────────────
function scoreMotor(motor, { useCase, massG, motors, voltRange, twr }) {
  let s = 0;
  if (motor.useCase.some(u => useCase.includes(u))) s += 40;
  const mid_v = (motor.volt[0] + motor.volt[motor.volt.length - 1]) / 2 * 3.7 + 0.3;
  if (voltRange[0] <= mid_v && mid_v <= voltRange[1]) s += 20;
  const thrust = PHYS.thrustFromMotor(motor.kv, mid_v, useCaseToProp(useCase));
  const req    = (massG / 1000 * 9.81 * twr) / motors;
  if (thrust >= req) s += 30;
  if (motor.maxI < 50) s += 10;
  return Math.min(99, s);
}

function scoreESC(esc, { useCase, motor }) {
  let s = 0;
  if (esc.useCase.some(u => useCase.includes(u))) s += 40;
  if (motor) {
    const margin = (esc.current - motor.maxI) / motor.maxI;
    if (margin >= 0.2 && margin <= 1.0) s += 35;
    else if (margin > 0) s += 15;
    if (motor.volt.some(v => esc.volt.includes(v))) s += 15;
  }
  if (esc.protocol.includes("DShot600")) s += 10;
  return Math.min(99, s);
}

function scoreFC(fc, { useCase }) {
  let s = 0;
  if (fc.useCase.some(u => useCase.includes(u))) s += 50;
  if (fc.loops[fc.loops.length - 1] >= 4000) s += 20;
  if (fc.gps && useCase.some(u => ["7inch","fixed_wing_1m","fixed_wing_2m","male_uav","tactical","5inch_lr"].includes(u))) s += 20;
  if (fc.ports >= 4) s += 10;
  return Math.min(99, s);
}

function scoreBattery(bat, { useCase, motor, motors }) {
  let s = 0;
  if (bat.useCase.some(u => useCase.includes(u))) s += 40;
  if (motor) {
    const mid_v = bat.cells * 3.7 + 0.3;
    if (motor.volt.includes(bat.cells)) s += 30;
    const hoverI = PHYS.powerFromMotor(motor.kv, mid_v, useCaseToProp(useCase)) / mid_v * motors;
    const c      = PHYS.cRating(bat.cap, hoverI);
    if (c <= bat.c * 0.6) s += 20;
    else if (c <= bat.c) s += 10;
  }
  s += 10;
  return Math.min(99, s);
}

function scoreProp(prop, { useCase, motor }) {
  let s = 0;
  if (prop.useCase.some(u => useCase.includes(u))) s += 60;
  const pd = useCaseToPropDiam(useCase);
  if (Math.abs(prop.diam - pd) < 0.5) s += 30;
  if (prop.material === "CF") s += 10;
  return Math.min(99, s);
}

function useCaseToProp(useCase) {
  const map = {
    micro_whoop: 2.5, tiny_whoop: 2.5, "3inch": 3, toothpick: 3,
    "5inch_freestyle": 5.1, "5inch_race": 5, "5inch_lr": 5.1,
    "7inch": 7, heavy_lift: 15, tactical: 15,
    fixed_wing_1m: 10, fixed_wing_1m5: 12, fixed_wing_2m: 14, male_uav: 18,
  };
  for (const k of (useCase || [])) if (map[k]) return map[k];
  return 5;
}

function useCaseToPropDiam(useCase) {
  return useCaseToProp(useCase);
}

// ─────────────────────────────────────────────
// BUILD COMPATIBILITY ANALYZER
// ─────────────────────────────────────────────
function analyzeCompatibility(sel, massG, motors) {
  const issues = [], warnings = [], ok = [];

  if (!sel.motor || !sel.esc || !sel.fc || !sel.battery || !sel.prop)
    return { issues: ["Select all components to analyze"], warnings: [], ok: [] };

  // Motor ↔ ESC voltage
  const cellMatch = sel.motor.volt.some(v => sel.esc.volt.includes(v));
  if (!cellMatch) issues.push(`Motor voltage ${sel.motor.volt.join("/")}S ≠ ESC voltage ${sel.esc.volt.join("/")}S`);
  else ok.push("Motor ↔ ESC voltage compatible");

  // Motor ↔ ESC current
  const margin = sel.esc.current / sel.motor.maxI;
  if (margin < 1.0) issues.push(`ESC ${sel.esc.current}A < Motor max ${sel.motor.maxI}A — will burn!`);
  else if (margin < 1.2) warnings.push(`ESC margin only ${((margin - 1) * 100).toFixed(0)}% — add heatsink`);
  else ok.push(`ESC current margin +${((margin - 1) * 100).toFixed(0)}% ✓`);

  // Battery ↔ Motor
  const batVolts = sel.battery.cells;
  if (!sel.motor.volt.includes(batVolts)) warnings.push(`Battery ${batVolts}S may not be optimal for ${sel.motor.kv}KV motor`);
  else ok.push(`Battery ${batVolts}S matches motor voltage range`);

  // C-rating
  const volt = sel.battery.cells * 3.7 + 0.3;
  const hoverP = PHYS.powerFromMotor(sel.motor.kv, volt, sel.prop.diam) * motors;
  const hoverI = hoverP / volt;
  const cUsed  = PHYS.cRating(sel.battery.cap, hoverI);
  if (cUsed > sel.battery.c) issues.push(`C-rating exceeded: need ${cUsed.toFixed(0)}C, battery rated ${sel.battery.c}C`);
  else if (cUsed > sel.battery.c * 0.7) warnings.push(`High C draw: ${cUsed.toFixed(0)}C / ${sel.battery.c}C — battery will get warm`);
  else ok.push(`C-rating safe: ${cUsed.toFixed(0)}C / ${sel.battery.c}C`);

  // TWR
  const thrust = PHYS.thrustFromMotor(sel.motor.kv, volt, sel.prop.diam) * motors;
  const weight = (massG / 1000) * 9.81;
  const twr    = thrust / weight;
  if (twr < 1.5) issues.push(`TWR ${twr.toFixed(2)} — under-powered! (need >1.5)`);
  else if (twr < 2.0) warnings.push(`TWR ${twr.toFixed(2)} — flyable but sluggish`);
  else ok.push(`TWR ${twr.toFixed(2)} — ${twr >= 3 ? "race/acro ready" : "good performance"}`);

  // Prop ↔ Frame size compatibility (based on prop diam vs useCase)
  const propOk = sel.prop.useCase.some(u => sel.motor.useCase.includes(u));
  if (!propOk) warnings.push(`Prop ${sel.prop.diam}" may not suit motor ${sel.motor.stator} stator`);
  else ok.push(`Prop size matches motor stator`);

  // Flight time estimate
  const t_hover = PHYS.flightTime(sel.battery.cap, volt, hoverI);
  const cruiseI = hoverI * 0.5;
  const t_cruise = PHYS.flightTime(sel.battery.cap, volt, cruiseI);
  ok.push(`Estimated hover: ${t_hover.toFixed(1)} min | Cruise: ${t_cruise.toFixed(1)} min`);

  return { issues, warnings, ok, twr, hoverI, t_hover, t_cruise, thrust };
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

const USE_CASES = [
  { value: "micro_whoop",      label: "Micro Whoop (≤2.5\")" },
  { value: "3inch",            label: "3\" Toothpick / Mini" },
  { value: "5inch_freestyle",  label: "5\" Freestyle" },
  { value: "5inch_race",       label: "5\" Race" },
  { value: "5inch_lr",         label: "5\" Long Range" },
  { value: "7inch",            label: "7\" Long Range" },
  { value: "heavy_lift",       label: "Heavy Lift (10\"+)" },
  { value: "tactical",         label: "Tactical Multirotor" },
  { value: "fixed_wing_1m",    label: "Fixed Wing 1m" },
  { value: "fixed_wing_1m5",   label: "Fixed Wing 1.5m" },
  { value: "fixed_wing_2m",    label: "Fixed Wing 2m+" },
  { value: "male_uav",         label: "MALE / ISR UAV" },
];

const TABS_COMP = [
  { id: "motor",   label: "MOTORS",      color: C.cyan   },
  { id: "esc",     label: "ESC",         color: C.amber  },
  { id: "fc",      label: "FLIGHT CTRL", color: C.purple },
  { id: "battery", label: "BATTERIES",   color: C.green  },
  { id: "prop",    label: "PROPS",       color: C.red    },
];

export default function ComponentLibrary() {
  const [useCase,  setUseCase]  = useState("5inch_freestyle");
  const [massG,    setMassG]    = useState(650);
  const [motorCnt, setMotorCnt] = useState(4);
  const [twr,      setTwr]      = useState(4);
  const [tab,      setTab]      = useState("motor");
  const [selected, setSelected] = useState({ motor: null, esc: null, fc: null, battery: null, prop: null });
  const [search,   setSearch]   = useState("");

  const uc = [useCase];

  // Score all components
  const scored = useMemo(() => {
    const voltRange = [7.4, 25.2];
    return {
      motor:   DB.motors.map(m => ({ ...m, _score: scoreMotor(m, { useCase: uc, massG, motors: motorCnt, voltRange, twr }) })).sort((a, b) => b._score - a._score),
      esc:     DB.escs.map(e => ({ ...e, _score: scoreESC(e, { useCase: uc, motor: selected.motor }) })).sort((a, b) => b._score - a._score),
      fc:      DB.flightControllers.map(f => ({ ...f, _score: scoreFC(f, { useCase: uc }) })).sort((a, b) => b._score - a._score),
      battery: DB.batteries.map(b => ({ ...b, _score: scoreBattery(b, { useCase: uc, motor: selected.motor, motors: motorCnt }) })).sort((a, b) => b._score - a._score),
      prop:    DB.props.map(p => ({ ...p, _score: scoreProp(p, { useCase: uc, motor: selected.motor }) })).sort((a, b) => b._score - a._score),
    };
  }, [useCase, massG, motorCnt, twr, selected.motor]);

  const compat = useMemo(() =>
    analyzeCompatibility(selected, massG, motorCnt),
    [selected, massG, motorCnt]
  );

  const currentList = scored[tab] || [];
  const filtered = search
    ? currentList.filter(c =>
        `${c.brand} ${c.model}`.toLowerCase().includes(search.toLowerCase())
      )
    : currentList;

  const tabColor = TABS_COMP.find(t => t.id === tab)?.color || C.cyan;

  const totalWeight = [selected.motor, selected.esc, selected.fc, selected.battery, selected.prop]
    .filter(Boolean)
    .reduce((s, c) => s + (c.weight || 0), 0) * (tab === "motor" ? motorCnt : 1);

  const totalCost = [selected.motor, selected.esc, selected.fc, selected.battery, selected.prop]
    .filter(Boolean)
    .reduce((s, c) => s + (c.price || 0), 0);

  const autoSelect = useCallback(() => {
    setSelected({
      motor:   scored.motor[0],
      esc:     scored.esc[0],
      fc:      scored.fc[0],
      battery: scored.battery[0],
      prop:    scored.prop[0],
    });
  }, [scored]);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.textPri }}>
      {/* Header */}
      <div style={{
        padding: "12px 20px", borderBottom: `1px solid ${C.border}`,
        background: C.surface, display: "flex", alignItems: "center", gap: 16,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div>
          <div style={M(mono, { fontSize: 8, letterSpacing: 4, color: C.textDim })}>SKYFORGE</div>
          <div style={M(mono, { fontSize: 13, fontWeight: 700, color: C.cyan, letterSpacing: 2 })}>COMPONENT LIBRARY</div>
        </div>
        <div style={{ width: 1, height: 28, background: C.border }} />
        <div style={M(mono, { fontSize: 9, color: C.textDim, lineHeight: 1.8 })}>
          <div>{DB.motors.length + DB.escs.length + DB.flightControllers.length + DB.batteries.length + DB.props.length} components</div>
          <div style={{ color: C.cyan }}>Smart matching · Compatibility check</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {totalCost > 0 && (
            <span style={M(mono, { fontSize: 11, color: C.amber })}>~${totalCost}</span>
          )}
          <button onClick={autoSelect} style={{
            background: `${C.cyan}22`, border: `1px solid ${C.cyan}66`,
            borderRadius: 3, padding: "5px 12px",
            ...mono, fontSize: 9, letterSpacing: 2, color: C.cyan, cursor: "pointer",
          }}>
            AUTO-SELECT
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 300px", height: "calc(100vh - 53px)" }}>

        {/* LEFT: Build parameters */}
        <div style={{
          borderRight: `1px solid ${C.border}`,
          background: C.surface,
          padding: 16, overflowY: "auto",
        }}>
          <div style={M(mono, { fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 14 })}>BUILD REQUIREMENTS</div>

          <Select
            label="USE CASE"
            value={useCase}
            onChange={setUseCase}
            options={USE_CASES}
          />
          <RangeInput label="TOTAL MASS" value={massG} onChange={setMassG} min={50} max={5000} step={25} unit="g" color={C.textSec} />
          <RangeInput label="MOTORS" value={motorCnt} onChange={setMotorCnt} min={1} max={8} step={1} unit="×" color={C.amber} />
          <RangeInput label="TARGET TWR" value={twr} onChange={setTwr} min={1.5} max={6} step={0.5} unit=":1" color={C.purple} />

          <div style={{ height: 1, background: C.border, margin: "16px 0" }} />
          <div style={M(mono, { fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 12 })}>SELECTED BUILD</div>

          {TABS_COMP.map(({ id, label, color }) => {
            const item = selected[id];
            return (
              <div key={id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 0", borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ width: 3, height: 24, background: item ? color : C.border, borderRadius: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={M(mono, { fontSize: 8, color: C.textDim, letterSpacing: 1 })}>{label}</div>
                  <div style={M(mono, { fontSize: 10, color: item ? color : C.textDim })}
                    title={item ? `${item.brand} ${item.model}` : "—"}>
                    {item ? `${item.brand} ${item.model}`.substring(0, 22) : "— not selected"}
                  </div>
                </div>
                {item && (
                  <button onClick={() => setSelected(s => ({ ...s, [id]: null }))}
                    style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                )}
              </div>
            );
          })}

          {compat.twr && (
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <StatBox label="TWR" value={compat.twr.toFixed(2)} color={compat.twr >= 2 ? C.green : compat.twr >= 1.5 ? C.amber : C.red} />
              <StatBox label="HOVER" value={`${compat.t_hover?.toFixed(1)}`} unit="min" color={C.cyan} />
            </div>
          )}
        </div>

        {/* CENTER: Component list */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tab bar */}
          <div style={{
            display: "flex", borderBottom: `1px solid ${C.border}`,
            background: C.surface, padding: "0 16px",
          }}>
            {TABS_COMP.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: "none", border: "none",
                borderBottom: `2px solid ${tab === t.id ? t.color : "transparent"}`,
                padding: "10px 14px", cursor: "pointer",
                ...mono, fontSize: 9, letterSpacing: 2,
                color: tab === t.id ? t.color : C.textDim,
                transition: "all 0.15s",
              }}>
                {t.label}
                {selected[t.id] && <span style={{ marginLeft: 4, color: t.color }}>●</span>}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
            <input
              placeholder={`Search ${tab}s...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={M(mono, {
                width: "100%", background: C.raised,
                border: `1px solid ${C.border}`, borderRadius: 3,
                padding: "6px 10px", fontSize: 11, color: C.textPri, outline: "none",
                boxSizing: "border-box",
              })}
            />
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "grid", gap: 8, alignContent: "start",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {filtered.map(item => (
              <ComponentCard
                key={item.id}
                item={item}
                type={tab}
                selected={selected[tab]}
                onSelect={c => setSelected(s => ({ ...s, [tab]: c }))}
                score={item._score}
                propDiam={useCaseToProp(uc)}
              />
            ))}
          </div>
        </div>

        {/* RIGHT: Compatibility */}
        <div style={{
          borderLeft: `1px solid ${C.border}`,
          background: C.surface, padding: 16, overflowY: "auto",
        }}>
          <div style={M(mono, { fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 14 })}>COMPATIBILITY ANALYSIS</div>

          {/* Issues */}
          {compat.issues.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={M(mono, { fontSize: 8, color: C.red, letterSpacing: 2, marginBottom: 6 })}>✗ ISSUES</div>
              {compat.issues.map((msg, i) => (
                <div key={i} style={{
                  padding: "7px 10px", background: `${C.red}0D`,
                  border: `1px solid ${C.red}44`, borderRadius: 3, marginBottom: 4,
                }}>
                  <span style={M(mono, { fontSize: 10, color: C.red })}>{msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {compat.warnings.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={M(mono, { fontSize: 8, color: C.amber, letterSpacing: 2, marginBottom: 6 })}>⚠ WARNINGS</div>
              {compat.warnings.map((msg, i) => (
                <div key={i} style={{
                  padding: "7px 10px", background: `${C.amber}0D`,
                  border: `1px solid ${C.amber}44`, borderRadius: 3, marginBottom: 4,
                }}>
                  <span style={M(mono, { fontSize: 10, color: C.amber })}>{msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* OK */}
          {compat.ok.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={M(mono, { fontSize: 8, color: C.green, letterSpacing: 2, marginBottom: 6 })}>✓ OK</div>
              {compat.ok.map((msg, i) => (
                <div key={i} style={{
                  padding: "7px 10px", background: `${C.green}08`,
                  border: `1px solid ${C.green}33`, borderRadius: 3, marginBottom: 4,
                }}>
                  <span style={M(mono, { fontSize: 10, color: C.green })}>{msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Performance summary */}
          {compat.twr && (
            <>
              <div style={{ height: 1, background: C.border, margin: "14px 0" }} />
              <div style={M(mono, { fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 10 })}>PERFORMANCE SUMMARY</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <StatBox label="TWR" value={compat.twr.toFixed(2)}
                  color={compat.twr >= 3 ? C.green : compat.twr >= 2 ? C.cyan : compat.twr >= 1.5 ? C.amber : C.red}
                  note={compat.twr >= 3 ? "Race/Acro" : compat.twr >= 2 ? "Good" : "Marginal"} />
                <StatBox label="HOVER TIME" value={`${compat.t_hover?.toFixed(1)}`} unit="min" color={C.cyan} />
                <StatBox label="CRUISE TIME" value={`${compat.t_cruise?.toFixed(1)}`} unit="min" color={C.purple} />
                <StatBox label="HOVER I" value={`${compat.hoverI?.toFixed(1)}`} unit="A total" color={C.amber} />
              </div>

              {/* TWR gauge */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={M(mono, { fontSize: 8, color: C.textDim, letterSpacing: 1 })}>THRUST/WEIGHT</span>
                  <span style={M(mono, { fontSize: 9, color: C.cyan })}>{compat.twr.toFixed(2)}:1</span>
                </div>
                <div style={{ height: 6, background: C.bg, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(100, (compat.twr / 6) * 100)}%`,
                    background: `linear-gradient(90deg, ${C.amber}, ${C.green})`,
                    borderRadius: 3, transition: "width 0.4s ease",
                    boxShadow: `0 0 8px ${C.green}55`,
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                  {["1.5", "2", "3", "4", "6"].map(v => (
                    <span key={v} style={M(mono, { fontSize: 7, color: C.textDim })}>{v}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Total build stats */}
          {Object.values(selected).filter(Boolean).length > 1 && (
            <>
              <div style={{ height: 1, background: C.border, margin: "14px 0" }} />
              <div style={M(mono, { fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 10 })}>BUILD TOTALS</div>
              {[
                ["Est. Cost",   `~$${totalCost}`,                C.amber],
                ["Components",  `${Object.values(selected).filter(Boolean).length}/5`, C.textSec],
              ].map(([l, v, c]) => (
                <div key={l as string} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "5px 0", borderBottom: `1px solid ${C.border}`,
                }}>
                  <span style={M(mono, { fontSize: 10, color: C.textDim })}>{l as string}</span>
                  <span style={M(mono, { fontSize: 11, color: c as string, fontWeight: 600 })}>{v as string}</span>
                </div>
              ))}
            </>
          )}

          {Object.values(selected).every(v => !v) && (
            <div style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🔧</div>
              <div style={M(mono, { fontSize: 10, color: C.textDim, lineHeight: 1.8 })}>
                Select components from<br />the list to see<br />compatibility analysis
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
