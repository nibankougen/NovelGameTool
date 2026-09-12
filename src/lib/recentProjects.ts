import { uid } from "./id";

export interface RecentProjectEntry {
  id: string;
  title: string;
  handle: FileSystemDirectoryHandle;
  lastOpenedAt: number;
}

const DB_NAME = "novelGameTool";
const DB_VERSION = 1;
const STORE = "recentProjects";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listRecentProjects(): Promise<RecentProjectEntry[]> {
  const all = await withStore<RecentProjectEntry[]>("readonly", (s) => s.getAll());
  return all.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

export async function touchRecentProject(handle: FileSystemDirectoryHandle, title: string): Promise<void> {
  const all = await listRecentProjects();
  let existing: RecentProjectEntry | undefined;
  for (const e of all) {
    if (await handle.isSameEntry(e.handle)) {
      existing = e;
      break;
    }
  }
  const entry: RecentProjectEntry = {
    id: existing?.id ?? uid(),
    title,
    handle,
    lastOpenedAt: Date.now(),
  };
  await withStore("readwrite", (s) => s.put(entry));
}

export async function removeRecentProject(id: string): Promise<void> {
  await withStore("readwrite", (s) => s.delete(id));
}
