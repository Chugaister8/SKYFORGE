"use client";
import { useEffect, useState, useCallback } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { clsx } from "clsx";

export type ToastType = "success"|"error"|"warning"|"info";

export interface Toast {
  id:      string;
  type:    ToastType;
  title:   string;
  message?: string;
  duration?: number;   // ms, default 4000; 0 = persist
}

// Global store (no Zustand needed — simple module singleton)
type Listener = (toasts: Toast[]) => void;
let _toasts:   Toast[]   = [];
let _listeners:Listener[] = [];

function notify() { _listeners.forEach(l => l([..._toasts])); }

export const toast = {
  show(t: Omit<Toast,"id">): string {
    const id = Math.random().toString(36).slice(2, 9);
    _toasts = [..._toasts, { ...t, id }];
    notify();
    if (t.duration !== 0) {
      setTimeout(() => toast.dismiss(id), t.duration ?? 4000);
    }
    return id;
  },
  success: (title: string, message?: string) =>
    toast.show({ type:"success", title, message }),
  error:   (title: string, message?: string) =>
    toast.show({ type:"error", title, message, duration: 6000 }),
  warning: (title: string, message?: string) =>
    toast.show({ type:"warning", title, message }),
  info:    (title: string, message?: string) =>
    toast.show({ type:"info", title, message }),
  dismiss: (id: string) => {
    _toasts = _toasts.filter(t => t.id !== id);
    notify();
  },
};

const ICON: Record<ToastType, any> = {
  success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info,
};
const STYLE: Record<ToastType, string> = {
  success: "border-threat-low/50   bg-threat-low/10   text-threat-low",
  error:   "border-threat-high/50  bg-threat-high/10  text-threat-high",
  warning: "border-threat-medium/50 bg-threat-medium/10 text-threat-medium",
  info:    "border-border-active    bg-cyan-subtle     text-cyan-DEFAULT",
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (t: Toast[]) => setToasts(t);
    _listeners.push(listener);
    return () => { _listeners = _listeners.filter(l => l !== listener); };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-xs w-full">
      {toasts.map(t => {
        const Icon = ICON[t.type];
        return (
          <div key={t.id}
            className={clsx(
              "flex items-start gap-2.5 p-3 rounded border backdrop-blur-sm shadow-lg animate-in slide-in-from-right-4 duration-200",
              STYLE[t.type],
            )}>
            <Icon className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5}/>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs font-medium">{t.title}</p>
              {t.message && (
                <p className="font-mono text-2xs opacity-80 mt-0.5 leading-relaxed">{t.message}</p>
              )}
            </div>
            <button onClick={() => toast.dismiss(t.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
              <X className="w-3.5 h-3.5" strokeWidth={1.5}/>
            </button>
          </div>
        );
      })}
    </div>
  );
}
