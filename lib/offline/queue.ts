// Source: TRD section 11.3 (Offline behaviour) + Sessions.md Session 13
// ("task completion queues offline and syncs on reconnect") — deferred by
// Session 9, now required. Plain IndexedDB, no library — the queue is
// simple (add/list/remove, in insertion order), matching this project's
// established "no dependency where one isn't truly needed" pattern.
const DB_NAME = "autopilot-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-actions";

export interface QueuedAction {
  id?: number;
  type: "complete_task";
  payload: { taskId: string; carerId: string };
  createdAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueAction(action: Omit<QueuedAction, "id">): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(action);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
  const db = await openDB();
  const actions = await new Promise<QueuedAction[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as QueuedAction[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return actions;
}

export async function removeQueuedAction(id: number): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
