export type SavedPick = { tool: string; id: string; name: string };

const MAX_SAVED = 12;

export function showLockedBrowse(
  salonRequires: boolean,
  state: { ready: boolean; required: boolean; unlocked: boolean },
) {
  if (state.ready) return state.required && !state.unlocked;
  return salonRequires;
}

export function addSavedPick(list: SavedPick[], pick: SavedPick) {
  const next = [pick, ...list.filter((item) => !(item.tool === pick.tool && item.id === pick.id))];
  return next.slice(0, MAX_SAVED);
}

export function savedPickOn(list: SavedPick[], pick: { tool: string; id: string }) {
  return list.some((item) => item.tool === pick.tool && item.id === pick.id);
}

/** Save when it is new, unsave when it is already kept. */
export function toggleSavedPick(list: SavedPick[], pick: SavedPick) {
  if (savedPickOn(list, pick)) return list.filter((item) => !(item.tool === pick.tool && item.id === pick.id));
  return addSavedPick(list, pick);
}

export function readSavedPicks(raw: string | null): SavedPick[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as SavedPick;
      if (!row.tool || !row.id || !row.name) return [];
      return [{ tool: String(row.tool), id: String(row.id), name: String(row.name) }];
    }).slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

export function savedPicksKey(slug: string) {
  return `lookuvi-saved:${slug}`;
}

export const SAVED_DROP_ERROR = "Could not remove that look. It is still saved.";

/** The card leaves the list immediately. The caller writes storage and rolls back on failure. */
export function removeSavedPick(list: SavedPick[], pick: { tool: string; id: string }) {
  return list.filter((item) => !(item.tool === pick.tool && item.id === pick.id));
}

export function writeSavedPicks(list: SavedPick[], write: (raw: string) => void) {
  try {
    write(JSON.stringify(list));
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: SAVED_DROP_ERROR };
  }
}
