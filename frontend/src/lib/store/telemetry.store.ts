import { create } from "zustand";

export interface TelemetrySnapshot {
  uav_id:      string;
  callsign:    string;
  status:      string;
  lat:         number | null;
  lon:         number | null;
  altitude_m:  number | null;
  speed_ms:    number | null;
  heading_deg: number | null;
  battery_pct: number | null;
  link_quality:number | null;
  timestamp:   string;
}

type WsState = "connecting"|"connected"|"disconnected"|"error";

interface TelemetryState {
  snapshots:    Map<string, TelemetrySnapshot>;
  lastTick:     number;
  wsState:      WsState;
  setSnapshots: (arr: TelemetrySnapshot[]) => void;
  setWsState:   (s: WsState) => void;
  clear:        () => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  snapshots: new Map(),
  lastTick:  0,
  wsState:   "disconnected",

  setSnapshots: (arr) => set((state) => {
    const next = new Map(state.snapshots);
    arr.forEach(s => next.set(s.uav_id, s));
    return { snapshots: next, lastTick: Date.now() };
  }),

  setWsState: (wsState) => set({ wsState }),

  clear: () => set({ snapshots: new Map(), lastTick: 0 }),
}));
