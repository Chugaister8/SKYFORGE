/**
 * Event-sourced flight log writer.
 * Buffers events and flushes to backend every 5s or on demand.
 * Provides the single source of truth for AAR.
 */
import { useRef, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";

export type EventType =
  | "TAKEOFF" | "LAND" | "RTH"
  | "WAYPOINT_REACHED" | "WAYPOINT_MISSED"
  | "THREAT_DETECTED" | "THREAT_LOCKED" | "THREAT_EVADED" | "THREAT_HIT"
  | "EW_GPS_DENIED" | "EW_LINK_DENIED" | "EW_GPS_RESTORED" | "EW_IMPACT"
  | "FAILURE_INJECTED"
  | "ALTITUDE_WARNING" | "BATTERY_LOW"
  | "MISSION_START" | "MISSION_COMPLETE";

export interface LogEvent {
  t:    number;         // mission time seconds
  type: EventType;
  data: Record<string, unknown>;
}

export interface TrackPoint {
  t:          number;
  lat:        number;
  lon:        number;
  alt_m:      number;
  speed_ms:   number;
  heading_deg:number;
  battery_pct:number;
  ew_threat:  string;
}

export function useFlightLog(missionId: string | null) {
  const token         = useAuthStore(s => s.accessToken);
  const eventsRef     = useRef<LogEvent[]>([]);
  const trackRef      = useRef<TrackPoint[]>([]);
  const pendingRef    = useRef<LogEvent[]>([]);
  const pendingTrk    = useRef<TrackPoint[]>([]);
  const startTimeRef  = useRef<number>(0);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeRef     = useRef(false);

  const getElapsed = useCallback(() =>
    startTimeRef.current > 0 ? (Date.now() - startTimeRef.current) / 1000 : 0,
  []);

  // ── Core writers ─────────────────────────────────────────────

  const logEvent = useCallback((type: EventType, data: Record<string, unknown> = {}) => {
    if (!activeRef.current) return;
    const ev: LogEvent = { t: getElapsed(), type, data };
    eventsRef.current.push(ev);
    pendingRef.current.push(ev);
  }, [getElapsed]);

  const logTrack = useCallback((pt: Omit<TrackPoint, "t">) => {
    if (!activeRef.current) return;
    const p: TrackPoint = { t: getElapsed(), ...pt };
    trackRef.current.push(p);
    pendingTrk.current.push(p);
    // Keep in-memory track to last 5000 points
    if (trackRef.current.length > 5000) {
      trackRef.current = trackRef.current.slice(-5000);
    }
  }, [getElapsed]);

  // ── Flush to backend ─────────────────────────────────────────

  const flush = useCallback(async (force = false) => {
    if (!missionId || !token) return;
    if (!force && pendingRef.current.length === 0 && pendingTrk.current.length === 0) return;

    const events = [...pendingRef.current];
    const track  = [...pendingTrk.current];
    pendingRef.current  = [];
    pendingTrk.current  = [];

    try {
      await api.post(`/missions/${missionId}/flight-log`, {
        mission_id: missionId,
        events,
        track,
      }, token);
    } catch (e) {
      // Re-queue on failure
      pendingRef.current  = [...events, ...pendingRef.current];
      pendingTrk.current  = [...track,  ...pendingTrk.current];
    }
  }, [missionId, token]);

  // ── Lifecycle ─────────────────────────────────────────────────

  const start = useCallback(() => {
    activeRef.current  = true;
    startTimeRef.current = Date.now();
    eventsRef.current    = [];
    trackRef.current     = [];
    pendingRef.current   = [];
    pendingTrk.current   = [];
    logEvent("MISSION_START", { mission_id: missionId });
    // Auto-flush every 5s
    flushTimerRef.current = setInterval(() => flush(), 5000);
  }, [missionId, logEvent, flush]);

  const stop = useCallback(async () => {
    activeRef.current = false;
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    logEvent("MISSION_COMPLETE", { duration_s: getElapsed() });
    await flush(true);   // Final flush
  }, [logEvent, getElapsed, flush]);

  useEffect(() => () => {
    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
  }, []);

  // ── Full log access (for AAR) ─────────────────────────────────

  const getFullLog = useCallback(() => ({
    events:     eventsRef.current,
    track:      trackRef.current,
    duration_s: getElapsed(),
  }), [getElapsed]);

  return {
    logEvent,
    logTrack,
    flush,
    start,
    stop,
    getFullLog,
    elapsed: getElapsed,
  };
}
