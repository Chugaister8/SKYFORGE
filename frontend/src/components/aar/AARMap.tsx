"use client";
import { useEffect, useRef } from "react";
import type { FlightRecord, AAREvent } from "@/lib/hooks/useAAR";

interface Props{track:FlightRecord[];events:AAREvent[];current:number;}
const EW_CLR:Record<string,string>={NONE:"#06B6D4",DEGRADED:"#F59E0B",DENIED:"#EF4444"};

export function AARMap({track,events,current}:Props){
  const mountRef=useRef<HTMLDivElement>(null);
  const mapRef=useRef<any>(null); const LRef=useRef<any>(null);
  const uavRef=useRef<any>(null); const segRef=useRef<any[]>([]);

  useEffect(()=>{
    if(typeof window==="undefined"||mapRef.current||!mountRef.current||!track.length) return;
    import("leaflet").then(lf=>{
      const L=lf.default; LRef.current=L;
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      const map=L.map(mountRef.current!,{center:[track[0].lat,track[0].lon],zoom:12,zoomControl:false,attributionControl:false});
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:19,subdomains:"abcd"}).addTo(map);
      L.polyline(track.map(p=>[p.lat,p.lon]),{color:"#1E2D47",weight:2,opacity:0.6}).addTo(map);
      const icon=L.divIcon({html:`<div style="width:10px;height:10px;background:#06B6D4;border:2px solid rgba(255,255,255,0.5);border-radius:50%;box-shadow:0 0 6px #06B6D488;"></div>`,className:"",iconSize:[10,10],iconAnchor:[5,5]});
      uavRef.current=L.marker([track[0].lat,track[0].lon],{icon}).addTo(map);
      events.forEach(ev=>{
        if(!ev.lat||!ev.lon) return;
        const ei=L.divIcon({html:`<div style="width:8px;height:8px;background:${ev.severity==="danger"?"#EF4444":ev.severity==="warning"?"#F59E0B":"#10B981"};border-radius:50%;border:1px solid rgba(255,255,255,0.3);"></div>`,className:"",iconSize:[8,8],iconAnchor:[4,4]});
        L.marker([ev.lat,ev.lon],{icon:ei}).addTo(map);
      });
      mapRef.current=map;
    });
    return()=>{mapRef.current?.remove();mapRef.current=null;};
  },[track.length]);

  useEffect(()=>{
    const map=mapRef.current; const L=LRef.current;
    if(!map||!L||!track.length) return;
    const rec=track.reduce((b,r)=>r.time_s<=current&&(b===null||r.time_s>b.time_s)?r:b,null as FlightRecord|null);
    if(!rec||!uavRef.current) return;
    uavRef.current.setLatLng([rec.lat,rec.lon]);
    segRef.current.forEach(s=>s.remove()); segRef.current=[];
    const past=track.filter(r=>r.time_s<=current);
    for(let i=1;i<past.length;i++){
      const c=EW_CLR[past[i].ew_threat]??"#06B6D4";
      segRef.current.push(L.polyline([[past[i-1].lat,past[i-1].lon],[past[i].lat,past[i].lon]],{color:c,weight:2.5,opacity:0.9}).addTo(map));
    }
  },[current,track]);

  return(<div className="relative w-full h-full">
    <div ref={mountRef} className="w-full h-full"/>
    <div className="absolute top-2 left-2 z-[1000] pointer-events-none flex gap-2">
      {[["#06B6D4","NOMINAL"],["#F59E0B","EW DEGRADED"],["#EF4444","EW DENIED"]].map(([color,label])=>(
        <div key={label as string} className="flex items-center gap-1 bg-bg-base/80 px-2 py-0.5 rounded">
          <span style={{background:color as string}} className="w-2 h-2 rounded-full inline-block"/>
          <span className="font-mono text-2xs text-text-secondary">{label}</span>
        </div>
      ))}
    </div>
  </div>);
}
