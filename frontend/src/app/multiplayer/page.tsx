"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRoom, RoomInfo } from "@/lib/hooks/useRoom";
import { useAuthStore } from "@/lib/store/auth.store";
import { useTelemetryStore } from "@/lib/store/telemetry.store";
import { clsx } from "clsx";
import {
  Users, Plus, Radio, Send, LogIn, LogOut,
  Crown, Eye, Crosshair, Shield, CheckCircle,
  Circle, MapPin, Loader2, Wifi, WifiOff,
} from "lucide-react";

const ROLE_ICONS:Record<string,any>={HOST:Crown,PILOT:Crosshair,OBSERVER:Eye,COMMANDER:Shield};
const ROLE_CLR:Record<string,string>={HOST:"text-threat-medium",PILOT:"text-cyan-DEFAULT",OBSERVER:"text-text-secondary",COMMANDER:"text-purple-400"};
const STATE_CLR:Record<string,string>={LOBBY:"text-text-secondary",BRIEFING:"text-threat-medium",ACTIVE:"text-threat-low",DEBRIEF:"text-cyan-DEFAULT"};


// ── Tactical map for multiplayer room ────────────────────────────
function MultiplayerMap({ members, myId, roomState }: {
  members: any[]; myId: string; roomState: string;
}) {
  const mapRef     = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersRef = useRef<Map<string,any>>(new Map());

  useEffect(() => {
    if (typeof window==="undefined"||leafletMap.current||!mapRef.current) return;
    import("leaflet").then(L => {
      const Lx = L.default;
      delete (Lx.Icon.Default.prototype as any)._getIconUrl;
      const map = Lx.map(mapRef.current!, {
        center:[48.3794,31.1656], zoom:10,
        zoomControl:true, attributionControl:false,
      });
      Lx.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:19}).addTo(map);
      leafletMap.current = map;
      (leafletMap as any).L = Lx;
    });
    return () => { leafletMap.current?.remove(); leafletMap.current=null; };
  },[]);

  useEffect(() => {
    const map = leafletMap.current;
    const Lx  = (leafletMap as any).L;
    if (!map||!Lx) return;
    members.filter(m=>m.position?.lat!=null).forEach(m => {
      const isMe = m.user_id===myId;
      const color = isMe ? "#06B6D4" :
        m.role==="HOST" ? "#F59E0B" :
        m.role==="COMMANDER" ? "#A78BFA" : "#10B981";
      const icon = Lx.divIcon({
        html: `<div style="width:10px;height:10px;background:${color};border:2px solid rgba(255,255,255,0.5);border-radius:50%;box-shadow:0 0 8px ${color}88"></div><div style="font-family:monospace;font-size:9px;color:${color};margin-top:2px;white-space:nowrap">${m.username}</div>`,
        className:"", iconSize:[60,24], iconAnchor:[5,5],
      });
      if (markersRef.current.has(m.user_id)) {
        const mk = markersRef.current.get(m.user_id);
        mk.setLatLng([m.position.lat,m.position.lon]);
        mk.setIcon(icon);
      } else {
        const mk = Lx.marker([m.position.lat,m.position.lon],{icon})
          .addTo(map)
          .bindTooltip(`<span style="font-family:monospace;font-size:10px">${m.username} · ${m.role}<br/>Alt: ${m.position.alt_m?.toFixed(0)}m</span>`);
        markersRef.current.set(m.user_id,mk);
      }
    });
    // Remove stale markers
    const activeIds = new Set(members.map(m=>m.user_id));
    markersRef.current.forEach((_,uid) => {
      if (!activeIds.has(uid)) {
        markersRef.current.get(uid)?.remove();
        markersRef.current.delete(uid);
      }
    });
  },[members]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full"/>
      <div className="absolute top-2 left-2 z-[1000] pointer-events-none flex items-center gap-1.5">
        <span className="font-mono text-2xs text-cyan-DEFAULT bg-bg-base/80 px-1.5 py-0.5 rounded">
          TACTICAL · {roomState}
        </span>
        <span className="font-mono text-2xs text-text-dim bg-bg-base/80 px-1.5 py-0.5 rounded">
          {members.length} connected
        </span>
      </div>
    </div>
  );
}

