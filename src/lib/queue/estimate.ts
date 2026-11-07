export const ACTIVE_STATUSES = ["WAITING", "CALLED", "IN_SERVICE"] as const;

export function serviceMinutes(durationMin: number | null | undefined, avgMinutes: number) {
  if (durationMin && durationMin > 0) return durationMin;
  return Math.max(1, avgMinutes);
}

export type WaitRow = { id: string; status: string; joinedAt: Date; token: number };

/** People in front of this guest: anyone in a chair, anyone already called, then earlier tokens still waiting. */
export function peopleAhead<T extends WaitRow>(rows: T[], selfId: string | null) {
  const serving = rows.filter((row) => row.status === "IN_SERVICE" && row.id !== selfId);
  const called = rows.filter((row) => row.status === "CALLED" && row.id !== selfId);
  const self = selfId ? rows.find((row) => row.id === selfId) : null;
  const waiting = rows.filter((row) => {
    if (row.status !== "WAITING" || row.id === selfId) return false;
    if (!self || self.status !== "WAITING") return true;
    return row.token < self.token;
  });
  return [...serving, ...called, ...waiting];
}

/** Minutes still left on a service that has already started. A guest who has not started keeps the full block. */
export function remainingServiceMinutes(fullMinutes: number, startedAt: Date | null | undefined, now: Date) {
  const full = Math.max(0, Math.floor(Number(fullMinutes) || 0));
  if (!startedAt) return full;
  const elapsed = Math.floor((now.getTime() - startedAt.getTime()) / 60_000);
  return Math.max(0, full - Math.max(0, elapsed));
}

/** Sum of the minutes ahead, split across the open chairs, stations, or rooms. */
export function waitMinutes(minutes: number[], units: number) {
  const active = Math.max(1, units);
  const sum = minutes.reduce((total, value) => total + Math.max(1, value), 0);
  return Math.ceil(sum / active);
}

/** Same split as waitMinutes, but a finished chair (0 minutes left) does not add another minute. */
export function waitMinutesRemaining(minutes: number[], units: number) {
  const active = Math.max(1, units);
  const sum = minutes.reduce((total, value) => total + Math.max(0, value), 0);
  return Math.ceil(sum / active);
}
