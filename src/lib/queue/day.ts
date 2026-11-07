/** Calendar day in Asia/Kolkata, YYYY-MM-DD. */
export function kolkataDayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function kolkataToday(now = new Date()) {
  return kolkataDayKey(now);
}

/** A YYYY-MM-DD calendar day before today in Asia/Kolkata. Today is allowed. */
export function isPastKolkataDay(iso: string, now = new Date()) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso < kolkataDayKey(now);
}

export const PAST_DATE_MESSAGE = "Choose today or a later date.";

/** YYYY-MM in Asia/Kolkata. Same month the try-on allowance and WhatsApp cap use. */
export function kolkataMonthKey(now = new Date()) {
  return kolkataDayKey(now).slice(0, 7);
}

/** Midnight at the start of the Asia/Kolkata calendar day. Daily preview caps use this, not the server clock. */
export function kolkataDayStart(now = new Date()) {
  const [year, month, day] = kolkataDayKey(now).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, -5, -30));
}