export default function MultiplayerPage(){
  const{user}=useAuthStore();
  const{session,myMember,isHost,connectToRoom,disconnect,createRoom,fetchRooms,sendChat,sendReady,sendPosition,startMission}=useRoom();
  const[rooms,setRooms]=useState<RoomInfo[]>([]);
  const[roomsLoading,setRoomsLoading]=useState(false);
  const[newRoomName,setNewRoomName]=useState("");
  const[chatInput,setChatInput]=useState("");
  const[creating,setCreating]=useState(false);
  const[joining,setJoining]=useState(false);
  const chatEndRef=useRef<HTMLDivElement>(null);

  const snapshots=useTelemetryStore(s=>s.snapshots);

  // Auto-broadcast our UAV position to room members every 2s
  useEffect(()=>{
    if(!session.connected) return;
    const mySnap=Array.from(snapshots.values()).find(s=>s.status==="IN_MISSION"||s.status==="ONLINE");
    if(!mySnap||mySnap.lat==null||mySnap.lon==null) return;
    // auto-broadcast
    sendPosition({lat:mySnap.lat,lon:mySnap.lon,alt_m:mySnap.altitude_m??150});
  },[snapshots,session.connected]); // eslint-disable-line

  useEffect(()=>{
    chatEndRef.current?.scrollIntoView({behavior:"smooth"});
  },[session.chat]);

  const loadRooms=async()=>{
    setRoomsLoading(true);
    const r=await fetchRooms();
    setRooms(r); setRoomsLoading(false);
  };
  useEffect(()=>{ loadRooms(); },[]);

  const handleCreate=async()=>{
    if(!newRoomName.trim()) return;
    setCreating(true);
    const id=await createRoom(newRoomName.trim());
    if(id){ connectToRoom(id); setNewRoomName(""); }
    setCreating(false);
  };

  const handleJoin=(roomId:string)=>{
    setJoining(true);
    connectToRoom(roomId);
    setTimeout(()=>setJoining(false),1500);
  };

  const handleChat=(e:React.FormEvent)=>{
    e.preventDefault();
    if(!chatInput.trim()) return;
    sendChat(chatInput.trim()); setChatInput("");
  };

  if(session.room){
    const room=session.room;
    const allReady=room.members.length>1&&room.members.every(m=>m.ready||m.role==="HOST");

    return(
      <div className="flex h-full overflow-hidden">
        {/* Left — room info + members */}
        <div className="w-64 shrink-0 flex flex-col border-r border-border-dim bg-bg-surface overflow-hidden">
          <div className="p-3 border-b border-border-dim">
            <div className="flex items-center gap-2 mb-1">
              <span className={clsx("font-mono text-2xs font-medium",STATE_CLR[room.state])}>● {room.state}</span>
              {session.connected
                ?<Wifi className="w-3 h-3 text-threat-low ml-auto" strokeWidth={1.5}/>
                :<WifiOff className="w-3 h-3 text-threat-high ml-auto" strokeWidth={1.5}/>}
            </div>
            <p className="font-mono text-sm text-text-primary font-medium">{room.name}</p>
            <p className="font-mono text-2xs text-text-dim">Room {room.id} · {room.member_count}/{room.max_size}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <p className="font-mono text-2xs text-text-secondary tracking-widest px-1 mb-2">OPERATORS</p>
            {room.members.map(m=>{
              const Icon=ROLE_ICONS[m.role]??Circle;
              const clrRole=ROLE_CLR[m.role]??"text-text-secondary";
              const isMe=m.user_id===session.myId;
              return(
                <div key={m.user_id} className={clsx(
                  "flex items-center gap-2 px-2 py-2 rounded mb-0.5",
                  isMe?"bg-cyan-subtle border border-border-active":"hover:bg-bg-raised",
                )}>
                  <Icon className={clsx("w-3.5 h-3.5 shrink-0",clrRole)} strokeWidth={1.5}/>
                  <div className="flex-1 min-w-0">
                    <p className={clsx("font-mono text-xs truncate",isMe?"text-cyan-DEFAULT":"text-text-primary")}>
                      {m.username}{isMe&&" (you)"}
                    </p>
                    <p className={clsx("font-mono text-2xs",clrRole)}>{m.role}</p>
                  </div>
                  {m.ready
                    ?<CheckCircle className="w-3 h-3 text-threat-low shrink-0" strokeWidth={1.5}/>
                    :<Circle className="w-3 h-3 text-border-dim shrink-0" strokeWidth={1.5}/>}
                </div>
              );
            })}
          </div>

          <div className="p-2 border-t border-border-dim space-y-1.5">
            {room.state==="LOBBY"&&(
              <button
                onClick={()=>sendReady(!myMember?.ready)}
                className={clsx("w-full flex items-center justify-center gap-1.5 py-1.5 rounded border font-mono text-xs tracking-widest transition-all",
                  myMember?.ready
                    ?"border-threat-medium/40 bg-threat-medium/10 text-threat-medium"
                    :"border-threat-low/50 bg-threat-low/10 text-threat-low hover:bg-threat-low/20")}>
                {myMember?.ready?<><Circle className="w-3 h-3"/>UNREADY</>:<><CheckCircle className="w-3 h-3"/>READY</>}
              </button>
            )}
            {isHost&&room.state==="LOBBY"&&(
              <button onClick={startMission} disabled={!allReady&&room.members.length>1}
                className={clsx("w-full flex items-center justify-center gap-1.5 py-1.5 rounded border font-mono text-xs tracking-widest transition-all",
                  allReady||room.members.length===1
                    ?"border-border-active bg-cyan-subtle text-cyan-DEFAULT hover:shadow-cyan"
                    :"border-border-dim text-text-dim cursor-not-allowed")}>
                <Radio className="w-3 h-3"/>START MISSION
              </button>
            )}
            <button onClick={disconnect}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-border-dim text-text-secondary hover:text-threat-high hover:border-threat-high/40 font-mono text-xs tracking-widest transition-all">
              <LogOut className="w-3 h-3"/>LEAVE ROOM
            </button>
          </div>
        </div>

        {/* Center — live tactical map */}
        <div className="flex-1 flex flex-col bg-bg-base overflow-hidden">
          <MultiplayerMap members={room.members} myId={session.myId} roomState={room.state}/>
        </div>

        {/* Right — chat */}
        <div className="w-64 shrink-0 flex flex-col border-l border-border-dim bg-bg-surface overflow-hidden">
          <div className="p-3 border-b border-border-dim">
            <p className="font-mono text-2xs text-text-secondary tracking-widest">COMMS CHANNEL</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {session.chat.length===0
              ?<p className="font-mono text-2xs text-text-dim text-center py-4">No messages yet</p>
              :session.chat.map((msg,i)=>(
                <div key={i} className={clsx("px-2 py-1.5 rounded",msg.user_id===session.myId?"bg-cyan-subtle":"bg-bg-raised")}>
                  <p className={clsx("font-mono text-2xs font-medium",msg.user_id===session.myId?"text-cyan-DEFAULT":"text-text-secondary")}>
                    {msg.username}
                  </p>
                  <p className="font-mono text-2xs text-text-primary leading-relaxed">{msg.text}</p>
                </div>
              ))
            }
            <div ref={chatEndRef}/>
          </div>
          <form onSubmit={handleChat} className="p-2 border-t border-border-dim flex gap-1.5">
            <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
              placeholder="Message..." maxLength={500}
              className="flex-1 bg-bg-base border border-border-dim rounded px-2 py-1.5 font-mono text-xs text-text-primary focus:outline-none focus:border-border-active placeholder:text-text-dim"/>
            <button type="submit" disabled={!chatInput.trim()}
              className="p-1.5 rounded border border-border-dim text-text-secondary hover:text-cyan-DEFAULT hover:border-border-active transition-all disabled:opacity-40">
              <Send className="w-3.5 h-3.5" strokeWidth={1.5}/>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Lobby view
  return(
    <div className="p-5 space-y-5 max-w-4xl">
      <div>
        <p className="font-mono text-2xs text-text-secondary tracking-widest mb-0.5">MULTIPLAYER</p>
        <h1 className="font-mono text-base text-text-primary tracking-wide">Co-op Mission Rooms</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Create room */}
        <div className="bg-bg-surface border border-border-dim rounded p-4 space-y-3">
          <p className="font-mono text-2xs text-text-secondary tracking-widest">CREATE ROOM</p>
          <input value={newRoomName} onChange={e=>setNewRoomName(e.target.value)}
            placeholder="Room name (e.g. Alpha Squad)"
            onKeyDown={e=>e.key==="Enter"&&handleCreate()}
            className="w-full bg-bg-base border border-border-dim rounded px-3 py-2 font-mono text-xs text-text-primary focus:outline-none focus:border-border-active placeholder:text-text-dim"/>
          <button onClick={handleCreate} disabled={!newRoomName.trim()||creating}
            className={clsx("w-full flex items-center justify-center gap-2 py-2 rounded border font-mono text-xs tracking-widest transition-all",
              newRoomName.trim()&&!creating
                ?"border-border-active bg-cyan-subtle text-cyan-DEFAULT hover:shadow-cyan"
                :"border-border-dim text-text-dim cursor-not-allowed")}>
            {creating?<><Loader2 className="w-3.5 h-3.5 animate-spin"/>CREATING...</>:<><Plus className="w-3.5 h-3.5"/>CREATE ROOM</>}
          </button>
        </div>

        {/* Active rooms */}
        <div className="bg-bg-surface border border-border-dim rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-2xs text-text-secondary tracking-widest">ACTIVE ROOMS</p>
            <button onClick={loadRooms} disabled={roomsLoading}
              className="font-mono text-2xs text-cyan-DEFAULT hover:underline disabled:opacity-40">
              {roomsLoading?"loading...":"refresh"}
            </button>
          </div>
          {roomsLoading?(
            <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-text-dim"/></div>
          ):rooms.length===0?(
            <div className="text-center py-6">
              <Users className="w-8 h-8 text-text-dim mx-auto mb-2" strokeWidth={1}/>
              <p className="font-mono text-xs text-text-dim">No active rooms</p>
              <p className="font-mono text-2xs text-text-dim">Create one to get started</p>
            </div>
          ):(
            <div className="space-y-2">
              {rooms.map(room=>(
                <div key={room.id} className="flex items-center gap-3 p-2.5 rounded border border-border-dim hover:border-border-active bg-bg-raised transition-all">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-text-primary font-medium">{room.name}</p>
                    <p className="font-mono text-2xs text-text-dim">
                      {room.id} · {room.member_count}/{room.max_size} ops · <span className={STATE_CLR[room.state]}>{room.state}</span>
                    </p>
                  </div>
                  <button onClick={()=>handleJoin(room.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-border-active bg-cyan-subtle text-cyan-DEFAULT font-mono text-2xs tracking-widest hover:shadow-cyan-sm transition-all">
                    <LogIn className="w-3 h-3" strokeWidth={1.5}/>JOIN
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {session.error&&(
        <div className="p-3 rounded border border-threat-high/40 bg-threat-high/5">
          <p className="font-mono text-xs text-threat-high">{session.error}</p>
        </div>
      )}
    </div>
  );
}
