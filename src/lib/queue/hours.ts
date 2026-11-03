/**
 * Salon hours are wall-clock times in Asia/Kolkata, the same clock as `kolkataDayKey`.
 * They are not converted from UTC. Desk pause is a separate switch.
 */
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Request-mode slots when a salon has not set its own hours. */
export const REQUEST_SLOT_EARLIEST = "06:00";
export const REQUEST_SLOT_LATEST = "22:00";

export type OperatingHours =
  | { kind: "fallback" }
  | { kind: "custom"; open: string; close: string }
  | { kind: "invalid"; message: string };

export function normalizeClock(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed.slice(0, 5);
  return trimmed;
}

export const HOURS_INVALID = "Open must be before close. Use 24-hour times, for example 10:00 and 19:00.";

/** Empty pair means the global daytime window. One side, a bad clock, or open >= close is rejected. */
export function parseOperatingHours(open: string | null | undefined, close: string | null | undefined): OperatingHours {
  const openTime = normalizeClock(open);
  const closeTime = normalizeClock(close);
  if (!openTime && !closeTime) return { kind: "fallback" };
  if (!CLOCK.test(openTime) || !CLOCK.test(closeTime) || openTime >= closeTime) {
    return { kind: "invalid", message: HOURS_INVALID };
  }
  return { kind: "custom", open: openTime, close: closeTime };
}

/** Salon hours when both are valid. Anything else, including a stored pair with open >= close, uses 06:00–22:00. */
export function requestWindow(open?: string | null, close?: string | null) {
  const parsed = parseOperatingHours(open, close);
  if (parsed.kind === "custom") return { open: parsed.open, close: parsed.close };
  return { open: REQUEST_SLOT_EARLIEST, close: REQUEST_SLOT_LATEST };
}

/** HH:MM in Asia/Kolkata. */
export function kolkataClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = (parts.find((part) => part.type === "hour")?.value ?? "00").slice(-2);
  const minute = (parts.find((part) => part.type === "minute")?.value ?? "00").slice(-2);
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

/** Live joins use custom hours only. An unset salon stays on the desk open/pause switch. */
export function liveJoinWindow(open?: string | null, close?: string | null, now = new Date()) {
  const parsed = parseOperatingHours(open, close);
  if (parsed.kind !== "custom") return { closed: false as const, message: "" };
  const clock = kolkataClock(now);
  if (clock >= parsed.open && clock <= parsed.close) return { closed: false as const, message: "" };
  return {
    closed: true as const,
    message: `This salon takes queue joins from ${parsed.open} to ${parsed.close} India time.`,
  };
}
