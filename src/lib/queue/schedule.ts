/**
 * Weekly salon hours are wall-clock times in Asia/Kolkata, the same clock as `kolkataDayKey`.
 * Open and closed are computed when a request arrives. Nothing runs on a timer.
 * An owner override lasts only until the next session boundary.
 */
import { kolkataDayKey, kolkataDayStart } from "@/lib/queue/day";
import { kolkataClock, normalizeClock, parseOperatingHours, REQUEST_SLOT_EARLIEST, REQUEST_SLOT_LATEST } from "@/lib/queue/hours";

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type Session = { open: string; close: string };
export type WeekSchedule = Record<Weekday, Session[]>;

export const WEEK_HOURS_INVALID = "Each day is closed or has up to two sessions. Open must be before close, and sessions must not overlap.";

const DAY_SHORT: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export const DAY_LABELS: { id: Weekday; name: string }[] = [
  { id: "mon", name: "Monday" },
  { id: "tue", name: "Tuesday" },
  { id: "wed", name: "Wednesday" },
  { id: "thu", name: "Thursday" },
  { id: "fri", name: "Friday" },
  { id: "sat", name: "Saturday" },
  { id: "sun", name: "Sunday" },
];

const WEEKDAY_FROM_SHORT: Record<string, Weekday> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

export function emptyWeek(): WeekSchedule {
  return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
}

export function kolkataWeekday(now = new Date()): Weekday {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(now);
  return WEEKDAY_FROM_SHORT[name] ?? "mon";
}

/** Wall-clock HH:MM in Asia/Kolkata as a UTC instant. India has no daylight saving. */
export function atKolkata(dayKey: string, hhmm: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30));
}

export function shiftDayKey(dayKey: string, days: number) {
  const at = atKolkata(dayKey, "12:00");
  at.setUTCDate(at.getUTCDate() + days);
  return kolkataDayKey(at);
}

export function weekdayOfDayKey(dayKey: string): Weekday {
  return kolkataWeekday(atKolkata(dayKey, "12:00"));
}

