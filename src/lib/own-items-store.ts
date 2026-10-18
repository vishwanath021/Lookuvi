/**
 * Keeps the guest's piece photos for this browser tab only, so they survive the page
 * reload Android does when the camera app opens, and switching tabs in the flow.
 * Scoped to a per-tab id in sessionStorage, dropped after 30 minutes, never uploaded.
 */

const DB = "lookuvi-own-items";
const STORE = "items";
export const OWN_ITEMS_TTL_MS = 30 * 60 * 1000;

type Row = { key: string; blob: Blob; at: number };

function tabId() {
  try {
    let id = sessionStorage.getItem("lookuvi-own-tab");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("lookuvi-own-tab", id);
    }
    return id;
  } catch {
    return "";
  }
}

export function ownItemKey(tab: string, scope: string, slot: string) {
  return `${tab}|${scope}|${slot}`;
}

export function isFresh(at: number, now = Date.now()) {
  return now - at >= 0 && now - at < OWN_ITEMS_TTL_MS;
}

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = work(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(req ? req.result : undefined); };
      tx.onerror = () => { db.close(); resolve(undefined); };
      tx.onabort = () => { db.close(); resolve(undefined); };
    } catch {
      db.close();
      resolve(undefined);
    }
  });
}

export async function saveOwnItem(scope: string, slot: string, blob: Blob) {
  const tab = tabId();
  if (!tab) return;
  await run("readwrite", (store) => store.put({ key: ownItemKey(tab, scope, slot), blob, at: Date.now() } satisfies Row));
}

export async function dropOwnItem(scope: string, slot: string) {
  const tab = tabId();
  if (!tab) return;
  await run("readwrite", (store) => store.delete(ownItemKey(tab, scope, slot)));
}

/** Photos saved by this tab for `scope`. Expired rows from any tab are deleted. */
export async function loadOwnItems(scope: string): Promise<Record<string, Blob>> {
  const tab = tabId();
  if (!tab) return {};
  const rows = ((await run<Row[]>("readonly", (store) => store.getAll() as IDBRequest<Row[]>)) || []) as Row[];
  const out: Record<string, Blob> = {};
  const stale: string[] = [];
  const prefix = `${tab}|${scope}|`;
  for (const row of rows) {
    if (!isFresh(row.at)) stale.push(row.key);
    else if (row.key.startsWith(prefix)) out[row.key.slice(prefix.length)] = row.blob;
  }
  if (stale.length) await run("readwrite", (store) => { for (const key of stale) store.delete(key); });
  return out;
}
