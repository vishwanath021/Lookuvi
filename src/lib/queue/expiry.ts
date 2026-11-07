import { kolkataDayKey } from "@/lib/queue/day";
import { kolkataClock } from "@/lib/queue/hours";
import { effectiveWeek, weekdayOfDayKey, type HoursSource } from "@/lib/queue/schedule";

const OPEN = ["WAITING", "CALLED", "IN_SERVICE", "REQUESTED", "CONFIRMED"] as const;

export function isOpenVisitStatus(status: string) {
  return (OPEN as readonly string[]).includes(status);
}

/** Last session close on that Kolkata day. Null when the salon has no saved hours (expire at midnight only). */
export function sessionCloseClock(source: HoursSource, dayKey: string) {
  const week = effectiveWeek(source);
  if (week.kind !== "week") return null;
  const sessions = week.week[weekdayOfDayKey(dayKey)] || [];
  if (!sessions.length) return null;
  return sessions[sessions.length - 1].close;
}

/**
 * A live token or an unconfirmed request ends at the salon's close that day, or at the next Kolkata midnight.
 * A confirmed request for a future date stays until that date's close.
 */
export function visitShouldExpire(input: {
  status: string;
  dayKey: string;
  requestedDate?: string;
  joinedAt?: Date | null;
  now: Date;
  source: HoursSource;
}) {
  if (!isOpenVisitStatus(input.status)) return false;
  const day = input.status === "REQUESTED" || input.status === "CONFIRMED"
    ? (input.requestedDate || input.dayKey)
    : input.dayKey;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const today = kolkataDayKey(input.now);
  if (day < today) return true;
  if (day > today) return false;
  const close = sessionCloseClock(input.source, day);
  if (!close || kolkataClock(input.now) < close) return false;
  // The desk can still add someone after the posted close. That visit lasts until midnight.
  if (input.joinedAt && kolkataDayKey(input.joinedAt) === day && kolkataClock(input.joinedAt) >= close) return false;
  return true;
}
