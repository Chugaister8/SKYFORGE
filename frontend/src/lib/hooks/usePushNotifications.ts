/**
 * Web Push Notifications hook.
 * - Requests permission
 * - Registers service worker
 * - Subscribes browser to backend
 * - Sends local notifications for telemetry events
 */
import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";

export type NotifPermission = "default"|"granted"|"denied";

export function usePushNotifications() {
  const token = useAuthStore(s => s.accessToken);
  const [permission,  setPermission]  = useState<NotifPermission>("default");
  const [subscribed,  setSubscribed]  = useState(false);
  const [swReady,     setSwReady]     = useState(false);
  const [error,       setError]       = useState("");

  const supported = typeof window !== "undefined"
    && "Notification"     in window
    && "serviceWorker"    in navigator
    && "PushManager"      in window;

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission as NotifPermission);

    // Register service worker
    navigator.serviceWorker.register("/sw.js")
      .then(() => setSwReady(true))
      .catch(e => setError(`SW registration failed: ${e.message}`));
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;
    const result = await Notification.requestPermission();
    setPermission(result as NotifPermission);
    return result === "granted";
  }, [supported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported || !swReady || !token) return false;
    try {
      // Get VAPID public key
      const { key } = await api.get<{key:string}>("/push/vapid-public-key", token);
      if (!key) { setError("Push not configured on server"); return false; }

      const reg  = await navigator.serviceWorker.ready;
      const sub  = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      const subJSON = sub.toJSON();
      await api.post("/push/subscribe", {
        endpoint:   subJSON.endpoint,
        keys:       subJSON.keys ?? {},
        user_agent: navigator.userAgent.slice(0, 128),
      }, token);

      setSubscribed(true);
      return true;
    } catch (e: any) {
      setError(e.message ?? "Subscription failed");
      return false;
    }
  }, [supported, swReady, token]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!supported || !token) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      const subJSON = sub.toJSON();
      await api.delete("/push/subscribe", token);
      await sub.unsubscribe();
      setSubscribed(false);
    } catch {}
  }, [supported, token]);

  /** Send a local (non-push) notification — works without server. */
  const notify = useCallback((title: string, body: string, tag = "skyforge") => {
    if (permission !== "granted") return;
    new Notification(title, {
      body,
      tag,
      icon:  "/icon-192.png",
      badge: "/icon-72.png",
    });
  }, [permission]);

  return {
    supported, permission, subscribed, swReady, error,
    requestPermission, subscribe, unsubscribe, notify,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding  = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64   = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw      = window.atob(base64);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
