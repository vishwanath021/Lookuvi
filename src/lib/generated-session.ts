/** Generated previews kept for this browser tab. Survives leaving a screen and coming back. */

export type StoredGenerated = {
  id: string;
  name: string;
  before: string;
  after: string;
  kind?: string;
  lookId?: string;
  share?: string;
};

const memory = new Map<string, StoredGenerated[]>();

function usable(item: StoredGenerated) {
  return Boolean(item && typeof item.after === "string" && item.after.startsWith("data:image/") && typeof item.before === "string");
}

export function rememberGenerated(key: string, look: StoredGenerated) {
  if (!usable(look)) return memory.get(key) || [];
  const prev = memory.get(key) || [];
  const next = [look, ...prev.filter((item) => item.id !== look.id)].slice(0, 6);
  memory.set(key, next);
  try {
    sessionStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* A full photo can exceed the quota. The in-memory copy still covers back navigation. */
  }
  return next;
}

export function readGenerated(key: string): StoredGenerated[] {
  const cached = memory.get(key);
  if (cached?.length) return cached;
  try {
    const raw = sessionStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) as StoredGenerated[] : [];
    const looks = Array.isArray(parsed) ? parsed.filter(usable) : [];
    memory.set(key, looks);
    return looks;
  } catch {
    return [];
  }
}
