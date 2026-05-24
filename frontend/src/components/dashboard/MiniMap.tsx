"use client";
import { useEffect, useRef } from "react";
import { useTelemetryStore } from "@/lib/store/telemetry.store";

const STATUS_COLORS: Record<string, string> = {
  ONLINE: "#06B6D4", IN_MISSION: "#10B981", OFFLINE: "#334155", LOST: "#EF4444",
};

export function MiniMap() {
  const mapRef     = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const snapshots  = useTelemetryStore((s) => s.snapshots);
  const lastTick   = useTelemetryStore((s) => s.lastTick);

  useEffect(() => {
    if (typeof window === "undefined" || leafletMap.current || !mapRef.current) return;
    import("leaflet").then((leaflet) => {
      const L = leaflet.default;
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      if (!mapRef.current) return;
      const map = L.map(mapRef.current, { center: [48.3794, 31.1656], zoom: 9, zoomControl: false, attributionControl: false });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
      leafletMap.current = map;
      (leafletMap as any).L = L;
    });
    return () => { leafletMap.current?.remove(); leafletMap.current = null; };
  }, []);

  useEffect(() => {
    const map = leafletMap.current;
    const L   = (leafletMap as any).L;
    if (!map || !L) return;
    snapshots.forEach((snap) => {
      if (snap.lat == null || snap.lon == null) return;
      const color = STATUS_COLORS[snap.status] ?? STATUS_COLORS.OFFLINE;
      const icon  = L.divIcon({
        html: `<div style="width:10px;height:10px;background:${color};border:1.5px solid rgba(255,255,255,0.4);border-radius:50%;box-shadow:0 0 6px ${color}88"></div><div style="font-family:monospace;font-size:9px;color:${color};white-space:nowrap;margin-top:2px;text-shadow:0 0 4px #000">${snap.callsign}</div>`,
        className: "", iconSize: [40, 24], iconAnchor: [5, 5],
      });
      if (markersRef.current.has(snap.uav_id)) {
        const m = markersRef.current.get(snap.uav_id);
        m.setLatLng([snap.lat, snap.lon]);
        m.setIcon(icon);
      } else {
        const m = L.marker([snap.lat, snap.lon], { icon })
          .addTo(map)
          .bindTooltip(`<div style="font-family:monospace;font-size:10px"><b>${snap.callsign}</b><br/>Alt: ${snap.altitude_m?.toFixed(0)}m<br/>Spd: ${snap.speed_ms?.toFixed(1)}m/s<br/>Bat: ${snap.battery_pct?.toFixed(0)}%</div>`);
        markersRef.current.set(snap.uav_id, m);
      }
    });
  }, [lastTick]);

  return (
    <div className="relative w-full h-full rounded overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute top-2 left-2 z-[1000] pointer-events-none">
        <span className="font-mono text-2xs text-cyan-DEFAULT bg-bg-base/80 px-1.5 py-0.5 rounded">TACTICAL MAP</span>
      </div>
      <div className="absolute bottom-2 right-2 z-[1000] pointer-events-none">
        <span className="font-mono text-2xs text-text-dim bg-bg-base/80 px-1.5 py-0.5 rounded">{snapshots.size} active</span>
      </div>
    </div>
  );
}
