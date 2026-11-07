/** One device may hold several booking refs for the same salon (different phones). */

export type VisitMemory = { name: string; phone: string; ref: string; dayKey?: string };

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
    const dayKey = typeof item.dayKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.dayKey) ? item.dayKey : "";
    if (!ref || !phone || seen.has(ref)) continue;
    seen.add(ref);
    out.push({ name, phone, ref, ...(dayKey ? { dayKey } : {}) });
  }
  return out.slice(0, VISIT_MEMORY_MAX);
}

/** Newest first. Drops an older row with the same ref or phone. */
export function rememberVisit(existing: VisitMemory[], next: VisitMemory): VisitMemory[] {
  const dayKey = next.dayKey && /^\d{4}-\d{2}-\d{2}$/.test(next.dayKey) ? next.dayKey : "";
  const clean: VisitMemory = {
    name: next.name.trim().slice(0, 80),
    phone: next.phone.trim(),
    ref: next.ref.trim(),
    ...(dayKey ? { dayKey } : {}),
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

/** Bookings on this device other than the ticket the customer is looking at. */
export function otherBookings(visits: VisitMemory[], currentRef: string) {
  return visits.filter((visit) => visit.ref && visit.ref !== currentRef);
}
