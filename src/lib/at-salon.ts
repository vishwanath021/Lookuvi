import { AI_PREVIEW_KINDS } from "@/lib/preview-access";
import { prisma } from "@/lib/prisma";
import { kolkataDayKey } from "@/lib/queue/day";
import { unlockVisit } from "@/lib/visit-allowance";
import { VISIT_CAP_MESSAGE, VISIT_TRY_KINDS } from "@/lib/visit-tries";

export const NOT_AT_SALON_MESSAGE =
  "Your free AI preview unlocks when you reach the salon.";

export const TRY_ADD_MIN = 1;
export const TRY_ADD_MAX = 9;
export const ASK_WAIT_MS = 2 * 60 * 1000;

type SalonFlag = { id: string; tryOnsAtSalon: boolean; visitTryLimit: number };

function cleanId(value: string | undefined | null) {
  return (value || "").trim().slice(0, 80);
}

export function tryAddAmount(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  if (!Number.isInteger(number) || number < TRY_ADD_MIN || number > TRY_ADD_MAX) return null;
  return number;
}

async function grantPresence(tenantId: string, dayKey: string, source: string, pairs: { kind: string; value: string }[]) {
  for (const pair of pairs) {
    const value = pair.value.trim();
    if (value.length < 8) continue;
    await prisma.salonDayUnlock.upsert({
      where: { tenantId_dayKey_kind_value: { tenantId, dayKey, kind: pair.kind, value } },
      create: { tenantId, dayKey, kind: pair.kind, value, source },
      update: {},
    });
  }
}

export async function findTodayEntry(tenantId: string, sessionId: string, deviceId: string, now = new Date()) {
  const dayKey = kolkataDayKey(now);
  const session = cleanId(sessionId);
  const device = cleanId(deviceId);
  const or = [];
  if (session.length >= 8) {
    or.push({ sessionId: session });
    or.push({ sessions: { some: { sessionId: session } } });
  }
  if (device.length >= 8) or.push({ deviceId: device });
  if (!or.length) return null;
  return prisma.queueEntry.findFirst({
    where: { tenantId, dayKey, OR: or },
    orderBy: { joinedAt: "desc" },
  });
}

export async function linkSessionToEntry(entryId: string, sessionId: string, deviceId: string, now = new Date()) {
  const session = cleanId(sessionId);
  const device = cleanId(deviceId);
  if (session.length < 8) return;
  const entry = await prisma.queueEntry.findUnique({ where: { id: entryId } });
  if (!entry) return;
  await prisma.queueSession.upsert({
    where: { entryId_sessionId: { entryId, sessionId: session } },
    create: { entryId, sessionId: session },
    update: {},
  });
  const data: { sessionId?: string; deviceId?: string } = {};
  if (!entry.sessionId) data.sessionId = session;
  if (device.length >= 8 && !entry.deviceId) data.deviceId = device;
  if (Object.keys(data).length) await prisma.queueEntry.update({ where: { id: entryId }, data });
  const dayKey = kolkataDayKey(now);
  if (entry.arrivedAt && kolkataDayKey(entry.arrivedAt) === dayKey) {
    await grantPresence(entry.tenantId, dayKey, "arrived", [
      { kind: "session", value: session },
      { kind: "device", value: device },
      { kind: "phone", value: entry.phone },
    ]);
  }
}

export async function attachGuest(tenantId: string, sessionId: string, deviceId: string, now = new Date()) {
  const entry = await findTodayEntry(tenantId, sessionId, deviceId, now);
  if (!entry) return null;
  await linkSessionToEntry(entry.id, sessionId, deviceId, now);
  return prisma.queueEntry.findUnique({ where: { id: entry.id } });
}

export async function bindTicket(input: { slug: string; ref: string; sessionId: string; deviceId?: string; now?: Date }) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: input.slug } });
  if (!tenant || tenant.deletedAt || !tenant.productQueue) {
    return { ok: false as const, code: "PRODUCT", message: "The queue is not available for this salon.", status: 404 };
  }
  const row = await prisma.queueEntry.findFirst({ where: { cancelToken: input.ref, tenantId: tenant.id } });
  if (!row) return { ok: false as const, code: "NOT_FOUND", message: "That visit was not found.", status: 404 };
  if (cleanId(input.sessionId).length < 8) {
    return { ok: false as const, code: "INVALID", message: "Session is required.", status: 400 };
  }
  await linkSessionToEntry(row.id, input.sessionId, input.deviceId || "", input.now);
  return { ok: true as const };
}

