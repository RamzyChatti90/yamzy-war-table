// ════════════════════════════════════════════════════════════════════════
// 🗄 WORLD MAP — Stockage IndexedDB des GLBs d'îles par zone
//
// localStorage est trop petit (~5MB) et ne supporte pas le binaire propre.
// IndexedDB stocke nativement des Blobs et n'a pas de limite stricte côté
// navigateur (généralement quelques centaines de MB sans demande de permission).
//
// Schema :
//   DB : yamzy-world-map
//   Store : zoneGlbs (key = MapMarker.key, value = Blob)
// ════════════════════════════════════════════════════════════════════════

const DB_NAME = 'yamzy-world-map';
const STORE = 'zoneGlbs';
const VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

/** Sauve un Blob GLB pour une zone. */
export async function saveZoneGlb(key: string, blob: Blob): Promise<void> {
  const db = await openDB();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

/** Récupère le Blob GLB d'une zone (ou null si absent). */
export async function loadZoneGlb(key: string): Promise<Blob | null> {
  const db = await openDB();
  const result = await new Promise<Blob | null>((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => res((req.result as Blob) ?? null);
    req.onerror = () => rej(req.error);
  });
  db.close();
  return result;
}

/** Supprime le GLB d'une zone. */
export async function deleteZoneGlb(key: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}