export function formatClock(hhmm: string) {
  const [hourText, minute] = hhmm.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}:${minute} ${suffix}`;
}

export function formatSessions(sessions: Session[]) {
  if (!sessions.length) return "Closed";
  return sessions.map((session) => `${formatClock(session.open)}–${formatClock(session.close)}`).join(", ");
}

/** Close must be after open. A gap under an hour is almost always an AM/PM miss (10:00 vs 22:00). */
export function sessionSpanWarning(open: string, close: string) {
  if (!/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close)) return "";
  const minutes = (value: string) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };
  const span = minutes(close) - minutes(open);
  if (span <= 0) return `Close is ${formatClock(close)}, which is not after ${formatClock(open)}.`;
  if (span < 120) return `That is only ${span} minutes (${formatClock(open)} to ${formatClock(close)}). If you meant the evening, pick the PM time.`;
  return "";
}

/**
 * Ticking Closed stores no sessions but keeps the times on screen.
 * Unticking writes those same times back, not the 10:00–20:00 suggestion.
 */
export function hoursAfterClosedToggle(
  current: { open: string; close: string; open2: string; close2: string },
  closed: boolean,
) {
  if (closed) return { ...current, sessions: [] as Session[] };
  const open = current.open || SUGGESTED_OPEN;
  const close = current.close || SUGGESTED_CLOSE;
  const sessions: Session[] = [{ open, close }];
  if (current.open2 && current.close2) sessions.push({ open: current.open2, close: current.close2 });
  return { open, close, open2: current.open2, close2: current.close2, sessions };
}

export const SUGGESTED_OPEN = "10:00";
export const SUGGESTED_CLOSE = "20:00";

/** Shown before the owner saves hours. It is not stored and does not open or close the queue. */
export function suggestedWeek(): WeekSchedule {
  return weekFromPair(SUGGESTED_OPEN, SUGGESTED_CLOSE);
}

export function weekFromPair(open: string, close: string): WeekSchedule {
  const week = emptyWeek();
  for (const day of WEEKDAYS) week[day] = [{ open, close }];
  return week;
}

/** The shared session when every day has that one session. Mixed days return null. */
export function pairFromWeek(week: WeekSchedule): Session | null {
  const first = week.mon;
  if (first.length !== 1) return null;
  for (const day of WEEKDAYS) {
    const sessions = week[day];
    if (sessions.length !== 1 || sessions[0].open !== first[0].open || sessions[0].close !== first[0].close) return null;
  }
  return { open: first[0].open, close: first[0].close };
}

export function serializeWeek(week: WeekSchedule) {
  const ordered = emptyWeek();
  for (const day of WEEKDAYS) {
    ordered[day] = week[day].map((session) => ({ open: session.open, close: session.close }));
  }
  return JSON.stringify(ordered);
}

export function isUniform(week: WeekSchedule) {
  const first = JSON.stringify(week.mon);
  return WEEKDAYS.every((day) => JSON.stringify(week[day]) === first);
}

/** Up to two sessions. Empty fields mean no session. A half-filled session is invalid. */
export function compileSessions(open: string, close: string, open2 = "", close2 = ""):
  | { ok: true; sessions: Session[] }
  | { ok: false; message: string } {
  const pairs = [
    [normalizeClock(open), normalizeClock(close)],
    [normalizeClock(open2), normalizeClock(close2)],
  ];
  const sessions: Session[] = [];
  for (const [start, end] of pairs) {
    if (!start && !end) continue;
    if (!CLOCK.test(start) || !CLOCK.test(end) || start >= end) return { ok: false, message: WEEK_HOURS_INVALID };
    sessions.push({ open: start, close: end });
  }
  sessions.sort((a, b) => a.open.localeCompare(b.open));
  if (sessions.length === 2 && sessions[0].close > sessions[1].open) return { ok: false, message: WEEK_HOURS_INVALID };
  return { ok: true, sessions };
}

export function parseWeekSchedule(raw: unknown): { ok: true; week: WeekSchedule } | { ok: false; message: string } {
  let value = raw;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return { ok: false, message: WEEK_HOURS_INVALID };
    try {
      value = JSON.parse(text);
    } catch {
      return { ok: false, message: WEEK_HOURS_INVALID };
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, message: WEEK_HOURS_INVALID };
  const record = value as Record<string, unknown>;
  const week = emptyWeek();
  for (const day of WEEKDAYS) {
    if (!Object.prototype.hasOwnProperty.call(record, day)) return { ok: false, message: WEEK_HOURS_INVALID };
    const list = record[day];
    if (!Array.isArray(list) || list.length > 2) return { ok: false, message: WEEK_HOURS_INVALID };
    const compiled = compileSessions(
      sessionField(list[0], "open"),
      sessionField(list[0], "close"),
      sessionField(list[1], "open"),
      sessionField(list[1], "close"),
    );
    if (!compiled.ok) return compiled;
    if (compiled.sessions.length !== list.length) return { ok: false, message: WEEK_HOURS_INVALID };
    week[day] = compiled.sessions;
  }
  return { ok: true, week };
}

function sessionField(item: unknown, key: "open" | "close") {
  if (!item || typeof item !== "object") return "";
  const value = (item as Session)[key];
  return typeof value === "string" ? value : "";
}

export type HoursSource = {
  weeklyHours?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
};

/** A saved week wins. Otherwise a legacy open/close pair is one session every day. Both empty stays the fallback. */
export function effectiveWeek(source: HoursSource): { kind: "fallback" } | { kind: "week"; week: WeekSchedule } {
  const raw = (source.weeklyHours ?? "").trim();
  if (raw) {
    const parsed = parseWeekSchedule(raw);
    if (parsed.ok) return { kind: "week", week: parsed.week };
  }
  const legacy = parseOperatingHours(source.openTime, source.closeTime);
  if (legacy.kind === "custom") return { kind: "week", week: weekFromPair(legacy.open, legacy.close) };
  return { kind: "fallback" };
}

export function hoursWrite(input: { weeklyHours?: string | null; openTime?: string | null; closeTime?: string | null }):
  | { ok: true; weeklyHours: string; openTime: string; closeTime: string }
  | { ok: false; message: string } {
  const hasWeek = input.weeklyHours !== undefined && input.weeklyHours !== null;
  const weekText = (input.weeklyHours ?? "").trim();
  if (hasWeek && weekText) {
    const parsed = parseWeekSchedule(weekText);
    if (!parsed.ok) return parsed;
    const pair = pairFromWeek(parsed.week);
    return { ok: true, weeklyHours: serializeWeek(parsed.week), openTime: pair?.open ?? "", closeTime: pair?.close ?? "" };
  }
  if (input.openTime !== undefined || input.closeTime !== undefined || hasWeek) {
    const hours = parseOperatingHours(input.openTime ?? "", input.closeTime ?? "");
    if (hours.kind === "invalid") return { ok: false, message: hours.message };
    if (hours.kind === "custom") {
      return {
        ok: true,
        weeklyHours: serializeWeek(weekFromPair(hours.open, hours.close)),
        openTime: hours.open,
        closeTime: hours.close,
      };
    }
    return { ok: true, weeklyHours: "", openTime: "", closeTime: "" };
  }
  return { ok: true, weeklyHours: "", openTime: "", closeTime: "" };
}

export function requestBounds(source: HoursSource) {
  const week = effectiveWeek(source);
  if (week.kind === "fallback") return { open: REQUEST_SLOT_EARLIEST, close: REQUEST_SLOT_LATEST };
  let open = "23:59";
  let close = "00:00";
  let any = false;
  for (const day of WEEKDAYS) {
    for (const session of week.week[day]) {
      any = true;
      if (session.open < open) open = session.open;
      if (session.close > close) close = session.close;
    }
  }
  if (!any) return { open: REQUEST_SLOT_EARLIEST, close: REQUEST_SLOT_LATEST };
  return { open, close };
}

export function slotProblem(source: HoursSource, date: string, slot: string) {
  const week = effectiveWeek(source);
  if (week.kind === "fallback") {
    if (slot < REQUEST_SLOT_EARLIEST || slot > REQUEST_SLOT_LATEST) {
      return `Choose a time between ${REQUEST_SLOT_EARLIEST} and ${REQUEST_SLOT_LATEST}.`;
    }
    return null;
  }
  const sessions = week.week[weekdayOfDayKey(date)];
  if (!sessions.length) return "The salon is closed that day.";
  if (sessions.some((session) => slot >= session.open && slot <= session.close)) return null;
  if (sessions.length === 1) return `Choose a time between ${sessions[0].open} and ${sessions[0].close}.`;
  return `Choose a time between ${sessions[0].open} and ${sessions[0].close} or ${sessions[1].open} and ${sessions[1].close}.`;
}

export function clockInSessions(sessions: Session[], clock: string) {
  return sessions.some((session) => clock >= session.open && clock <= session.close);
}

export function openSession(sessions: Session[], clock: string) {
  return sessions.find((session) => clock >= session.open && clock <= session.close) ?? null;
}

/** The next session open or close after `now`, or the next Kolkata midnight when the week has no sessions. */
export function nextBoundary(week: WeekSchedule, now: Date) {
  const today = kolkataDayKey(now);
  let best: Date | null = null;
  for (let offset = 0; offset < 8; offset += 1) {
    const dayKey = shiftDayKey(today, offset);
    for (const session of week[weekdayOfDayKey(dayKey)]) {
      for (const stamp of [session.open, session.close]) {
        const at = atKolkata(dayKey, stamp);
        if (at.getTime() > now.getTime() && (!best || at.getTime() < best.getTime())) best = at;
      }
    }
  }
  if (best) return best;
  return new Date(kolkataDayStart(now).getTime() + 24 * 60 * 60 * 1000);
}

export function nextOpening(week: WeekSchedule, now: Date) {
  const today = kolkataDayKey(now);
  for (let offset = 0; offset < 8; offset += 1) {
    const dayKey = shiftDayKey(today, offset);
    for (const session of week[weekdayOfDayKey(dayKey)]) {
      const at = atKolkata(dayKey, session.open);
      if (at.getTime() <= now.getTime()) continue;
      return { dayKey, time: session.open, label: openingLabel(today, dayKey, session.open) };
    }
  }
  return null;
}

function openingLabel(today: string, dayKey: string, hhmm: string) {
  const clock = formatClock(hhmm);
  if (dayKey === today) return clock;
  if (dayKey === shiftDayKey(today, 1)) return `tomorrow ${clock}`;
  return `${DAY_SHORT[weekdayOfDayKey(dayKey)]} ${clock}`;
}

export type HoursTenant = HoursSource & {
  hoursOverride?: string | null;
  hoursOverrideUntil?: Date | string | null;
  closedDayKey?: string | null;
};

export type HoursView = {
  scheduled: boolean;
  accepting: boolean;
  label: string;
  closedToday: boolean;
  todayHours: string;
  nextOpen: string;
  hoursMessage: string;
  hoursOpen: string;
  hoursClose: string;
};

/** What the desk and the guest see at `now`. Existing tokens are not touched here. */
export function hoursView(tenant: HoursTenant, isOpen: boolean, now = new Date()): HoursView {
  const dayKey = kolkataDayKey(now);
  const holiday = (tenant.closedDayKey || "") === dayKey;
  const week = effectiveWeek(tenant);
  const bounds = requestBounds(tenant);
  if (week.kind === "fallback") {
    const accepting = isOpen && !holiday;
    return {
      scheduled: false,
      accepting,
      label: holiday ? "Closed today" : isOpen ? "Open" : "Closed",
      closedToday: holiday,
      todayHours: "",
      nextOpen: "",
      hoursMessage: holiday ? "This salon is closed today." : isOpen ? "" : "The queue is paused. Please ask at the desk.",
      hoursOpen: bounds.open,
      hoursClose: bounds.close,
    };
  }

  const clock = kolkataClock(now);
  const todaySessions = week.week[kolkataWeekday(now)];
  const inside = clockInSessions(todaySessions, clock);
  const override = tenant.hoursOverride === "open" || tenant.hoursOverride === "closed" ? tenant.hoursOverride : "";
  const until = tenant.hoursOverrideUntil ? new Date(tenant.hoursOverrideUntil) : null;
  const overrideOn = Boolean(override && until && !Number.isNaN(until.getTime()) && now.getTime() < until.getTime());
  let accepting = inside;
  if (overrideOn && override === "open") accepting = true;
  if (overrideOn && override === "closed") accepting = false;
  if (holiday) accepting = false;
  const late = accepting && !inside && !holiday;
  const next = nextOpening(week.week, now);
  const current = openSession(todaySessions, clock);
  let label = "Closed";
  if (holiday) label = "Closed today";
  else if (late) label = "Open late (you)";
  else if (accepting && current) label = `Open until ${formatClock(current.close)}`;
  else if (next) label = `Closed · opens ${next.label}`;

  let hoursMessage = "";
  if (!accepting) {
    if (holiday || todaySessions.length === 0) hoursMessage = "This salon is closed today.";
    else if (overrideOn && override === "closed" && inside) hoursMessage = "The queue is paused. Please ask at the desk.";
    else if (todaySessions.length === 1) {
      hoursMessage = `This salon takes queue joins from ${formatClock(todaySessions[0].open)} to ${formatClock(todaySessions[0].close)} India time.`;
    } else {
      hoursMessage = `This salon takes queue joins from ${formatClock(todaySessions[0].open)} to ${formatClock(todaySessions[0].close)} and ${formatClock(todaySessions[1].open)} to ${formatClock(todaySessions[1].close)} India time.`;
    }
  }

  return {
    scheduled: true,
    accepting,
    label,
    closedToday: holiday,
    todayHours: holiday ? "Closed" : formatSessions(todaySessions),
    nextOpen: !accepting && next ? next.label : "",
    hoursMessage,
    hoursOpen: bounds.open,
    hoursClose: bounds.close,
  };
}
