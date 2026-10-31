/** One device may hold several booking refs for the same salon (different phones). */

export type VisitMemory = { name: string; phone: string; ref: string };

export const VISIT_MEMORY_MAX = 5;

export function parseVisitMemory(raw: string | null): VisitMemory[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return normalizeList(parsed);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.visits)) return normalizeList(obj.visits);
      return normalizeList([obj]);
    }
  } catch {
    return [];
  }
  return [];
}

function normalizeList(rows: unknown[]): VisitMemory[] {
  const out: VisitMemory[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const ref = typeof item.ref === "string" ? item.ref.trim() : "";
    const phone = typeof item.phone === "string" ? item.phone.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 80) : "";
    if (!ref || !phone || seen.has(ref)) continue;
    seen.add(ref);
    out.push({ name, phone, ref });
  }
  return out.slice(0, VISIT_MEMORY_MAX);
}

/** Newest first. Drops an older row with the same ref or phone. */
export function rememberVisit(existing: VisitMemory[], next: VisitMemory): VisitMemory[] {
  const clean: VisitMemory = {
    name: next.name.trim().slice(0, 80),
    phone: next.phone.trim(),
    ref: next.ref.trim(),
  };
  if (!clean.ref || !clean.phone) return existing.slice(0, VISIT_MEMORY_MAX);
  const rest = existing.filter((row) => row.ref !== clean.ref && row.phone !== clean.phone);
  return [clean, ...rest].slice(0, VISIT_MEMORY_MAX);
}

export function serializeVisitMemory(visits: VisitMemory[]) {
  return JSON.stringify({ visits: visits.slice(0, VISIT_MEMORY_MAX) });
}

export function visitMemoryKey(slug: string) {
  return `lookuvi-queue:${slug}`;
}
