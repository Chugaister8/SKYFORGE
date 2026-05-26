/**
 * Global event bus via Zustand.
 * Replaces sessionStorage for cross-page communication.
 *
 * Usage:
 *   // Publish
 *   useEventStore.getState().emit("FAILURE_INJECTED", { id: "motor_loss", ... })
 *
 *   // Subscribe (in component)
 *   const payload = useEventStore(s => s.last("FAILURE_INJECTED"))
 *   useEffect(() => { if (payload) handleFailure(payload) }, [payload])
 */
import { create } from "zustand";

export type EventType =
  | "FAILURE_INJECTED"      // Engineer → Simulator
  | "MISSION_LOADED"        // Mission Planner → Simulator
  | "SCENARIO_LOADED"       // Scenarios → Mission Planner
  | "AAR_READY"             // Simulator → AAR
  | "CERT_EARNED"           // Training → anywhere
  | "ALERT"                 // Generic app alert

export interface AppEvent<T = unknown> {
  type:      EventType;
  payload:   T;
  timestamp: number;
  id:        string;
}

interface EventState {
  events:  AppEvent[];
  // Emit a new event
  emit:    (type: EventType, payload?: unknown) => void;
  // Get the latest event of a given type (or null)
  last:    (type: EventType) => AppEvent | null;
  // Clear processed events of a type
  consume: (type: EventType) => void;
  // Clear all
  clear:   () => void;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],

  emit: (type, payload = {}) => {
    const ev: AppEvent = {
      type,
      payload,
      timestamp: Date.now(),
      id: Math.random().toString(36).slice(2, 9),
    };
    set(s => ({ events: [...s.events.slice(-50), ev] })); // keep last 50
  },

  last: (type) => {
    const all = get().events.filter(e => e.type === type);
    return all.length > 0 ? all[all.length - 1] : null;
  },

  consume: (type) => {
    set(s => ({ events: s.events.filter(e => e.type !== type) }));
  },

  clear: () => set({ events: [] }),
}));
