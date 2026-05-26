/**
 * Auto-syncs offline missions when connection restores.
 * Mount once at app level.
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store/auth.store";
import { syncOfflineMissions } from "@/lib/offline/syncQueue";

interface SyncState {
  syncing: boolean;
  lastSync: Date | null;
  pending:  number;
  lastResult: { synced: number; failed: number } | null;
}

export function useOnlineSync() {
  const token      = useAuthStore(s => s.accessToken);
  const qc         = useQueryClient();
  const syncingRef = useRef(false);
  const [state, setState] = useState<SyncState>({
    syncing: false, lastSync: null, pending: 0, lastResult: null,
  });

  const doSync = async () => {
    if (!token || syncingRef.current) return;
    syncingRef.current = true;
    setState(s => ({ ...s, syncing: true }));

    try {
      const result = await syncOfflineMissions(token);
      if (result.synced > 0) {
        qc.invalidateQueries({ queryKey: ["missions"] });
      }
      setState(s => ({
        ...s, syncing: false,
        lastSync: new Date(),
        lastResult: { synced: result.synced, failed: result.failed },
      }));
    } catch {
      setState(s => ({ ...s, syncing: false }));
    } finally {
      syncingRef.current = false;
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      // Small delay to let connection stabilise
      setTimeout(doSync, 2000);
    };

    window.addEventListener("online", handleOnline);

    // Also try on mount if already online
    if (navigator.onLine) {
      setTimeout(doSync, 3000);
    }

    return () => window.removeEventListener("online", handleOnline);
  }, [token]);

  return state;
}
