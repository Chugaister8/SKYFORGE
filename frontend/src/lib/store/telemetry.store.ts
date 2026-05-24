import { create } from "zustand";
import { TelemetrySnapshot } from "@/lib/hooks/useWebSocket";

interface TelemetryState {
  snapshots:    Map<string, TelemetrySnapshot>;
  lastTick:     number;
  setSnapshots: (arr: TelemetrySnapshot[]) => void;
  clear:        () => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  snapshots: new Map(),
  lastTick:  0,
  setSnapshots: (arr) => set((state) => {
    const next = new Map(state.snapshots);
    arr.forEach((s) => next.set(s.uav_id, s));
    return { snapshots: next, lastTick: Date.now() };
  }),
  clear: () => set({ snapshots: new Map(), lastTick: 0 }),
}));
