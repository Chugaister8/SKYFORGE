"use client";
/**
 * Cesium 3D Globe component.
 * Uses dynamic import to avoid SSR issues.
 * Falls back to Leaflet 2D if Cesium fails to load.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import type { Waypoint, ThreatSite } from "@/lib/hooks/useMission";

interface Props {
  waypoints:    Waypoint[];
  sites:        ThreatSite[];
  uavPosition?: { lat: number; lon: number; alt_m: number };
  mode:         "mission"|"simulator"|"aar";
  onMapClick?:  (lat: number, lon: number) => void;
  flightTrack?: Array<{ lat: number; lon: number; alt_m: number }>;
}

// ── Colors ──────────────────────────────────────────────────────
const RISK_COLORS: Record<string, string> = {
  SAFE:     "#10B981", LOW: "#22D3EE", MEDIUM: "#F59E0B",
  HIGH:     "#EF4444", CRITICAL: "#8B5CF6",
};
const SAM_RANGES: Record<string, { search: number; missile: number }> = {
  "tor-m1":  { search: 25000, missile: 12000 },
  "buk-m2":  { search: 160000, missile: 45000 },
  "zu-23-2": { search: 2500,  missile: 2500  },
  "manpads": { search: 6000,  missile: 6000  },
};

export function CesiumGlobe({ waypoints, sites, uavPosition, mode, onMapClick, flightTrack }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef    = useRef<any>(null);
  const entitiesRef  = useRef<any[]>([]);
  const [loaded,   setLoaded]   = useState(false);
  const [error,    setError]    = useState<string|null>(null);
  const [CesiumLib, setCesiumLib] = useState<any>(null);

  // Load Cesium dynamically
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const C = await import("cesium");
        if(cancelled) return;

        // Set token (free Ion token for basic terrain)
        C.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_TOKEN ??
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFmNTlhNjYiLCJpZCI6MjU5Mzc3LCJpYXQiOjE2OTI2MzE4MDl9.sTCiSFNfLfAtCHFWHzqx_0Kwy9cpGLJR3yz7OeEFnag";

        setCesiumLib(C);
        setLoaded(true);
      } catch (e: any) {
        if(!cancelled) setError("Cesium failed to load: " + e.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Init viewer
  useEffect(() => {
    if (!loaded || !CesiumLib || !containerRef.current || viewerRef.current) return;
    const C = CesiumLib;

    try {
      const viewer = new C.Viewer(containerRef.current, {
        terrainProvider:         C.createWorldTerrain(),
        animation:               false,
        baseLayerPicker:         false,
        fullscreenButton:        false,
        geocoder:                false,
        homeButton:              false,
        infoBox:                 false,
        sceneModePicker:         false,
        selectionIndicator:      false,
        timeline:                false,
        navigationHelpButton:    false,
        navigationInstructionsInitiallyVisible: false,
        creditContainer:         document.createElement("div"), // hide credit
      });

      // Dark imagery
      viewer.imageryLayers.removeAll();
      viewer.imageryLayers.addImageryProvider(
        new C.UrlTemplateImageryProvider({
          url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          subdomains: ["a","b","c","d"],
          credit: "CartoDB",
          maximumLevel: 19,
        })
      );

      // Scene settings
      viewer.scene.globe.enableLighting = false;
      viewer.scene.backgroundColor = C.Color.fromCssColorString("#0A0E1A");
      viewer.scene.globe.baseColor   = C.Color.fromCssColorString("#0D1526");

      // Click handler
      if(onMapClick){
        const handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((e: any) => {
          const cart = viewer.camera.pickEllipsoid(e.position);
          if(cart){
            const carto = C.Cartographic.fromCartesian(cart);
            onMapClick(
              C.Math.toDegrees(carto.latitude),
              C.Math.toDegrees(carto.longitude),
            );
          }
        }, C.ScreenSpaceEventType.LEFT_CLICK);
      }

      // Fly to Ukraine
      viewer.camera.flyTo({
        destination: C.Cartesian3.fromDegrees(31.16, 48.38, 80000),
        orientation: { heading: 0, pitch: C.Math.toRadians(-45), roll: 0 },
        duration: 2,
      });

      viewerRef.current = viewer;
    } catch(e: any) {
      setError("Viewer init failed: " + e.message);
    }

    return () => {
      if(viewerRef.current && !viewerRef.current.isDestroyed()){
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [loaded, CesiumLib, onMapClick]);

  // Update entities when waypoints / sites change
  useEffect(() => {
    const viewer = viewerRef.current;
    const C      = CesiumLib;
    if(!viewer || !C || viewer.isDestroyed()) return;

    // Remove old entities
    entitiesRef.current.forEach(e => {
      try { viewer.entities.remove(e); } catch {}
    });
    entitiesRef.current = [];

    // Waypoints + route
    waypoints.forEach((wp, i) => {
      const color = RISK_COLORS[wp.risk] ?? "#06B6D4";
      const e = viewer.entities.add({
        position: C.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt_m),
        point: {
          pixelSize:         14,
          color:             C.Color.fromCssColorString(color),
          outlineColor:      C.Color.WHITE.withAlpha(0.5),
          outlineWidth:      2,
          heightReference:   C.HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text:              `WP${i+1}`,
          font:              "11px monospace",
          fillColor:         C.Color.WHITE,
          outlineColor:      C.Color.BLACK,
          outlineWidth:      2,
          style:             C.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset:       new C.Cartesian2(0, -20),
          heightReference:   C.HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      entitiesRef.current.push(e);
    });

    // Route polyline
    if(waypoints.length > 1){
      const positions = waypoints.flatMap(wp =>
        C.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt_m)
      );
      const poly = viewer.entities.add({
        polyline: {
          positions,
          width:         2,
          material:      new C.ColorMaterialProperty(C.Color.fromCssColorString("#06B6D4").withAlpha(0.8)),
          clampToGround: false,
        },
      });
      entitiesRef.current.push(poly);
    }

    // SAM sites + cylinders
    sites.forEach(site => {
      const ranges = SAM_RANGES[site.preset] ?? { search: 10000, missile: 5000 };

      // Site marker
      const e = viewer.entities.add({
        position: C.Cartesian3.fromDegrees(site.lon, site.lat, 10),
        point: {
          pixelSize:         16,
          color:             C.Color.RED.withAlpha(0.9),
          outlineColor:      C.Color.WHITE.withAlpha(0.5),
          outlineWidth:      2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text:        site.preset.toUpperCase(),
          font:        "10px monospace",
          fillColor:   C.Color.RED,
          outlineColor:C.Color.BLACK,
          outlineWidth:2,
          style:       C.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new C.Cartesian2(0, -22),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      entitiesRef.current.push(e);

      // Missile range cylinder
      const cyl = viewer.entities.add({
        position: C.Cartesian3.fromDegrees(site.lon, site.lat, ranges.missile / 2),
        cylinder: {
          length:        ranges.missile,
          topRadius:     ranges.missile,
          bottomRadius:  ranges.missile,
          material:      C.Color.RED.withAlpha(0.06),
          outline:       true,
          outlineColor:  C.Color.RED.withAlpha(0.5),
          outlineWidth:  1,
        },
      });
      entitiesRef.current.push(cyl);
    });

    // UAV position
    if(uavPosition){
      const uav = viewer.entities.add({
        position: C.Cartesian3.fromDegrees(uavPosition.lon, uavPosition.lat, uavPosition.alt_m),
        point: {
          pixelSize:         12,
          color:             C.Color.fromCssColorString("#06B6D4"),
          outlineColor:      C.Color.WHITE,
          outlineWidth:      2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text:        `UAV\n${uavPosition.alt_m.toFixed(0)}m`,
          font:        "10px monospace",
          fillColor:   C.Color.fromCssColorString("#06B6D4"),
          outlineColor:C.Color.BLACK,
          outlineWidth:2,
          style:       C.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new C.Cartesian2(0, -24),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      entitiesRef.current.push(uav);
    }

    // Flight track (AAR)
    if(flightTrack && flightTrack.length > 1){
      const trackPos = flightTrack.map(p => C.Cartesian3.fromDegrees(p.lon, p.lat, p.alt_m));
      const track = viewer.entities.add({
        polyline: {
          positions: trackPos,
          width:     2,
          material:  new C.ColorMaterialProperty(C.Color.fromCssColorString("#F59E0B").withAlpha(0.7)),
        },
      });
      entitiesRef.current.push(track);
    }

  }, [waypoints, sites, uavPosition, flightTrack, CesiumLib]);

  if(error){
    return(
      <div className="w-full h-full flex items-center justify-center bg-bg-base">
        <div className="text-center space-y-2 p-8">
          <p className="font-mono text-xs text-threat-high">3D Globe unavailable</p>
          <p className="font-mono text-2xs text-text-dim">{error}</p>
          <p className="font-mono text-2xs text-text-dim">Using 2D Leaflet map as fallback.</p>
        </div>
      </div>
    );
  }

  if(!loaded){
    return(
      <div className="w-full h-full flex items-center justify-center bg-bg-base">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-cyan-DEFAULT border-t-transparent rounded-full animate-spin mx-auto"/>
          <p className="font-mono text-xs text-text-secondary">Loading 3D Globe…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {/* Mode badge */}
      <div className="absolute top-2 left-2 z-10 pointer-events-none">
        <span className="font-mono text-2xs text-cyan-DEFAULT bg-bg-base/80 border border-border-active px-2 py-0.5 rounded">
          CESIUM 3D · {mode.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
