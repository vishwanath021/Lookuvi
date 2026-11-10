import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { kolkataDayKey } from "@/lib/queue/day";
import {
  WEEK_HOURS_INVALID,
  atKolkata,
  compileSessions,
  effectiveWeek,
  formatClock,
  hoursView,
  hoursWrite,
  nextBoundary,
  parseWeekSchedule,
  serializeWeek,
  weekFromPair,
} from "@/lib/queue/schedule";
import { addWalkIn, deskSnapshot, joinQueue, saveQueueSettings, setClosedToday, setQueueOpen } from "@/lib/queue/service";
import { resetRateLimits } from "@/lib/ratelimit";

const send = vi.fn(async () => ({ ok: true as const, provider: "log" }));
const tenants: string[] = [];

function tag() {
  return Math.random().toString(36).slice(2, 10);
}

function phone() {
  return `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
}

/** A future Kolkata weekday, so a fixed calendar date does not become "yesterday". */
function upcomingWeekday(target: "Sun" | "Tue") {
  const start = Date.now();
  for (let offset = 1; offset <= 14; offset += 1) {
    const at = new Date(start + offset * 24 * 60 * 60 * 1000);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(at);
    if (weekday === target) return kolkataDayKey(at);
  }
  throw new Error(`No upcoming ${target}`);
}

const SPLIT = weekFromPair("09:00", "13:00");
SPLIT.mon = [{ open: "09:00", close: "13:00" }, { open: "16:00", close: "21:00" }];
SPLIT.tue = [{ open: "09:00", close: "13:00" }, { open: "16:00", close: "21:00" }];
SPLIT.sun = [];

const noon = new Date("2026-06-01T06:30:00.000Z");
const gap = new Date("2026-06-01T08:30:00.000Z");
const evening = new Date("2026-06-01T12:00:00.000Z");
const afterClose = new Date("2026-06-01T15:31:00.000Z");
const mondayMidnight = new Date("2026-06-01T18:30:00.000Z");
const sundayLate = new Date("2026-05-31T18:29:00.000Z");

async function salon(mode: "LIVE" | "REQUEST" = "LIVE") {
  const tenant = await prisma.tenant.create({
    data: { slug: `week-${tag()}`, name: "Week salon", productQueue: true, weeklyHours: serializeWeek(SPLIT) },
  });
  tenants.push(tenant.id);
  await prisma.queueState.create({
    data: { tenantId: tenant.id, isOpen: true, units: 1, avgMinutes: 20, alertLeadMin: -1, mode, unitLabel: "chair" },
  });
  return tenant;
}

afterEach(async () => {
  resetRateLimits();
  send.mockClear();
  if (tenants.length) {
    await prisma.queueEntry.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.queueState.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenants.splice(0) } } });
  }
});

describe("weekly sessions", () => {
  it("rejects overlap, a third session, and a clock that is not 24-hour", () => {
    expect(compileSessions("18:00", "09:00").ok).toBe(false);
    expect(compileSessions("10:00", "10:00").ok).toBe(false);
    expect(compileSessions("23:00", "24:00").ok).toBe(false);
    expect(compileSessions("09:00", "13:00", "12:00", "15:00")).toMatchObject({ ok: false, message: WEEK_HOURS_INVALID });
    expect(compileSessions("09:00", "13:00", "13:00", "17:00")).toMatchObject({
      ok: true,
      sessions: [{ open: "09:00", close: "13:00" }, { open: "13:00", close: "17:00" }],
    });
    const raw = serializeWeek(SPLIT);
    const parsed = JSON.parse(raw) as { mon: unknown[] };
    parsed.mon.push({ open: "21:30", close: "22:00" });
    expect(parseWeekSchedule(JSON.stringify(parsed)).ok).toBe(false);
    expect(parseWeekSchedule("{").ok).toBe(false);
  });

  it("turns a legacy open/close pair into one session every day and leaves an empty pair as the fallback", () => {
    const written = hoursWrite({ openTime: "10:00", closeTime: "18:00" });
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    expect(written.openTime).toBe("10:00");
    expect(written.closeTime).toBe("18:00");
    const week = effectiveWeek({ weeklyHours: written.weeklyHours });
    expect(week.kind).toBe("week");
    if (week.kind !== "week") return;
    expect(week.week.sun).toEqual([{ open: "10:00", close: "18:00" }]);
    expect(week.week.wed).toEqual([{ open: "10:00", close: "18:00" }]);
    expect(effectiveWeek({ weeklyHours: "", openTime: "", closeTime: "" })).toEqual({ kind: "fallback" });
    expect(hoursView({ weeklyHours: "", openTime: "", closeTime: "" }, true, noon).label).toBe("Open");
    expect(hoursView({ openTime: "10:00", closeTime: "18:00" }, true, noon)).toMatchObject({
      scheduled: true,
      accepting: true,
      label: "Open until 6:00 PM",
    });
  });

  it("names the desk state across a session gap, midnight, and the next morning", () => {
    const source = { weeklyHours: serializeWeek(SPLIT) };
    expect(kolkataDayKey(noon)).toBe("2026-06-01");
    expect(hoursView(source, true, noon)).toMatchObject({
      accepting: true,
      label: "Open until 1:00 PM",
      todayHours: "9:00 AM–1:00 PM, 4:00 PM–9:00 PM",
    });
    expect(hoursView(source, true, gap)).toMatchObject({
      accepting: false,
      label: "Closed · opens 4:00 PM",
      nextOpen: "4:00 PM",
    });
    expect(hoursView(source, true, evening).label).toBe("Open until 9:00 PM");
    expect(hoursView(source, true, afterClose)).toMatchObject({
      accepting: false,
      label: "Closed · opens tomorrow 9:00 AM",
      nextOpen: "tomorrow 9:00 AM",
    });
    expect(hoursView(source, true, sundayLate)).toMatchObject({
      accepting: false,
      label: "Closed · opens tomorrow 9:00 AM",
      todayHours: "Closed",
    });
    expect(hoursView(source, true, mondayMidnight)).toMatchObject({
      accepting: false,
      label: "Closed · opens 9:00 AM",
    });
    expect(formatClock("00:00")).toBe("12:00 AM");
    expect(formatClock("12:00")).toBe("12:00 PM");
  });

  it("keeps an override only until the next session boundary", () => {
    const source = { weeklyHours: serializeWeek(SPLIT) };
    const week = effectiveWeek(source);
    if (week.kind !== "week") throw new Error("expected a week");
    expect(nextBoundary(week.week, noon).toISOString()).toBe(atKolkata("2026-06-01", "13:00").toISOString());
    expect(nextBoundary(week.week, gap).toISOString()).toBe(atKolkata("2026-06-01", "16:00").toISOString());
    expect(nextBoundary(week.week, sundayLate).toISOString()).toBe(atKolkata("2026-06-01", "09:00").toISOString());

    const closedEarly = hoursView({
      ...source,
      hoursOverride: "closed",
      hoursOverrideUntil: atKolkata("2026-06-01", "13:00"),
    }, false, noon);
    expect(closedEarly).toMatchObject({ accepting: false, label: "Closed · opens 4:00 PM" });
    expect(closedEarly.hoursMessage).toMatch(/paused/);

    const expired = hoursView({
      ...source,
      hoursOverride: "closed",
      hoursOverrideUntil: atKolkata("2026-06-01", "13:00"),
    }, false, gap);
    expect(expired.accepting).toBe(false);
    expect(expired.hoursMessage).toMatch(/9:00 AM to 1:00 PM and 4:00 PM to 9:00 PM/);

    expect(hoursView({
      ...source,
      hoursOverride: "open",
      hoursOverrideUntil: atKolkata("2026-06-01", "16:00"),
    }, true, gap)).toMatchObject({ accepting: true, label: "Open late (you)" });

    expect(hoursView({
      ...source,
      hoursOverride: "open",
      hoursOverrideUntil: atKolkata("2026-06-01", "16:00"),
    }, true, evening)).toMatchObject({ accepting: true, label: "Open until 9:00 PM" });
  });

  it("blocks new joins outside a session, keeps the waiting token, and lets the owner open late", async () => {
    const tenant = await salon();
    const joined = await joinQueue({
      slug: tenant.slug, name: "Nila", phone: phone(), consent: true, ip: `w-${tag()}`, send, now: noon,
    });
    expect(joined.status).toBe("WAITING");
    await expect(joinQueue({
      slug: tenant.slug, name: "Aarav", phone: phone(), consent: true, ip: `w-${tag()}`, send, now: gap,
    })).rejects.toThrow(/9:00 AM to 1:00 PM and 4:00 PM to 9:00 PM/);
    const duringGap = await deskSnapshot(tenant.id, gap);
    expect(duringGap.waiting.map((card) => card.name)).toEqual(["Nila"]);
    expect(duringGap.state.hoursLabel).toBe("Closed · opens 4:00 PM");

    const late = await setQueueOpen(tenant.id, true, gap);
    expect(late.state.hoursLabel).toBe("Open late (you)");
    const walked = await joinQueue({
      slug: tenant.slug, name: "Meera", phone: phone(), consent: true, ip: `w-${tag()}`, send, now: gap,
    });
    expect(walked.status).toBe("WAITING");

    const early = await setQueueOpen(tenant.id, false, noon);
    expect(early.state.hoursLabel).toBe("Closed · opens 4:00 PM");
    await expect(joinQueue({
      slug: tenant.slug, name: "Dev", phone: phone(), consent: true, ip: `w-${tag()}`, send, now: noon,
    })).rejects.toThrow(/paused/);
    const desk = await addWalkIn(tenant.id, { name: "Desk" }, send);
    expect(desk.waiting.some((card) => card.name === "Desk")).toBe(true);
  });

  it("closes today without dropping the line, and opens again on undo", async () => {
    const tenant = await salon();
    await joinQueue({
      slug: tenant.slug, name: "Nila", phone: phone(), consent: true, ip: `h-${tag()}`, send, now: noon,
    });
    const closed = await setClosedToday(tenant.id, true, noon);
    expect(closed.state).toMatchObject({ hoursLabel: "Closed today", closedToday: true, isOpen: false });
    expect(closed.waiting.map((card) => card.name)).toEqual(["Nila"]);
    await expect(joinQueue({
      slug: tenant.slug, name: "Aarav", phone: phone(), consent: true, ip: `h-${tag()}`, send, now: noon,
    })).rejects.toThrow(/closed today/);
    const back = await setClosedToday(tenant.id, false, noon);
    expect(back.state.hoursLabel).toBe("Open until 1:00 PM");
    expect(back.state.isOpen).toBe(true);
  });

  it("accepts a request only inside that day's sessions", async () => {
    const tenant = await salon("REQUEST");
    await saveQueueSettings(tenant.id, { units: 1, avgMinutes: 20, alertLeadMin: 5, mode: "REQUEST", unitLabel: "chair" });
    const tuesday = upcomingWeekday("Tue");
    const sunday = upcomingWeekday("Sun");
    await expect(joinQueue({
      slug: tenant.slug, name: "Gap", phone: phone(), consent: true,
      requestedDate: tuesday, requestedSlot: "14:00", ip: `r-${tag()}`, send,
    })).rejects.toThrow(/09:00 and 13:00 or 16:00 and 21:00/);
    const afternoon = await joinQueue({
      slug: tenant.slug, name: "Afternoon", phone: phone(), consent: true,
      requestedDate: tuesday, requestedSlot: "17:00", ip: `r-${tag()}`, send,
    });
    expect(afternoon.requestedSlot).toBe("17:00");
    await expect(joinQueue({
      slug: tenant.slug, name: "Sunday", phone: phone(), consent: true,
      requestedDate: sunday, requestedSlot: "11:00", ip: `r-${tag()}`, send,
    })).rejects.toThrow(/closed that day/);
    const today = kolkataDayKey();
    await prisma.tenant.update({ where: { id: tenant.id }, data: { closedDayKey: today } });
    await expect(joinQueue({
      slug: tenant.slug, name: "Holiday", phone: phone(), consent: true,
      requestedDate: today, requestedSlot: "10:00", ip: `r-${tag()}`, send,
    })).rejects.toThrow(/closed today/);
  });
});
