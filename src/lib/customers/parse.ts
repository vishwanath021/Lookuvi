import { kolkataDayKey } from "@/lib/queue/day";
import { indianMobile } from "@/lib/queue/phone";

export function displayPhone(phone: string) {
  if (phone.startsWith("91") && phone.length === 12) {
    const local = phone.slice(2);
    return `${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return phone;
}

/** Keep a real name. Never store the desk placeholder as the customer's name. */
export function nextCustomerName(current: string, incoming: string) {
  const clean = incoming.trim().slice(0, 80);
  if (!clean || clean.toLowerCase() === "walk-in") return current;
  return clean;
}

export function isStopText(text: string) {
  const cleaned = text.trim().toLowerCase().replace(/[.!]+$/g, "").replace(/\s+/g, "");
  return cleaned === "stop" || cleaned === "stopall" || cleaned === "unsubscribe";
}

export function cleanOffer(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function validVisitDate(iso: string, today: string) {
  if (!DAY.test(iso) || iso < "2020-01-01" || iso > today) return false;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Noon in Asia/Kolkata, stored as UTC. */
export function istNoon(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 6, 30, 0));
}

export type ImportRow = { phone: string; name: string; visitedOn: string };

export function parseCustomerImport(text: string, today = kolkataDayKey()) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 500) return { rows: [] as ImportRow[], invalid: 0, datesIgnored: 0, tooLong: true };
  const byPhone = new Map<string, ImportRow>();
  let invalid = 0;
  let datesIgnored = 0;
  for (const line of lines) {
    const parts = line.split(",").map((part) => part.trim()).filter(Boolean);
    let phone = "";
    let visitedOn = "";
    const names: string[] = [];
    let badDate = false;
    for (const part of parts) {
      const mobile = indianMobile(part);
      if (!phone && mobile) {
        phone = mobile;
        continue;
      }
      if (DAY.test(part)) {
        if (validVisitDate(part, today)) visitedOn = part;
        else badDate = true;
        continue;
      }
      names.push(part);
    }
    if (!phone) {
      invalid += 1;
      continue;
    }
    if (badDate) datesIgnored += 1;
    byPhone.set(phone, { phone, name: names.join(" ").slice(0, 80), visitedOn });
  }
  return { rows: [...byPhone.values()], invalid, datesIgnored, tooLong: false };
}

export function customerFilter(tenantId: string, q: string) {
  const query = q.trim().slice(0, 40);
  if (!query) return { tenantId };
  const digits = query.replace(/\D/g, "");
  const or: { name?: { contains: string }; phone?: { contains: string } }[] = [{ name: { contains: query } }];
  if (digits) or.push({ phone: { contains: digits } });
  return { tenantId, OR: or };
}