async function sessionIdsFor(entryId: string, sessionId: string) {
  const links = await prisma.queueSession.findMany({ where: { entryId }, select: { sessionId: true } });
  const ids = new Set<string>();
  if (sessionId.length >= 8) ids.add(sessionId);
  for (const link of links) if (link.sessionId.length >= 8) ids.add(link.sessionId);
  const entry = await prisma.queueEntry.findUnique({ where: { id: entryId }, select: { sessionId: true } });
  if (entry && entry.sessionId.length >= 8) ids.add(entry.sessionId);
  return [...ids];
}

export async function visitBudget(args: {
  tenantId: string;
  sessionId: string;
  deviceId?: string;
  limit: number;
  kinds: readonly string[];
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const entry = await findTodayEntry(args.tenantId, args.sessionId, args.deviceId || "", now);
  const ids = entry ? await sessionIdsFor(entry.id, args.sessionId) : args.sessionId.length >= 8 ? [args.sessionId] : [];
  const [used, grants] = await Promise.all([
    ids.length
      ? prisma.tryOn.count({
          where: { tenantId: args.tenantId, sessionId: { in: ids }, status: "SUCCEEDED", kind: { in: [...args.kinds] } },
        })
      : Promise.resolve(0),
    ids.length
      ? prisma.visitGrant.findMany({ where: { tenantId: args.tenantId, sessionId: { in: ids } }, select: { bonus: true } })
      : Promise.resolve([]),
  ]);
  const bonus = grants.reduce((sum, row) => sum + row.bonus, 0);
  const allowance = Math.max(0, args.limit) + Math.max(0, bonus);
  return {
    used,
    allowance,
    remaining: Math.max(0, allowance - used),
    allowed: used < allowance,
    entry,
  };
}

export async function isAtSalon(args: {
  tenant: { id: string; tryOnsAtSalon: boolean };
  sessionId: string;
  deviceId?: string;
  phone?: string;
  bypass?: boolean;
  now?: Date;
}) {
  if (!args.tenant.tryOnsAtSalon || args.bypass) return true;
  const now = args.now ?? new Date();
  const dayKey = kolkataDayKey(now);
  const values = [args.sessionId, args.deviceId || "", args.phone || ""].map((value) => value.trim()).filter((value) => value.length >= 8);
  if (values.length) {
    const hit = await prisma.salonDayUnlock.findFirst({
      where: { tenantId: args.tenant.id, dayKey, value: { in: values } },
      select: { id: true },
    });
    if (hit) return true;
  }
  const entry = await findTodayEntry(args.tenant.id, args.sessionId, args.deviceId || "", now);
  return Boolean(entry?.arrivedAt && kolkataDayKey(entry.arrivedAt) === dayKey);
}

export async function refuseAtSalon(args: {
  tenant: { id: string; tryOnsAtSalon: boolean };
  sessionId: string;
  deviceId?: string;
  phone?: string;
  bypass?: boolean;
  now?: Date;
}) {
  if (await isAtSalon(args)) return null;
  return { error: "NOT_AT_SALON" as const, message: NOT_AT_SALON_MESSAGE };
}

export async function blockPaidVisit(args: {
  tenant: SalonFlag;
  sessionId: string;
  deviceId?: string;
  phone?: string;
  bypass?: boolean;
  /** This call spends one of the visit's free tries when the salon lock is on. */
  countsAsTry: boolean;
  /** Bridal, groom, and makeup keep the visit cap even when the lock is off. */
  legacyVisit: boolean;
  now?: Date;
}) {
  if (args.sessionId.length >= 8) await attachGuest(args.tenant.id, args.sessionId, args.deviceId || "", args.now);
  if (!args.bypass) {
    const away = await refuseAtSalon(args);
    if (away) return { ...away, status: 403 as const };
  }
  const enforce = args.tenant.tryOnsAtSalon ? args.countsAsTry : args.legacyVisit;
  if (!enforce) return null;
  if (args.tenant.tryOnsAtSalon) {
    const budget = await visitBudget({
      tenantId: args.tenant.id,
      sessionId: args.sessionId,
      deviceId: args.deviceId,
      limit: args.tenant.visitTryLimit,
      kinds: AI_PREVIEW_KINDS,
      now: args.now,
    });
    if (!budget.allowed) {
      return { error: "VISIT_CAP" as const, message: VISIT_CAP_MESSAGE, used: budget.used, allowance: budget.allowance, status: 429 as const };
    }
    return null;
  }
  const { refuseVisit } = await import("@/lib/visit-allowance");
  const blocked = await refuseVisit(args.tenant.id, args.sessionId, args.tenant.visitTryLimit, VISIT_TRY_KINDS);
  if (!blocked) return null;
  return { ...blocked, status: 429 as const };
}

export async function stampPaidVisit(
  response: { headers: { set: (name: string, value: string) => void } },
  tenant: SalonFlag,
  sessionId: string,
  deviceId: string,
  photoId: string,
  legacyVisit: boolean,
) {
  if (!tenant.tryOnsAtSalon && !legacyVisit) return response;
  if (tenant.tryOnsAtSalon) {
    const budget = await visitBudget({
      tenantId: tenant.id,
      sessionId,
      deviceId,
      limit: tenant.visitTryLimit,
      kinds: AI_PREVIEW_KINDS,
    });
    response.headers.set("x-photo-id", photoId);
    response.headers.set("x-visit-used", String(budget.used));
    response.headers.set("x-visit-limit", String(budget.allowance));
    return response;
  }
  const { stampVisit } = await import("@/lib/visit-allowance");
  return stampVisit(response, tenant.id, sessionId, tenant.visitTryLimit, photoId);
}

export async function markArrived(tenantId: string, entryId: string, now = new Date()) {
  const row = await prisma.queueEntry.findFirst({ where: { id: entryId, tenantId } });
  if (!row) return { ok: false as const, message: "That guest was not found.", status: 404 };
  if (row.status === "DONE" || row.status === "NO_SHOW" || row.status === "CANCELLED") {
    return { ok: false as const, message: "That visit is already closed.", status: 409 };
  }
  const dayKey = kolkataDayKey(now);
  if (row.dayKey !== dayKey && row.requestedDate !== dayKey) {
    return { ok: false as const, message: "That visit is not today.", status: 409 };
  }
  const arrivedAt = row.arrivedAt && kolkataDayKey(row.arrivedAt) === dayKey ? row.arrivedAt : now;
  await prisma.queueEntry.update({ where: { id: row.id }, data: { arrivedAt } });
  const sessions = await prisma.queueSession.findMany({ where: { entryId: row.id }, select: { sessionId: true } });
  await grantPresence(tenantId, dayKey, "arrived", [
    { kind: "session", value: row.sessionId },
    { kind: "device", value: row.deviceId },
    { kind: "phone", value: row.phone },
    ...sessions.map((item) => ({ kind: "session", value: item.sessionId })),
  ]);
  return { ok: true as const };
}

export async function grantTries(tenantId: string, entryId: string, extra: unknown, now = new Date()) {
  const amount = tryAddAmount(extra);
  if (amount == null) return { ok: false as const, message: "Add a whole number from 1 to 9.", status: 400 };
  const row = await prisma.queueEntry.findFirst({ where: { id: entryId, tenantId } });
  if (!row) return { ok: false as const, message: "That guest was not found.", status: 404 };
  const dayKey = kolkataDayKey(now);
  if (!row.arrivedAt || kolkataDayKey(row.arrivedAt) !== dayKey) {
    return { ok: false as const, message: "Mark the guest arrived before adding tries.", status: 409 };
  }
  let sessionId = row.sessionId;
  if (sessionId.length < 8) {
    const link = await prisma.queueSession.findFirst({ where: { entryId: row.id }, select: { sessionId: true } });
    sessionId = link?.sessionId || `queue-${row.id}`;
  }
  await unlockVisit(tenantId, sessionId, amount);
  if (row.sessionId !== sessionId) {
    await prisma.queueEntry.update({ where: { id: row.id }, data: { sessionId } });
    await prisma.queueSession.upsert({
      where: { entryId_sessionId: { entryId: row.id, sessionId } },
      create: { entryId: row.id, sessionId },
      update: {},
    });
  }
  await prisma.queueEntry.update({
    where: { id: row.id },
    data: { wantsTriesAt: null, lastGrant: amount, lastGrantAt: now },
  });
  return { ok: true as const, added: amount };
}

export async function dismissAsk(tenantId: string, entryId: string) {
  const result = await prisma.queueEntry.updateMany({ where: { id: entryId, tenantId }, data: { wantsTriesAt: null } });
  if (!result.count) return { ok: false as const, message: "That guest was not found.", status: 404 };
  return { ok: true as const };
}

export async function askMoreTries(tenantId: string, sessionId: string, deviceId: string, now = new Date()) {
  const entry = await findTodayEntry(tenantId, sessionId, deviceId, now);
  const dayKey = kolkataDayKey(now);
  if (!entry || !entry.arrivedAt || kolkataDayKey(entry.arrivedAt) !== dayKey) {
    return { ok: false as const, error: "NOT_LINKED", message: "Join the queue so staff can add tries.", status: 409 };
  }
  if (entry.wantsTriesAt && now.getTime() - entry.wantsTriesAt.getTime() < ASK_WAIT_MS) {
    return { ok: false as const, error: "WAIT", message: "Please wait a moment before asking again.", status: 429 };
  }
  await linkSessionToEntry(entry.id, sessionId, deviceId, now);
  await prisma.queueEntry.update({ where: { id: entry.id }, data: { wantsTriesAt: now } });
  return { ok: true as const };
}

export async function atSalonView(args: {
  tenant: SalonFlag;
  sessionId: string;
  deviceId?: string;
  phone?: string;
  bypass?: boolean;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  if (args.sessionId.length >= 8) await attachGuest(args.tenant.id, args.sessionId, args.deviceId || "", now);
  const required = args.tenant.tryOnsAtSalon && !args.bypass;
  const unlocked = await isAtSalon({ ...args, bypass: args.bypass, now });
  const budget = args.tenant.tryOnsAtSalon
    ? await visitBudget({
        tenantId: args.tenant.id,
        sessionId: args.sessionId,
        deviceId: args.deviceId,
        limit: args.tenant.visitTryLimit,
        kinds: AI_PREVIEW_KINDS,
        now,
      })
    : null;
  const entry = budget?.entry || (await findTodayEntry(args.tenant.id, args.sessionId, args.deviceId || "", now));
  const staffAdded = entry?.lastGrant && entry.lastGrantAt && kolkataDayKey(entry.lastGrantAt) === kolkataDayKey(now) ? entry.lastGrant : 0;
  const askWait = Boolean(entry?.wantsTriesAt && now.getTime() - entry.wantsTriesAt.getTime() < ASK_WAIT_MS);
  return {
    required,
    unlocked,
    used: budget?.used ?? 0,
    allowance: budget?.allowance ?? args.tenant.visitTryLimit,
    remaining: budget?.remaining ?? args.tenant.visitTryLimit,
    staffAdded,
    askWait,
  };
}

export async function tryLineForEntry(
  entry: { id: string; sessionId: string; arrivedAt: Date | null; wantsTriesAt: Date | null },
  tenant: SalonFlag,
  now = new Date(),
) {
  const dayKey = kolkataDayKey(now);
  const arrived = Boolean(entry.arrivedAt && kolkataDayKey(entry.arrivedAt) === dayKey);
  const kinds = tenant.tryOnsAtSalon ? AI_PREVIEW_KINDS : VISIT_TRY_KINDS;
  const ids = await sessionIdsFor(entry.id, entry.sessionId);
  const [used, grants] = await Promise.all([
    ids.length
      ? prisma.tryOn.count({
          where: { tenantId: tenant.id, sessionId: { in: ids }, status: "SUCCEEDED", kind: { in: [...kinds] } },
        })
      : Promise.resolve(0),
    ids.length
      ? prisma.visitGrant.findMany({ where: { tenantId: tenant.id, sessionId: { in: ids } }, select: { bonus: true } })
      : Promise.resolve([]),
  ]);
  const bonus = grants.reduce((sum, row) => sum + row.bonus, 0);
  const allowance = Math.max(0, tenant.visitTryLimit) + bonus;
  return {
    arrived,
    wantsTries: Boolean(entry.wantsTriesAt),
    used,
    remaining: Math.max(0, allowance - used),
  };
}
