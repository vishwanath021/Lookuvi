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

/** Durable preview URL. Blob URLs die when the screen remounts. */
export async function imageDataUrl(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  const type = blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  return `data:${type};base64,${btoa(binary)}`;
}

export function generatedFlowKey(slug: string, flow: string) {
  return flow ? `lookuvi-generated:${slug}:${flow}` : `lookuvi-generated:${slug}`;
}

async function asDataImage(value: Blob | string) {
  if (typeof value === "string") return value.startsWith("data:image/") ? value : "";
  return imageDataUrl(value);
}

/** Store a preview as data URLs so opening a detail and coming back still shows it. */
export async function holdGenerated(
  key: string,
  look: { id: string; name: string; before: Blob | string; after: Blob | string; kind?: string; lookId?: string; share?: string },
) {
  const before = await asDataImage(look.before);
  const after = await asDataImage(look.after);
  if (!before.startsWith("data:image/") || !after.startsWith("data:image/")) return null;
  const stored: StoredGenerated = {
    id: look.id,
    name: look.name,
    before,
    after,
    kind: look.kind,
    lookId: look.lookId,
    share: look.share,
  };
  rememberGenerated(key, stored);
  return stored;
}

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
