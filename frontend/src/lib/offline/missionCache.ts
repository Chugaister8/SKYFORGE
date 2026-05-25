/**
 * Offline mission cache via IndexedDB.
 * Write-through: cache updated on every API write.
 * Read-through: returns cached data when offline.
 */

const DB_NAME    = "skyforge-offline";
const STORE_NAME = "missions";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function idbRequest<T>(req: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T);
    req.onerror   = () => reject(req.error);
  });
}

export async function cacheMissions(missions: any[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDB();
    const t  = db.transaction(STORE_NAME, "readwrite");
    const s  = t.objectStore(STORE_NAME);
    for (const m of missions) s.put({ ...m, _cached_at: Date.now() });
    await new Promise<void>((res, rej) => {
      t.oncomplete = () => res();
      t.onerror    = () => rej(t.error);
    });
  } catch {}
}

export async function cacheMission(mission: any): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDB();
    await idbRequest(
      db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({
        ...mission, _cached_at: Date.now(),
      })
    );
  } catch {}
}

export async function getCachedMissions(): Promise<any[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db  = await openDB();
    const all = await idbRequest<any[]>(
      db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll()
    );
    return (all ?? []).sort((a, b) =>
      (b.created_at ?? "") > (a.created_at ?? "") ? 1 : -1
    );
  } catch { return []; }
}

export async function getCachedMission(id: string): Promise<any | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDB();
    return await idbRequest<any>(
      db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id)
    ) ?? null;
  } catch { return null; }
}

export async function removeCachedMission(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDB();
    await idbRequest(
      db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id)
    );
  } catch {}
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
