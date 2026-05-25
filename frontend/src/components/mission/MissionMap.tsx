"use client";
import { useEffect, useRef } from "react";
import type { Waypoint, ThreatSite } from "@/lib/hooks/useMission";

interface Props {
  waypoints:Waypoint[]; sites:ThreatSite[];
  tool:"waypoint"|"sam"|"ew"|"select"; samPreset:string;
  onAddWaypoint:(lat:number,lon:number)=>void;
  onAddSite:(lat:number,lon:number,preset:string)=>void;
}

const RISK_COLORS:Record<string,string>={SAFE:"#10B981",LOW:"#22D3EE",MEDIUM:"#F59E0B",HIGH:"#EF4444",CRITICAL:"#8B5CF6"};
const SAM_RANGES:Record<string,{search:number;missile:number}>={
  "tor-m1":{search:25,missile:12},"buk-m2":{search:160,missile:45},
  "zu-23-2":{search:2.5,missile:2.5},"manpads":{search:6,missile:6},
};

export function MissionMap({waypoints,sites,tool,samPreset,onAddWaypoint,onAddSite}:Props){
  const mountRef=useRef<HTMLDivElement>(null);
  const mapRef=useRef<any>(null);
  const markersRef=useRef<Map<string,any>>(new Map());
  const circlesRef=useRef<Map<string,any[]>>(new Map());
  const routeRef=useRef<any>(null);
  const LRef=useRef<any>(null);

  // Refs to avoid stale closures in click handler
  const toolRef=useRef(tool);
  const presetRef=useRef(samPreset);
  const onAddWpRef=useRef(onAddWaypoint);
  const onAddSiteRef=useRef(onAddSite);

  useEffect(()=>{ toolRef.current=tool; }, [tool]);
  useEffect(()=>{ presetRef.current=samPreset; }, [samPreset]);
  useEffect(()=>{ onAddWpRef.current=onAddWaypoint; }, [onAddWaypoint]);
  useEffect(()=>{ onAddSiteRef.current=onAddSite; }, [onAddSite]);

  // Init map once
  useEffect(()=>{
    if(typeof window==="undefined"||mapRef.current||!mountRef.current) return;
    import("leaflet").then(lf=>{
      const L=lf.default; LRef.current=L;
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      const map=L.map(mountRef.current!,{center:[48.4,31.2],zoom:9,zoomControl:true,attributionControl:false});
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:19,subdomains:"abcd"}).addTo(map);
      // Single click handler using refs - always current values
      map.on("click",(e:any)=>{
        const{lat,lng}=e.latlng;
        if(toolRef.current==="waypoint") onAddWpRef.current(lat,lng);
        else if(toolRef.current==="sam") onAddSiteRef.current(lat,lng,presetRef.current);
      });
      mapRef.current=map;
    });
    return()=>{mapRef.current?.remove();mapRef.current=null;};
  },[]);

  // Render waypoints + route
  useEffect(()=>{
    const map=mapRef.current; const L=LRef.current;
    if(!map||!L) return;
    markersRef.current.forEach((m,k)=>{if(k.startsWith("wp_")){m.remove();markersRef.current.delete(k);}});
    if(routeRef.current){routeRef.current.remove();routeRef.current=null;}
    if(waypoints.length>1){
      routeRef.current=L.polyline(waypoints.map(wp=>[wp.lat,wp.lon]),{color:"#06B6D4",weight:2,dashArray:"6 4",opacity:0.8}).addTo(map);
    }
    waypoints.forEach((wp,idx)=>{
      const color=RISK_COLORS[wp.risk]??"#06B6D4";
      const icon=L.divIcon({
        html:`<div style="width:22px;height:22px;background:${color};border:2px solid rgba(255,255,255,0.5);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:9px;color:#fff;font-weight:600;box-shadow:0 0 8px ${color}88;">${idx+1}</div>`,
        className:"",iconSize:[22,22],iconAnchor:[11,11],
      });
      markersRef.current.set(wp.id,L.marker([wp.lat,wp.lon],{icon}).addTo(map)
        .bindTooltip(`<div style="font-family:monospace;font-size:10px;color:#e2e8f0"><b>WP${idx+1}</b> — ${wp.action}<br/>Alt: ${wp.alt_m}m | Spd: ${wp.speed_ms}m/s<br/>Risk: <span style="color:${color}">${wp.risk}</span>${wp.max_pk>0?` | P(k): ${(wp.max_pk*100).toFixed(0)}%`:""}</div>`));
    });
  },[waypoints]);

  // Render SAM sites
  useEffect(()=>{
    const map=mapRef.current; const L=LRef.current;
    if(!map||!L) return;
    markersRef.current.forEach((m,k)=>{if(k.startsWith("site_")){m.remove();markersRef.current.delete(k);}});
    circlesRef.current.forEach(cs=>cs.forEach(c=>c.remove())); circlesRef.current.clear();
    sites.forEach(site=>{
      const ranges=SAM_RANGES[site.preset]??{search:10,missile:5};
      const sc=L.circle([site.lat,site.lon],{radius:ranges.search*1000,color:"#EF4444",fillColor:"#EF4444",fillOpacity:0.04,weight:1,dashArray:"4 4",opacity:0.4}).addTo(map);
      const mc=L.circle([site.lat,site.lon],{radius:ranges.missile*1000,color:"#EF4444",fillColor:"#EF4444",fillOpacity:0.08,weight:1.5,opacity:0.7}).addTo(map);
      circlesRef.current.set(site.id,[sc,mc]);
      const icon=L.divIcon({
        html:`<div style="width:16px;height:16px;background:#EF4444;transform:rotate(45deg);border:2px solid rgba(255,255,255,0.4);box-shadow:0 0 8px #EF444488;"></div><div style="font-family:monospace;font-size:8px;color:#EF4444;white-space:nowrap;margin-top:3px;text-align:center;">${site.preset.toUpperCase()}</div>`,
        className:"",iconSize:[40,28],iconAnchor:[20,8],
      });
      markersRef.current.set(site.id,L.marker([site.lat,site.lon],{icon}).addTo(map)
        .bindTooltip(`<div style="font-family:monospace;font-size:10px;color:#e2e8f0"><b>${site.name}</b><br/>Search: ${ranges.search}km | Missile: ${ranges.missile}km</div>`));
    });
  },[sites]);

  return(
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full"/>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
        {tool==="waypoint"&&<span className="font-mono text-2xs text-cyan-DEFAULT bg-bg-base/90 px-3 py-1 rounded border border-border-active">Click map to add waypoint</span>}
        {tool==="sam"&&<span className="font-mono text-2xs text-threat-high bg-bg-base/90 px-3 py-1 rounded border border-threat-high/40">Click to place {samPreset.toUpperCase()}</span>}
      </div>
    </div>
  );
}
