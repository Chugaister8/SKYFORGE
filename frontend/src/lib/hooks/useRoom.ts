import { useState, useCallback, useRef, useEffect } from "react";
import { useAuthStore } from "@/lib/store/auth.store";
import { api } from "@/lib/api";

export type RoomState = "LOBBY"|"BRIEFING"|"ACTIVE"|"DEBRIEF"|"CLOSED";
export type MemberRole = "HOST"|"PILOT"|"OBSERVER"|"COMMANDER";

export interface RoomMember {
  user_id:  string;
  username: string;
  role:     MemberRole;
  ready:    boolean;
  position: {lat:number;lon:number;alt_m:number};
  status:   string;
}

export interface ChatMessage {
  user_id:  string;
  username: string;
  text:     string;
  ts:       number;
}

export interface RoomInfo {
  id:           string;
  name:         string;
  host_id:      string;
  state:        RoomState;
  mission_id:   string|null;
  member_count: number;
  max_size:     number;
  members:      RoomMember[];
}

export interface RoomSession {
  room:      RoomInfo|null;
  myId:      string;
  connected: boolean;
  chat:      ChatMessage[];
  error:     string|null;
}

const WS_BASE = typeof window !== "undefined"
  ? window.location.origin.replace(/^http/, "ws") + ""
  : "ws://localhost:8000";

export function useRoom() {
  const { accessToken: token, user } = useAuthStore();
  const [session, setSession] = useState<RoomSession>({
    room: null, myId: "", connected: false, chat: [], error: null,
  });
  const wsRef = useRef<WebSocket|null>(null);

  const send = useCallback((data: object) => {
    if(wsRef.current?.readyState === WebSocket.OPEN){
      wsRef.current.send(JSON.stringify(data));
    }
  },[]);

  const connectToRoom = useCallback((roomId: string) => {
    if(!token) return;
    if(wsRef.current){ wsRef.current.close(); }

    const ws = new WebSocket(`${WS_BASE}/api/rooms/${roomId}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setSession(s=>({...s,connected:true,error:null}));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        setSession(s=>{
          switch(msg.type){
            case "ROOM_JOINED":
              return {...s, room: msg.room, myId: msg.your_id, chat: msg.chat_log??[]};
            case "MEMBER_JOINED":
            case "MEMBER_LEFT":
            case "READY_UPDATE":
            case "ROLE_CHANGED":
            case "ROOM_STATE":
            case "MISSION_STARTED":
              return {...s, room: msg.room ?? s.room};
            case "POSITION_UPDATE":
              if(!s.room) return s;
              return {...s, room: {...s.room, members: s.room.members.map(m=>
                m.user_id===msg.user_id ? {...m,position:msg.position} : m
              )}};
            case "CHAT":
              return {...s, chat: [...s.chat, {user_id:msg.user_id,username:msg.username,text:msg.text,ts:msg.ts}].slice(-200)};
            case "ERROR":
              return {...s, error: msg.msg};
            default:
              return s;
          }
        });
      } catch {}
    };

    ws.onclose = () => {
      setSession(s=>({...s,connected:false}));
    };

    ws.onerror = () => {
      setSession(s=>({...s,error:"Connection error",connected:false}));
    };
  },[token]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setSession({room:null,myId:"",connected:false,chat:[],error:null});
  },[]);

  // API helpers
  const createRoom = useCallback(async(name:string,missionId?:string): Promise<string|null> => {
    if(!token) return null;
    try {
      const res = await api.post<{room_id:string}>("/rooms/", {name,mission_id:missionId??null}, token);
      return res.room_id;
    } catch { return null; }
  },[token]);

  const fetchRooms = useCallback(async(): Promise<RoomInfo[]> => {
    if(!token) return [];
    try {
      const res = await api.get<{rooms:RoomInfo[]}>("/rooms/", token);
      return res.rooms;
    } catch { return []; }
  },[token]);

  // Room actions via WS
  const sendChat     = useCallback((text:string)=>send({type:"CHAT",text}),[send]);
  const sendReady    = useCallback((ready:boolean)=>send({type:"READY",ready}),[send]);
  const sendPosition = useCallback((pos:{lat:number;lon:number;alt_m:number})=>send({type:"POSITION",position:pos}),[send]);
  const startMission = useCallback(()=>send({type:"START_MISSION"}),[send]);
  const sendEvent    = useCallback((event:object)=>send({type:"MISSION_EVENT",event}),[send]);

  useEffect(()=>()=>{ wsRef.current?.close(); },[]);

  const myMember = session.room?.members.find(m=>m.user_id===session.myId)??null;
  const isHost   = myMember?.role === "HOST";

  return {
    session, myMember, isHost,
    connectToRoom, disconnect,
    createRoom, fetchRooms,
    sendChat, sendReady, sendPosition, startMission, sendEvent,
  };
}
