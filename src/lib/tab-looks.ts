export type TabTool = "style" | "brows" | "beard" | "nails" | "colour";

export const TAB_TOOLS: readonly TabTool[] = ["style", "colour", "brows", "nails", "beard"];

export type TabLook = {
  id: string;
  styleId: string;
  styleName: string;
  shadeName: string | null;
  before: string;
  after: string;
  alignMode?: "landmarks" | "cover";
  eyeDelta?: number | null;
  serviceKeys: string[];
  tool: TabTool;
  demo?: boolean;
  lookShare?: string;
};

export type TabLookMap = Partial<Record<TabTool, TabLook>>;

export type TabSession = {
  face?: string;
  hand?: string;
  looks: TabLookMap;
};

export function tabLookCacheKey(slug: string) {
  return `lookuvi-tab-looks:v1:${slug}`;
}

const tabMemory = new Map<string, string>();

/** Prefer the in-tab copy so a remount still has the previews when sessionStorage is full. */
export function readTabSessionRaw(slug: string) {
  const mem = tabMemory.get(slug);
  if (mem) return mem;
  try {
    return sessionStorage.getItem(tabLookCacheKey(slug));
  } catch {
    return null;
  }
}

export function writeTabSessionRaw(slug: string, raw: string) {
  tabMemory.set(slug, raw);
  try {
    sessionStorage.setItem(tabLookCacheKey(slug), raw);
  } catch {
    /* Quota. The memory map still restores the screen in this tab. */
  }
}

/** A new result replaces only that tab. The other tabs stay. */
export function putTabLook(map: TabLookMap, look: TabLook): TabLookMap {
  return { ...map, [look.tool]: look };
}

export function clearTabLooks(map: TabLookMap, tools: readonly TabTool[]): TabLookMap {
  const next: TabLookMap = { ...map };
  for (const tool of tools) delete next[tool];
  return next;
}

/** Generation always starts from the captured selfie, never from another tab's after image. */
export function selfieForEdit<T>(original: T | null): T | null {
  return original;
}

function isTool(value: unknown): value is TabTool {
  return TAB_TOOLS.includes(value as TabTool);
}

function isLook(value: unknown, tool: TabTool): value is TabLook {
  if (!value || typeof value !== "object") return false;
  const look = value as TabLook;
  return look.tool === tool && typeof look.before === "string" && typeof look.after === "string" && typeof look.styleId === "string";
}

export function parseTabSession(raw: string | null): TabSession {
  if (!raw) return { looks: {} };
  try {
    const parsed = JSON.parse(raw) as { face?: unknown; hand?: unknown; looks?: TabLookMap };
    const looks: TabLookMap = {};
    for (const tool of TAB_TOOLS) {
      const look = parsed.looks?.[tool];
      if (isLook(look, tool)) looks[tool] = look;
    }
    return {
      face: typeof parsed.face === "string" && parsed.face.startsWith("data:image/") ? parsed.face : undefined,
      hand: typeof parsed.hand === "string" && parsed.hand.startsWith("data:image/") ? parsed.hand : undefined,
      looks,
    };
  } catch {
    return { looks: {} };
  }
}

export function serializeTabSession(session: TabSession) {
  const looks: TabLookMap = {};
  for (const tool of TAB_TOOLS) {
    const look = session.looks[tool];
    if (look && isTool(look.tool)) looks[tool] = look;
  }
  return JSON.stringify({ face: session.face, hand: session.hand, looks });
}
