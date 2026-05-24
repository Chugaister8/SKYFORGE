"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { clsx } from "clsx";
import { Play, Square, RotateCcw, Wind } from "lucide-react";
import type { SimControl } from "@/lib/hooks/useSimulator";

interface Props {
  running:boolean;onStart:()=>void;onStop:()=>void;onReset:()=>void;
  onControl:(ctrl:Partial<SimControl>)=>void;
  onWind:(w:{speed:number;dir:number;turb:number})=>void;
}

export function ControlPanel({running,onStart,onStop,onReset,onControl,onWind}:Props){
  const [throttle,setThrottle]=useState(0);
  const [windSpeed,setWindSpeed]=useState(0);
  const [windDir,setWindDir]=useState(0);
  const [turb,setTurb]=useState(0);
  const keysRef=useRef<Set<string>>(new Set());
  const frameRef=useRef<number>(0);
  const throttleRef=useRef(0);

  useEffect(()=>{throttleRef.current=throttle;},[throttle]);

  const processKeys=useCallback(()=>{
    const k=keysRef.current;
    const roll=k.has("ArrowRight")?0.6:k.has("ArrowLeft")?-0.6:0;
    const pitch=k.has("ArrowDown")?0.5:k.has("ArrowUp")?-0.5:0;
    const yaw=k.has("KeyE")?0.4:k.has("KeyQ")?-0.4:0;
    if(k.has("KeyW")) setThrottle(t=>{const n=Math.min(1,t+0.01);throttleRef.current=n;return n;});
    if(k.has("KeyS")) setThrottle(t=>{const n=Math.max(0,t-0.01);throttleRef.current=n;return n;});
    onControl({roll_cmd:roll,pitch_cmd:pitch,yaw_cmd:yaw,throttle_cmd:throttleRef.current});
    frameRef.current=requestAnimationFrame(processKeys);
  },[onControl]);

  useEffect(()=>{
    if(running){frameRef.current=requestAnimationFrame(processKeys);}
    else{cancelAnimationFrame(frameRef.current);}
    return()=>cancelAnimationFrame(frameRef.current);
  },[running,processKeys]);

  useEffect(()=>{
    const dn=(e:KeyboardEvent)=>keysRef.current.add(e.code);
    const up=(e:KeyboardEvent)=>keysRef.current.delete(e.code);
    window.addEventListener("keydown",dn);window.addEventListener("keyup",up);
    return()=>{window.removeEventListener("keydown",dn);window.removeEventListener("keyup",up);};
  },[]);

  useEffect(()=>{onWind({speed:windSpeed,dir:windDir,turb});},[windSpeed,windDir,turb,onWind]);

  return(
    <div className="space-y-4">
      <div className="flex gap-2">
        {!running?(
          <button onClick={onStart} className="flex-1 flex items-center justify-center gap-2 py-2 rounded border border-threat-low bg-threat-low/10 text-threat-low font-mono text-xs tracking-widest hover:bg-threat-low/20 transition-all">
            <Play className="w-3.5 h-3.5" strokeWidth={1.5}/>START SIM
          </button>
        ):(
          <button onClick={onStop} className="flex-1 flex items-center justify-center gap-2 py-2 rounded border border-threat-high bg-threat-high/10 text-threat-high font-mono text-xs tracking-widest hover:bg-threat-high/20 transition-all">
            <Square className="w-3.5 h-3.5" strokeWidth={1.5}/>STOP
          </button>
        )}
        <button onClick={onReset} className="px-3 py-2 rounded border border-border-dim text-text-secondary hover:text-text-primary font-mono text-xs transition-all">
          <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5}/>
        </button>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-2xs text-text-dim">THROTTLE</span>
          <span className="font-mono text-2xs text-text-primary tabular-nums">{(throttle*100).toFixed(0)}%</span>
        </div>
        <input type="range" min={0} max={100} value={throttle*100}
          onChange={e=>{const v=Number(e.target.value)/100;setThrottle(v);throttleRef.current=v;onControl({throttle_cmd:v});}}
          className="w-full accent-cyan-500"/>
      </div>
      <div className="bg-bg-base rounded p-3 space-y-1.5">
        <p className="font-mono text-2xs text-text-secondary tracking-widest mb-2">KEYBOARD</p>
        {[["W / S","Throttle ↑ ↓"],["↑ ↓","Pitch"],["← →","Roll"],["Q / E","Yaw"]].map(([k,a])=>(
          <div key={k} className="flex items-center justify-between">
            <span className="font-mono text-2xs text-text-dim">{a}</span>
            <span className="font-mono text-2xs text-cyan-DEFAULT bg-bg-raised border border-border-dim rounded px-1.5 py-0.5">{k}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-border-dim pt-3">
        <div className="flex items-center gap-1.5 mb-3">
          <Wind className="w-3 h-3 text-text-secondary" strokeWidth={1.5}/>
          <span className="font-mono text-2xs text-text-secondary tracking-widest">ENVIRONMENT</span>
        </div>
        <div className="space-y-2">
          {[
            {label:"WIND",val:windSpeed,set:setWindSpeed,min:0,max:20,suffix:"m/s"},
            {label:"DIRECTION",val:windDir,set:setWindDir,min:0,max:360,suffix:"°"},
          ].map(({label,val,set,min,max,suffix})=>(
            <div key={label}>
              <div className="flex justify-between mb-1">
                <span className="font-mono text-2xs text-text-dim">{label}</span>
                <span className="font-mono text-2xs text-text-secondary">{val}{suffix}</span>
              </div>
              <input type="range" min={min} max={max} value={val}
                onChange={e=>set(Number(e.target.value))} className="w-full accent-cyan-500"/>
            </div>
          ))}
          <div>
            <div className="flex justify-between mb-1">
              <span className="font-mono text-2xs text-text-dim">TURBULENCE</span>
              <span className="font-mono text-2xs text-text-secondary">{(turb*100).toFixed(0)}%</span>
            </div>
            <input type="range" min={0} max={100} value={turb*100}
              onChange={e=>setTurb(Number(e.target.value)/100)} className="w-full accent-cyan-500"/>
          </div>
        </div>
      </div>
    </div>
  );
}
