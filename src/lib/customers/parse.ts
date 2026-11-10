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

export function stopScope(text: string): "salon" | "global" | null {
  const cleaned = text.trim().toLowerCase().replace(/[.!]+$/g, "").replace(/\s+/g, "");
  if (cleaned === "stopall" || cleaned === "unsubscribe") return "global";
  if (cleaned === "stop") return "salon";
  return null;
}

export function isStopText(text: string) {
  return stopScope(text) !== null;
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
export type ImportSkip = { line: number; value: string; reason: string };

export function classifyImportFile(bytes: Uint8Array) {
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) return "spreadsheet" as const;
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00) return "unknown" as const;
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 80)).toLowerCase();
  if (head.includes("<html") || head.includes("<!doctype")) return "spreadsheet" as const;
  return "text" as const;
}

export function decodeImportText(bytes: Uint8Array) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.slice(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.slice(2));
  let text = new TextDecoder("utf-8").decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function splitCells(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  const source = line.includes("\t") && !line.includes(",") ? line.replace(/\t/g, ",") : line;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^\uFEFF/, ""));
}

function expandNumber(part: string) {
  const compact = part.replace(/[\s-]/g, "");
  if (/^\d+(\.\d+)?e[+-]\d+$/i.test(compact)) {
    const value = Number(compact);
    if (Number.isFinite(value) && value < 1e15) return String(Math.round(value));
  }
  return part;
}

function headerMap(cells: string[]) {
  const labels = cells.map((cell) => cell.toLowerCase().replace(/[^a-z]/g, ""));
  const phone = labels.findIndex((label) => label.includes("phone") || label.includes("mobile") || label === "number" || label === "mobilenumber");
  const name = labels.findIndex((label) => label === "name" || label.includes("customer") || label === "guest");
  if (phone < 0 && name < 0) return null;
  if (cells.some((cell) => indianMobile(expandNumber(cell)))) return null;
  return { phone, name };
}

export function parseCustomerImport(text: string, today = kolkataDayKey()) {
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length > 500) return { rows: [] as ImportRow[], invalid: 0, datesIgnored: 0, tooLong: true, skipped: [] as ImportSkip[] };
  const byPhone = new Map<string, ImportRow>();
  let invalid = 0;
  let datesIgnored = 0;
  const skipped: ImportSkip[] = [];
  const columns = headerMap(splitCells(lines[0] || ""));
  const start = columns ? 1 : 0;
  for (let index = start; index < lines.length; index += 1) {
    const cells = splitCells(lines[index]).map(expandNumber);
    let phone = "";
    let visitedOn = "";
    const names: string[] = [];
    let badDate = false;
    if (columns) {
      if (columns.phone >= 0) phone = indianMobile(cells[columns.phone] || "");
      if (columns.name >= 0) names.push(cells[columns.name] || "");
      for (let cell = 0; cell < cells.length; cell += 1) {
        if (cell === columns.phone || cell === columns.name) continue;
        if (DAY.test(cells[cell] || "")) {
          if (validVisitDate(cells[cell], today)) visitedOn = cells[cell];
          else badDate = true;
        }
      }
    } else {
      for (const part of cells.filter(Boolean)) {
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
    }
    if (!phone) {
      invalid += 1;
      if (skipped.length < 3) skipped.push({ line: index + 1, value: lines[index].slice(0, 80), reason: "No Indian mobile number on this row." });
      continue;
    }
    if (badDate) datesIgnored += 1;
    byPhone.set(phone, { phone, name: names.join(" ").trim().slice(0, 80), visitedOn });
  }
  return { rows: [...byPhone.values()], invalid, datesIgnored, tooLong: false, skipped };
}

export function customerFilter(tenantId: string, q: string) {
  const query = q.trim().slice(0, 40);
  if (!query) return { tenantId };
  const digits = query.replace(/\D/g, "");
  const or: { name?: { contains: string }; phone?: { contains: string } }[] = [{ name: { contains: query } }];
  if (digits) or.push({ phone: { contains: digits } });
  return { tenantId, OR: or };
}
