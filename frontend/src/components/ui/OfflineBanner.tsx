"use client";
import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { clsx } from "clsx";

export function OfflineBanner() {
  const [online,      setOnline]      = useState(true);
  const [justCameBack, setJustCameBack] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setJustCameBack(true);
      setTimeout(() => setJustCameBack(false), 3000);
    };
    const handleOffline = () => { setOnline(false); setJustCameBack(false); };

    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online && !justCameBack) return null;

  return (
    <div className={clsx(
      "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded border font-mono text-xs transition-all",
      justCameBack
        ? "border-threat-low/50 bg-threat-low/10 text-threat-low"
        : "border-threat-high/50 bg-threat-high/10 text-threat-high animate-pulse",
    )}>
      {justCameBack
        ? <><Wifi    className="w-3.5 h-3.5" strokeWidth={1.5} />CONNECTION RESTORED</>
        : <><WifiOff className="w-3.5 h-3.5" strokeWidth={1.5} />OFFLINE — USING CACHED DATA</>
      }
    </div>
  );
}
