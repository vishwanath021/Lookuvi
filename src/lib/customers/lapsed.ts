import { prisma } from "@/lib/prisma";
import { displayPhone } from "@/lib/customers/parse";
import { blockedPhoneSet } from "@/lib/customers/service";

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_MS = 5.5 * 60 * 60 * 1000;

export type LapseBand = "weeks6" | "months2" | "months3";

/** 6 weeks is 42 days. 2 and 3 months step the Asia/Kolkata calendar. */
export function lapseCutoff(band: LapseBand, now = new Date()) {
  if (band === "weeks6") return new Date(now.getTime() - 42 * DAY_MS);
  const ist = new Date(now.getTime() + IST_MS);
  const months = band === "months2" ? -2 : -3;
  const shifted = new Date(Date.UTC(
    ist.getUTCFullYear(),
    ist.getUTCMonth() + months,
    ist.getUTCDate(),
    ist.getUTCHours(),
    ist.getUTCMinutes(),
    ist.getUTCSeconds(),
    ist.getUTCMilliseconds(),
  ));
  return new Date(shifted.getTime() - IST_MS);
}

function visitLabel(at: Date) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(at);
}

export function lapseSummary(count: number) {
  const noun = count === 1 ? "customer" : "customers";
  return `${count} ${noun} not back in 6+ weeks`;
}

export async function listLapsed(tenantId: string, now = new Date()) {
  const weeks6 = lapseCutoff("weeks6", now);
  const months2 = lapseCutoff("months2", now);
  const months3 = lapseCutoff("months3", now);
  const rows = await prisma.customer.findMany({
    where: { tenantId, lastVisitAt: { lte: weeks6 } },
    orderBy: { lastVisitAt: "asc" },
    take: 200,
  });
  const blocked = await blockedPhoneSet(tenantId, rows.map((row) => row.phone));
  const cards = rows.map((row) => {
    const stopped = blocked.has(row.phone) || row.optOutSource === "STOP";
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      phoneLabel: displayPhone(row.phone),
      visitCount: row.visitCount,
      lastVisitAt: row.lastVisitAt ? row.lastVisitAt.toISOString() : "",
      lastVisitLabel: row.lastVisitAt ? visitLabel(row.lastVisitAt) : "No visit yet",
      optedOut: Boolean(row.optedOutAt) || blocked.has(row.phone),
      stop: stopped,
    };
  });
  const inBand = (cutoff: Date) => cards.filter((card) => card.lastVisitAt && card.lastVisitAt <= cutoff.toISOString());
  return {
    summary: lapseSummary(cards.length),
    count: cards.length,
    weeks6: cards,
    months2: inBand(months2),
    months3: inBand(months3),
  };
}
