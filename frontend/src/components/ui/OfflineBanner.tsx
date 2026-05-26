"use client";
import { useEffect, useState } from "react";
import { WifiOff, Wifi, RefreshCw, CheckCircle } from "lucide-react";
import { clsx } from "clsx";
import { useOnlineSync } from "@/lib/hooks/useOnlineSync";

export function OfflineBanner() {
  const [online,       setOnline]       = useState(true);
  const [showRestored, setShowRestored] = useState(false);
  const { syncing, lastResult }         = useOnlineSync();

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 4000);
    };
    const handleOffline = () => { setOnline(false); setShowRestored(false); };

    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Offline
  if (!online) return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded border border-threat-high/50 bg-bg-surface/95 text-threat-high font-mono text-xs animate-pulse backdrop-blur-sm">
      <WifiOff className="w-3.5 h-3.5" strokeWidth={1.5}/>
      OFFLINE — using cached data
    </div>
  );

  // Syncing pending missions
  if (syncing) return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded border border-cyan-DEFAULT/50 bg-bg-surface/95 text-cyan-DEFAULT font-mono text-xs backdrop-blur-sm">
      <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5}/>
      Syncing offline missions…
    </div>
  );

  // Just restored + synced
  if (showRestored) return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded border border-threat-low/50 bg-bg-surface/95 font-mono text-xs backdrop-blur-sm text-threat-low">
      {lastResult?.synced ? (
        <><CheckCircle className="w-3.5 h-3.5" strokeWidth={1.5}/>
          Connection restored · {lastResult.synced} mission{lastResult.synced !== 1 ? "s" : ""} synced</>
      ) : (
        <><Wifi className="w-3.5 h-3.5" strokeWidth={1.5}/>Connection restored</>
      )}
    </div>
  );

  return null;
}
