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
  position: { lat:number; lon:number; alt_m:number };
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
  ? window.location.origin.replace(/^http/, "ws")
  : "ws://localhost:8000";

export function useRoom() {
  const { accessToken: token } = useAuthStore();
  const [session,  setSession]  = useState<RoomSession>({
    room:null, myId:"", connected:false, chat:[], error:null,
  });
  const wsRef       = useRef<WebSocket|null>(null);
  const retriesRef  = useRef(0);
  const mountedRef  = useRef(true);
  const roomIdRef   = useRef<string|null>(null);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const connectToRoom = useCallback((roomId: string) => {
    if (!token) return;
    if (wsRef.current) { wsRef.current.close(); }
    roomIdRef.current = roomId;
    retriesRef.current = 0;

    const _connect = () => {
      if (!mountedRef.current || !token) return;
      const ws = new WebSocket(`${WS_BASE}/api/rooms/${roomId}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send token as first message — not in URL
        ws.send(JSON.stringify({ type:"auth", token }));
      };

      ws.onmessage = (e) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(e.data);
          setSession(s => {
            switch (msg.type) {
              case "ROOM_JOINED":
                return { ...s, room:msg.room, myId:msg.your_id, chat:msg.chat_log??[], connected:true, error:null };
              case "MEMBER_JOINED":
              case "MEMBER_LEFT":
              case "READY_UPDATE":
              case "ROLE_CHANGED":
              case "ROOM_STATE":
              case "MISSION_STARTED":
                return { ...s, room:msg.room ?? s.room };
              case "POSITION_UPDATE":
                if (!s.room) return s;
                return { ...s, room: { ...s.room, members: s.room.members.map(m =>
                  m.user_id===msg.user_id ? { ...m, position:msg.position } : m
                )}};
              case "CHAT":
                return { ...s, chat:[...s.chat, {user_id:msg.user_id,username:msg.username,text:msg.text,ts:msg.ts}].slice(-200) };
              case "pong": return s;
              case "error":
                return { ...s, error:msg.msg };
              default: return s;
            }
          });
        } catch {}
      };

      ws.onclose = (e) => {
        if (!mountedRef.current) return;
        setSession(s => ({ ...s, connected:false }));
        // Auto-reconnect with exponential backoff (not on auth failure)
        if (e.code !== 4001 && retriesRef.current < 5 && roomIdRef.current) {
          const delay = Math.min(1000 * 2 ** retriesRef.current, 30_000);
          retriesRef.current += 1;
          setTimeout(() => {
            if (mountedRef.current && roomIdRef.current) _connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        if (mountedRef.current) setSession(s => ({ ...s, error:"Connection error" }));
      };
    };

    _connect();
  }, [token]);

  const disconnect = useCallback(() => {
    retriesRef.current = 999; // block reconnect
    roomIdRef.current  = null;
    wsRef.current?.close();
    wsRef.current = null;
    setSession({ room:null, myId:"", connected:false, chat:[], error:null });
  }, []);

  const createRoom = useCallback(async (name:string, missionId?:string): Promise<string|null> => {
    if (!token) return null;
    try {
      const res = await api.post<{room_id:string}>("/rooms/", { name, mission_id:missionId??null }, token);
      return res.room_id;
    } catch { return null; }
  }, [token]);

  const fetchRooms = useCallback(async (): Promise<RoomInfo[]> => {
    if (!token) return [];
    try {
      const res = await api.get<{rooms:RoomInfo[]}>("/rooms/", token);
      return res.rooms;
    } catch { return []; }
  }, [token]);

  const sendChat     = useCallback((text:string) => send({type:"CHAT",text}), [send]);
  const sendReady    = useCallback((ready:boolean) => send({type:"READY",ready}), [send]);
  const sendPosition = useCallback((pos:{lat:number;lon:number;alt_m:number}) => send({type:"POSITION",position:pos}), [send]);
  const startMission = useCallback(() => send({type:"START_MISSION"}), [send]);
  const sendEvent    = useCallback((event:object) => send({type:"MISSION_EVENT",event}), [send]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
    };
  }, []);

  const myMember = session.room?.members.find(m => m.user_id === session.myId) ?? null;
  const isHost   = myMember?.role === "HOST";

  return {
    session, myMember, isHost,
    connectToRoom, disconnect,
    createRoom, fetchRooms,
    sendChat, sendReady, sendPosition, startMission, sendEvent,
  };
}
