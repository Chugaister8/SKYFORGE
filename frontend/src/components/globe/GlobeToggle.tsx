"use client";
import { useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { clsx } from "clsx";
import { Globe, Map } from "lucide-react";
import type { Waypoint, ThreatSite } from "@/lib/hooks/useMission";
import { MissionMap } from "@/components/mission/MissionMap";

// Lazy load Cesium to avoid SSR crash
const CesiumGlobe = dynamic(
  () => import("./CesiumGlobe").then(m => ({ default: m.CesiumGlobe })),
  { ssr: false, loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-bg-base">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-cyan-DEFAULT border-t-transparent rounded-full animate-spin mx-auto"/>
        <p className="font-mono text-xs text-text-secondary">Loading 3D Globe…</p>
      </div>
    </div>
  )},
);

interface Props {
  waypoints:    Waypoint[];
  sites:        ThreatSite[];
  tool:         "waypoint"|"sam"|"ew"|"select";
  samPreset:    string;
  onAddWaypoint:(lat:number,lon:number)=>void;
  onAddSite:    (lat:number,lon:number,preset:string)=>void;
  uavPosition?: {lat:number;lon:number;alt_m:number};
}

export function GlobeToggle({ waypoints, sites, tool, samPreset, onAddWaypoint, onAddSite, uavPosition }: Props) {
  const [use3D, setUse3D] = useState(false);

  const handleGlobeClick = (lat: number, lon: number) => {
    if(tool === "waypoint")  onAddWaypoint(lat, lon);
    else if(tool === "sam")  onAddSite(lat, lon, samPreset);
  };

  return (
    <div className="relative w-full h-full">
      {use3D ? (
        <CesiumGlobe
          waypoints={waypoints} sites={sites}
          uavPosition={uavPosition}
          mode="mission"
          onMapClick={handleGlobeClick}
        />
      ) : (
        <MissionMap
          waypoints={waypoints} sites={sites}
          tool={tool} samPreset={samPreset}
          onAddWaypoint={onAddWaypoint}
          onAddSite={onAddSite}
        />
      )}

      {/* 2D/3D toggle */}
      <div className="absolute top-2 right-2 z-[1000] flex bg-bg-base/90 border border-border-dim rounded overflow-hidden">
        <button
          onClick={()=>setUse3D(false)}
          className={clsx("flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-2xs transition-all",
            !use3D?"bg-cyan-subtle text-cyan-DEFAULT":"text-text-secondary hover:text-text-primary")}
        >
          <Map className="w-3 h-3" strokeWidth={1.5}/>2D
        </button>
        <button
          onClick={()=>setUse3D(true)}
          className={clsx("flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-2xs transition-all",
            use3D?"bg-cyan-subtle text-cyan-DEFAULT":"text-text-secondary hover:text-text-primary")}
        >
          <Globe className="w-3 h-3" strokeWidth={1.5}/>3D
        </button>
      </div>
    </div>
  );
}
