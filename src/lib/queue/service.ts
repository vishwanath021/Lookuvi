import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sharedRateLimit } from "@/lib/ratelimit";
import { notifyGuest, type NotifyMessage, type NotifyResult } from "@/lib/notify";
import { kolkataDayKey } from "@/lib/queue/day";
import { effectiveWeek, hoursView, nextBoundary, slotProblem, type HoursTenant } from "@/lib/queue/schedule";
import { peopleAhead, serviceMinutes, waitMinutes, type WaitRow } from "@/lib/queue/estimate";
import { attributeReturn, recordVisit, rememberCustomer } from "@/lib/customers/service";
import { bindTicket, linkSessionToEntry, tryLineForEntry } from "@/lib/at-salon";
import { earnVisitPoints, listRewards, LoyaltyError, pointsBalance, pointsBalanceLine, pointsBalances, redeemReward, rewardProgress } from "@/lib/loyalty";
import { almostMessage, confirmedMessage, deskWhatsAppText, joinedMessage, queueHomeUrl, statusPath, statusUrl, tryOnUrl } from "@/lib/queue/messages";
import { indianMobile } from "@/lib/queue/phone";

export class QueueError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

type Sender = (message: NotifyMessage) => Promise<NotifyResult>;

/** One salon Wi-Fi can admit a full hour of guests. Abuse is limited per phone and per device. */
export const QUEUE_IP_JOINS_PER_HOUR = 60;
export const QUEUE_PHONE_JOINS_PER_HOUR = 4;
export const QUEUE_DEVICE_JOINS_PER_HOUR = 8;
export const QUEUE_JOIN_RATE_MESSAGE = "Too many joins from this phone or device this hour. Wait and try again. This is not about free chairs.";
const HOUR_MS = 60 * 60 * 1000;
export { REQUEST_SLOT_EARLIEST, REQUEST_SLOT_LATEST } from "@/lib/queue/hours";

const LIVE_ACTIVE = ["WAITING", "CALLED", "IN_SERVICE"];
const REQUEST_ACTIVE = ["REQUESTED", "CONFIRMED"];

type EntryRow = {
  id: string;
  tenantId: string;
  dayKey: string;
  token: number;
  name: string;
  phone: string;
  serviceId: string | null;
  status: string;
  source: string;
  unitSlot: number | null;
  joinedAt: Date;
  calledAt: Date | null;
  startedAt: Date | null;
  requestedDate: string;
  requestedSlot: string;
  alertSentAt: Date | null;
  cancelToken: string;
  onTheWay: boolean;
  sessionId: string;
  deviceId: string;
  arrivedAt: Date | null;
  wantsTriesAt: Date | null;
  service: { name: string; durationMin: number | null } | null;
};

function asWait(row: EntryRow): WaitRow {
  return { id: row.id, status: row.status, joinedAt: row.joinedAt, token: row.token };
}

export async function ensureQueueState(tenantId: string) {
  return prisma.queueState.upsert({
    where: { tenantId },
    create: { tenantId, isOpen: true },
    update: {},
  });
}

async function loadDay(tenantId: string, dayKey: string) {
  const [state, entries] = await Promise.all([
    ensureQueueState(tenantId),
    prisma.queueEntry.findMany({
      where: { tenantId, dayKey },
      include: { service: { select: { name: true, durationMin: true } } },
      orderBy: { token: "asc" },
    }),
  ]);
  return { state, entries: entries as EntryRow[], dayKey };
}

function minutesOf(row: EntryRow, avgMinutes: number) {
  return serviceMinutes(row.service?.durationMin, avgMinutes);
}

function timing(entries: EntryRow[], selfId: string | null, avgMinutes: number, units: number) {
  const self = selfId ? entries.find((row) => row.id === selfId) : null;
  if (self && self.status !== "WAITING") return { ahead: 0, waitMin: 0 };
  const ahead = peopleAhead(entries.map(asWait), selfId);
  const byId = new Map(entries.map((row) => [row.id, row]));
  const minutes = ahead.map((row) => minutesOf(byId.get(row.id) || entries[0], avgMinutes));
  return { ahead: ahead.length, waitMin: waitMinutes(minutes, units) };
}

function tokenTaken(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Next token for this salon and day. A clash from two joins at the same moment is retried. */
async function createQueuedEntry(data: Omit<Prisma.QueueEntryUncheckedCreateInput, "token" | "cancelToken">) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const last = await tx.queueEntry.aggregate({
          where: { tenantId: data.tenantId, dayKey: data.dayKey },
          _max: { token: true },
        });
        return tx.queueEntry.create({
          data: {
            ...data,
            token: (last._max.token ?? 0) + 1,
            cancelToken: randomBytes(18).toString("base64url"),
          },
          include: { service: { select: { name: true, durationMin: true } } },
        });
      });
    } catch (error) {
      if (!tokenTaken(error) || attempt === 5) throw error;
    }
  }
  throw new QueueError("BUSY", "The queue is busy. Try again.", 409);
}

function visitLinks(slug: string, ref: string) {
  return { link: statusUrl(slug, ref), home: queueHomeUrl(slug), tryOn: tryOnUrl(slug) };
}

export function existingTokenMessage(token: number, name: string) {
  return `This number already has token #${token} for ${name}. Open it or cancel before joining as someone else.`;
}

function sameGuestName(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function ticket(slug: string, row: EntryRow, mode: string, waitMin: number, ahead: number, existing = false) {
  return {
    ref: row.cancelToken,
    token: row.token,
    status: row.status,
    waitMin,
    ahead,
    name: row.name,
    onTheWay: row.onTheWay,
    mode,
    requestedDate: row.requestedDate,
    requestedSlot: row.requestedSlot,
    statusPath: statusPath(slug, row.cancelToken),
    existing,
    message: existing ? existingTokenMessage(row.token, row.name) : "",
  };
}

async function safeSend(send: Sender, message: NotifyMessage) {
  try {
    return await send(message);
  } catch {
    return { ok: false, provider: "none", error: "NETWORK" };
  }
}

async function claimAndSend(row: EntryRow, message: NotifyMessage, send: Sender) {
  if (!row.phone) return false;
  const claimed = await prisma.queueEntry.updateMany({
    where: { id: row.id, alertSentAt: null },
    data: { alertSentAt: new Date() },
  });
  if (claimed.count !== 1) return false;
  const result = await safeSend(send, { ...message, to: row.phone });
  if (!result.ok) {
    await prisma.queueEntry.update({ where: { id: row.id }, data: { alertSentAt: null } });
    return false;
  }
  return true;
}

export async function sweepAlerts(tenantId: string, send: Sender = notifyGuest) {
  const dayKey = kolkataDayKey();
  const { state, entries } = await loadDay(tenantId, dayKey);
  if (!state.isOpen || state.mode !== "LIVE") return { sent: 0 };
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true, productQueue: true, whatsappAlmostOn: true } });
  if (!tenant?.productQueue || !tenant.whatsappAlmostOn) return { sent: 0 };
  let sent = 0;
  for (const entry of entries) {
    if (entry.source !== "ONLINE" || entry.status !== "WAITING" || entry.alertSentAt || !entry.phone) continue;
    const wait = timing(entries, entry.id, state.avgMinutes, state.units);
    if (wait.waitMin > state.alertLeadMin) continue;
    const ok = await claimAndSend(entry, almostMessage({
      salon: tenant.name,
      token: entry.token,
      waitMin: wait.waitMin,
      ...visitLinks(tenant.slug, entry.cancelToken),
    }), send);
    if (ok) sent += 1;
  }
  return { sent };
}

export async function sweepAllQueues(send: Sender = notifyGuest) {
  const states = await prisma.queueState.findMany({ where: { isOpen: true, mode: "LIVE" }, select: { tenantId: true } });
  let sent = 0;
  for (const state of states) sent += (await sweepAlerts(state.tenantId, send)).sent;
  return { sent, salons: states.length };
}

async function requireQueueTenant(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant || tenant.deletedAt || !tenant.productQueue) throw new QueueError("PRODUCT", "The queue is not available for this salon.", 404);
  if (tenant.status === "SUSPENDED" || tenant.status === "EXPIRED") {
    throw new QueueError("SUSPENDED", tenant.status === "EXPIRED" ? "This salon's trial has ended." : "This salon is paused.", 403);
  }
  return tenant;
}

export async function publicBoard(slug: string) {
  const tenant = await requireQueueTenant(slug);
  const dayKey = kolkataDayKey();
  const { state, entries } = await loadDay(tenant.id, dayKey);
  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, durationMin: true },
  });
  const live = state.mode === "LIVE";
  const wait = live ? timing(entries, null, state.avgMinutes, state.units) : { ahead: 0, waitMin: 0 };
  const view = hoursView(tenant, state.isOpen);
  return {
    name: tenant.name,
    slug: tenant.slug,
    open: live ? view.accepting : state.isOpen,
    mode: state.mode,
    hoursClosed: live && !view.accepting,
    hoursMessage: live && !view.accepting ? view.hoursMessage : "",
    todayHours: view.todayHours,
    nextOpen: live && !view.accepting ? view.nextOpen : "",
    unitLabel: state.unitLabel,
    waitMin: wait.waitMin,
    ahead: wait.ahead,
    tryOn: tenant.productTryOn,
    lang: tenant.defaultLang,
    hoursOpen: view.hoursOpen,
    hoursClose: view.hoursClose,
    services: services.map((service) => ({ id: service.id, name: service.name, minutes: serviceMinutes(service.durationMin, state.avgMinutes) })),
  };
}

async function findService(tenantId: string, serviceId: string | undefined) {
  if (!serviceId) return null;
  const service = await prisma.service.findFirst({ where: { id: serviceId, tenantId, active: true } });
  if (!service) throw new QueueError("INVALID", "Choose a service from the list.", 400);
  return service;
}

function checkSlot(date: string, slot: string, source: HoursTenant) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new QueueError("INVALID", "Choose a date.", 400);
  if (!/^\d{2}:\d{2}$/.test(slot)) throw new QueueError("INVALID", "Choose a time.", 400);
  if (date < kolkataDayKey()) throw new QueueError("INVALID", "Choose today or a later date.", 400);
  const problem = slotProblem(source, date, slot);
  if (problem) throw new QueueError("INVALID", problem, 400);
}

export async function joinQueue(input: {
  slug: string;
  name: string;
  phone: string;
  serviceId?: string;
  consent: boolean;
  requestedDate?: string;
  requestedSlot?: string;
  /** Test clock. Guests cannot set this; the HTTP route does not read it. */
  now?: Date;
  ip: string;
  deviceId?: string;
  returnToken?: string;
  sessionId?: string;
  send?: Sender;
}) {
  const send = input.send || notifyGuest;
  const tenant = await requireQueueTenant(input.slug);
  const phone = indianMobile(input.phone);
  if (!phone) throw new QueueError("PHONE", "Enter a 10-digit Indian mobile number.", 400);
  if (!input.consent) throw new QueueError("CONSENT", "Tick the box to receive queue updates on this phone.", 400);
  const name = input.name.trim().slice(0, 80);
  if (name.length < 1) throw new QueueError("INVALID", "Add your name.", 400);
  const state = await ensureQueueState(tenant.id);
  const requestedDate = (input.requestedDate || "").trim();
  const requestedSlot = (input.requestedSlot || "").trim();
  if (state.mode === "REQUEST") {
    if (requestedDate && requestedDate === kolkataDayKey(input.now) && tenant.closedDayKey === requestedDate) {
      throw new QueueError("CLOSED", "This salon is closed today.", 403);
    }
    checkSlot(requestedDate, requestedSlot, tenant);
  }

  const dayKey = state.mode === "REQUEST" ? requestedDate : kolkataDayKey(input.now);
  const active = state.mode === "REQUEST" ? REQUEST_ACTIVE : LIVE_ACTIVE;
  const sessionId = (input.sessionId || "").trim().slice(0, 80);
  const device = deviceKey(input.deviceId);
  const existing = await prisma.queueEntry.findFirst({
    where: { tenantId: tenant.id, phone, status: { in: active }, ...(state.mode === "LIVE" ? { dayKey } : {}) },
    include: { service: { select: { name: true, durationMin: true } } },
    orderBy: { joinedAt: "desc" },
  });
  if (existing) {
    const loaded = await loadDay(tenant.id, existing.dayKey);
    const wait = timing(loaded.entries, existing.id, loaded.state.avgMinutes, loaded.state.units);
    if (!sameGuestName(existing.name, name)) {
      return ticket(tenant.slug, existing as EntryRow, state.mode, wait.waitMin, wait.ahead, true);
    }
    await rememberCustomer({ tenantId: tenant.id, phone, name });
    if (sessionId.length >= 8) await linkSessionToEntry(existing.id, sessionId, device);
    if (input.returnToken) await attributeReturn({ tenantId: tenant.id, phone, linkToken: input.returnToken });
    return ticket(tenant.slug, existing as EntryRow, state.mode, wait.waitMin, wait.ahead, false);
  }

  if (state.mode !== "REQUEST") {
    const view = hoursView(tenant, state.isOpen, input.now);
    if (!view.accepting) throw new QueueError("CLOSED", view.hoursMessage || "The queue is paused. Please ask at the desk.", 403);
  }

  const ipLimit = await sharedRateLimit(`queue:ip:${input.ip}`, QUEUE_IP_JOINS_PER_HOUR, HOUR_MS);
  const phoneLimit = await sharedRateLimit(`queue:phone:${tenant.id}:${phone}`, QUEUE_PHONE_JOINS_PER_HOUR, HOUR_MS);
  const deviceLimit = device
    ? await sharedRateLimit(`queue:device:${tenant.id}:${device}`, QUEUE_DEVICE_JOINS_PER_HOUR, HOUR_MS)
    : { ok: true as const };
  if (!ipLimit.ok || !phoneLimit.ok || !deviceLimit.ok) throw new QueueError("RATE", QUEUE_JOIN_RATE_MESSAGE, 429);

  await findService(tenant.id, input.serviceId);
  const created = await createQueuedEntry({
    tenantId: tenant.id,
    dayKey,
    name,
    phone,
    serviceId: input.serviceId || null,
    status: state.mode === "REQUEST" ? "REQUESTED" : "WAITING",
    source: "ONLINE",
    requestedDate: state.mode === "REQUEST" ? requestedDate : "",
    requestedSlot: state.mode === "REQUEST" ? requestedSlot : "",
    consentAt: new Date(),
    sessionId,
    deviceId: device,
  });
  if (sessionId.length >= 8) await linkSessionToEntry(created.id, sessionId, device);
  await rememberCustomer({ tenantId: tenant.id, phone, name });
  if (input.returnToken) await attributeReturn({ tenantId: tenant.id, phone, linkToken: input.returnToken });
  const loaded = await loadDay(tenant.id, dayKey);
  const row = loaded.entries.find((entry) => entry.id === created.id) || (created as EntryRow);
  const wait = timing(loaded.entries, row.id, loaded.state.avgMinutes, loaded.state.units);
  if (state.mode !== "REQUEST") {
    await safeSend(send, {
      ...joinedMessage({
        salon: tenant.name,
        token: row.token,
        waitMin: wait.waitMin,
        ...visitLinks(tenant.slug, row.cancelToken),
      }),
      to: phone,
    });
    await sweepAlerts(tenant.id, send);
  }
  return ticket(tenant.slug, row, state.mode, wait.waitMin, wait.ahead);
}

function deviceKey(value: string | undefined) {
  const clean = (value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return clean.length >= 8 ? clean : "";
}

export async function guestTicket(slug: string, ref: string) {
  const tenant = await requireQueueTenant(slug);
  const row = await prisma.queueEntry.findFirst({
    where: { cancelToken: ref, tenantId: tenant.id },
    include: { service: { select: { name: true, durationMin: true } } },
  });
  if (!row) throw new QueueError("NOT_FOUND", "That visit was not found.", 404);
  const state = await ensureQueueState(tenant.id);
  const loaded = await loadDay(tenant.id, row.dayKey);
  const wait = timing(loaded.entries, row.id, state.avgMinutes, state.units);
  return {
    ...ticket(tenant.slug, row as EntryRow, state.mode, wait.waitMin, wait.ahead),
    salon: tenant.name,
    tryOn: tenant.productTryOn,
    lang: tenant.defaultLang,
    serviceName: row.service?.name || "",
    ...(await guestPoints(tenant, row.phone)),
  };
}

async function guestPoints(tenant: { id: string; name: string; loyaltyOn: boolean }, phone: string) {
  if (!tenant.loyaltyOn || !phone) return { points: null, pointsLine: "", pointsNext: "" };
  const points = await pointsBalance(tenant.id, phone);
  const rewards = await listRewards(tenant.id);
  return { points, pointsLine: pointsBalanceLine(points, tenant.name), pointsNext: rewardProgress(points, rewards) };
}

export async function guestVisit(input: { slug: string; ref: string; action: "way" | "cancel" | "bind"; ip: string; sessionId?: string; deviceId?: string }) {
  if (input.action === "bind") {
    const linked = await bindTicket({ slug: input.slug, ref: input.ref, sessionId: input.sessionId || "", deviceId: input.deviceId });
    if (!linked.ok) throw new QueueError(linked.code, linked.message, linked.status);
    return guestTicket(input.slug, input.ref);
  }
  const limit = await sharedRateLimit(`queue:visit:${input.ip}`, 30, 10 * 60 * 1000);
  if (!limit.ok) throw new QueueError("RATE", "Too many taps. Wait a moment.", 429);
  const tenant = await requireQueueTenant(input.slug);
  const row = await prisma.queueEntry.findFirst({ where: { cancelToken: input.ref, tenantId: tenant.id } });
  if (!row) throw new QueueError("NOT_FOUND", "That visit was not found.", 404);
  if (input.action === "way") {
    // Live line only — request-mode / future tickets stay without On my way (#14).
    if (row.status !== "WAITING" && row.status !== "CALLED") {
      throw new QueueError("STATE", "On my way is only for guests still in line.", 409);
    }
    await prisma.queueEntry.update({ where: { id: row.id }, data: { onTheWay: true } });
  } else {
    if (row.status === "DONE" || row.status === "IN_SERVICE") throw new QueueError("STATE", "Ask the desk to close this visit.", 409);
    if (row.status !== "CANCELLED") {
      await prisma.queueEntry.update({ where: { id: row.id }, data: { status: "CANCELLED", doneAt: new Date(), unitSlot: null } });
    }
  }
  return guestTicket(input.slug, input.ref);
}

async function deskCard(tenantName: string, slug: string, row: EntryRow, avgMinutes: number, entries: EntryRow[], units: number, tenant: { id: string; visitTryLimit: number; tryOnsAtSalon: boolean }) {
  const wait = timing(entries, row.id, avgMinutes, units);
  const text = deskWhatsAppText(tenantName, row.token, row.name, { home: queueHomeUrl(slug), tryOn: tryOnUrl(slug) });
  const phone = row.phone;
  return {
    id: row.id,
    token: row.token,
    name: row.name || "Walk-in",
    phone,
    serviceName: row.service?.name || "",
    status: row.status,
    source: row.source,
    unitSlot: row.unitSlot,
    waitMin: wait.waitMin,
    ahead: wait.ahead,
    onTheWay: row.onTheWay,
    requestedDate: row.requestedDate,
    requestedSlot: row.requestedSlot,
    whatsappUrl: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : "",
    callUrl: phone ? `tel:+${phone}` : "",
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    ...(await tryLineForEntry(row, tenant)),
  };
}

export async function deskSnapshot(tenantId: string, now = new Date()) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.productQueue) throw new QueueError("PRODUCT", "The queue is not available for this salon.", 404);
  const dayKey = kolkataDayKey(now);
  const { state, entries } = await loadDay(tenantId, dayKey);
  const view = hoursView(tenant, state.isOpen, now);
  const requests = state.mode === "REQUEST"
    ? await prisma.queueEntry.findMany({
      where: { tenantId, status: { in: ["REQUESTED", "CONFIRMED"] }, requestedDate: { gte: dayKey } },
      include: { service: { select: { name: true, durationMin: true } } },
      orderBy: [{ requestedDate: "asc" }, { requestedSlot: "asc" }],
      take: 80,
    })
    : [];
  const services = await prisma.service.findMany({
    where: { tenantId, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const everyone = [...entries, ...requests];
  const balances = tenant.loyaltyOn ? await pointsBalances(tenant.id, everyone.map((row) => row.phone)) : new Map<string, number>();
  const rewards = tenant.loyaltyOn ? await listRewards(tenant.id) : [];
  const card = async (row: EntryRow) => ({
    ...(await deskCard(tenant.name, tenant.slug, row, state.avgMinutes, entries, state.units, tenant)),
    points: tenant.loyaltyOn && row.phone ? balances.get(row.phone) ?? 0 : null,
  });
  const serving = await Promise.all(Array.from({ length: state.units }, async (_, index) => {
    const unit = index + 1;
    const entry = entries.find((row) => row.unitSlot === unit && (row.status === "CALLED" || row.status === "IN_SERVICE"));
    return { unit, entry: entry ? await card(entry) : null };
  }));
  const [waiting, requestCards, confirmed] = await Promise.all([
    Promise.all(entries.filter((row) => row.status === "WAITING").map(card)),
    Promise.all((requests as EntryRow[]).filter((row) => row.status === "REQUESTED").map((row) => deskCard(tenant.name, tenant.slug, row, state.avgMinutes, [], state.units, tenant))),
    Promise.all((requests as EntryRow[]).filter((row) => row.status === "CONFIRMED").map((row) => deskCard(tenant.name, tenant.slug, row, state.avgMinutes, [], state.units, tenant))),
  ]);
  return {
    salon: tenant.name,
    state: {
      isOpen: view.accepting,
      scheduled: view.scheduled,
      hoursLabel: view.label,
      closedToday: view.closedToday,
      todayHours: view.todayHours,
      nextOpen: view.nextOpen,
      units: state.units,
      unitLabel: state.unitLabel,
      avgMinutes: state.avgMinutes,
      alertLeadMin: state.alertLeadMin,
      mode: state.mode,
    },
    services,
    serving,
    waiting,
    requests: requestCards,
    confirmed,
    rewards,
  };
}

async function requireDesk(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.productQueue) throw new QueueError("PRODUCT", "The queue is not available for this salon.", 404);
  return tenant;
}

function freeSlot(entries: EntryRow[], units: number) {
  const occupied = new Set(entries.filter((row) => (row.status === "CALLED" || row.status === "IN_SERVICE") && row.unitSlot).map((row) => row.unitSlot));
  for (let unit = 1; unit <= units; unit += 1) {
    if (!occupied.has(unit)) return unit;
  }
  return 0;
}

export async function callNext(tenantId: string, send: Sender = notifyGuest) {
  await requireDesk(tenantId);
  const dayKey = kolkataDayKey();
  const { state, entries } = await loadDay(tenantId, dayKey);
  if (state.mode !== "LIVE") throw new QueueError("STATE", "This salon takes time requests, not a live line.", 409);
  const slot = freeSlot(entries, state.units);
  if (!slot) throw new QueueError("BUSY", "Every place is busy. Mark one done first.", 409);
  const next = entries.find((row) => row.status === "WAITING");
  if (!next) throw new QueueError("EMPTY", "No one is waiting.", 409);
  await prisma.queueEntry.update({
    where: { id: next.id },
    data: { status: "CALLED", calledAt: new Date(), unitSlot: slot },
  });
  await sweepAlerts(tenantId, send);
  return deskSnapshot(tenantId);
}

export async function startEntry(tenantId: string, id: string) {
  await requireDesk(tenantId);
  const dayKey = kolkataDayKey();
  const { state, entries } = await loadDay(tenantId, dayKey);
  const row = entries.find((entry) => entry.id === id);
  if (!row || (row.status !== "WAITING" && row.status !== "CALLED")) throw new QueueError("STATE", "That guest is not waiting.", 409);
  const slot = row.status === "CALLED" && row.unitSlot ? row.unitSlot : freeSlot(entries, state.units);
  if (!slot) throw new QueueError("BUSY", "Every place is busy. Mark one done first.", 409);
  await prisma.queueEntry.update({
    where: { id },
    data: { status: "IN_SERVICE", startedAt: row.startedAt || new Date(), calledAt: row.calledAt || new Date(), unitSlot: slot, onTheWay: false },
  });
  return deskSnapshot(tenantId);
}

export async function returnToLine(tenantId: string, id: string) {
  await requireDesk(tenantId);
  const row = await prisma.queueEntry.findFirst({ where: { id, tenantId } });
  if (!row || row.status !== "CALLED") throw new QueueError("STATE", "That guest is not waiting at the chair.", 409);
  await prisma.queueEntry.update({ where: { id }, data: { status: "WAITING", unitSlot: null, calledAt: null } });
  return deskSnapshot(tenantId);
}

export async function finishEntry(tenantId: string, id: string, status: "DONE" | "NO_SHOW", send: Sender = notifyGuest, staffId = "") {
  const tenant = await requireDesk(tenantId);
  const row = await prisma.queueEntry.findFirst({ where: { id, tenantId } });
  if (!row) throw new QueueError("NOT_FOUND", "That guest was not found.", 404);
  const allowed = status === "DONE" ? ["CALLED", "IN_SERVICE", "WAITING", "CONFIRMED"] : ["WAITING", "CALLED", "IN_SERVICE"];
  if (!allowed.includes(row.status)) throw new QueueError("STATE", "That guest is already closed.", 409);
  await prisma.queueEntry.update({ where: { id }, data: { status, doneAt: new Date(), unitSlot: null, onTheWay: false } });
  if (status === "DONE" && row.phone) {
    await recordVisit(tenantId, row.phone, row.name);
    if (tenant.loyaltyOn && tenant.loyaltyPointsPerVisit > 0) {
      await earnVisitPoints({ tenantId, phone: row.phone, visitId: row.id, staffId, points: tenant.loyaltyPointsPerVisit });
    }
  }
  await sweepAlerts(tenantId, send);
  return deskSnapshot(tenantId);
}

export async function redeemOnEntry(tenantId: string, id: string, rewardId: string, staffId = "") {
  const tenant = await requireDesk(tenantId);
  if (!tenant.loyaltyOn) throw new QueueError("STATE", "Loyalty is off for this salon.", 409);
  const row = await prisma.queueEntry.findFirst({ where: { id, tenantId } });
  if (!row) throw new QueueError("NOT_FOUND", "That guest was not found.", 404);
  if (!row.phone) throw new QueueError("PHONE", "Add a mobile number before redeeming points.", 400);
  try {
    await redeemReward({ tenantId, phone: row.phone, rewardId, staffId, visitId: row.id });
  } catch (error) {
    if (error instanceof LoyaltyError) throw new QueueError("POINTS", error.message, 400);
    throw error;
  }
  return deskSnapshot(tenantId);
}

export async function addWalkIn(tenantId: string, input: { name?: string; phone?: string; serviceId?: string }, send: Sender = notifyGuest) {
  const tenant = await requireDesk(tenantId);
  const state = await ensureQueueState(tenantId);
  if (state.mode !== "LIVE") throw new QueueError("STATE", "Switch to the live queue to add a walk-in.", 409);
  const phone = (input.phone || "").trim() ? indianMobile(input.phone || "") : "";
  if ((input.phone || "").trim() && !phone) throw new QueueError("PHONE", "Enter a 10-digit Indian mobile number, or leave the phone empty.", 400);
  await findService(tenantId, input.serviceId);
  const dayKey = kolkataDayKey();
  const name = (input.name || "").trim().slice(0, 80) || "Walk-in";
  const created = await createQueuedEntry({
    tenantId,
    dayKey,
    name,
    phone,
    serviceId: input.serviceId || null,
    status: "WAITING",
    source: "WALKIN",
  });
  if (phone) {
    await rememberCustomer({ tenantId, phone, name: (input.name || "").trim() });
    if (tenant.whatsappWalkInJoined) {
      const loaded = await loadDay(tenantId, dayKey);
      const row = loaded.entries.find((entry) => entry.id === created.id);
      const wait = timing(loaded.entries, created.id, loaded.state.avgMinutes, loaded.state.units);
      await safeSend(send, {
        ...joinedMessage({
          salon: tenant.name,
          token: created.token,
          waitMin: row ? wait.waitMin : 0,
          ...visitLinks(tenant.slug, created.cancelToken),
        }),
        to: phone,
      });
    }
  }
  await sweepAlerts(tenantId, send);
  return deskSnapshot(tenantId);
}

export async function setQueueOpen(tenantId: string, isOpen: boolean, now = new Date()) {
  const tenant = await requireDesk(tenantId);
  await ensureQueueState(tenantId);
  const week = effectiveWeek(tenant);
  if (week.kind === "fallback") {
    await prisma.tenant.update({ where: { id: tenantId }, data: { hoursOverride: "", hoursOverrideUntil: null } });
  } else {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { hoursOverride: isOpen ? "open" : "closed", hoursOverrideUntil: nextBoundary(week.week, now) },
    });
  }
  await prisma.queueState.update({ where: { tenantId }, data: { isOpen } });
  if (isOpen) await sweepAlerts(tenantId);
  return deskSnapshot(tenantId, now);
}

export async function setClosedToday(tenantId: string, closed: boolean, now = new Date()) {
  await requireDesk(tenantId);
  await ensureQueueState(tenantId);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { closedDayKey: closed ? kolkataDayKey(now) : "" },
  });
  return deskSnapshot(tenantId, now);
}

export async function saveQueueSettings(tenantId: string, input: {
  units: number;
  avgMinutes: number;
  alertLeadMin: number;
  mode: "LIVE" | "REQUEST";
  unitLabel: "chair" | "station" | "room";
}) {
  await requireDesk(tenantId);
  await ensureQueueState(tenantId);
  await prisma.queueState.update({
    where: { tenantId },
    data: {
      units: input.units,
      avgMinutes: input.avgMinutes,
      alertLeadMin: input.alertLeadMin,
      mode: input.mode,
      unitLabel: input.unitLabel,
    },
  });
  return deskSnapshot(tenantId);
}

export async function confirmRequest(tenantId: string, id: string, input: { date?: string; slot?: string }, send: Sender = notifyGuest) {
  const tenant = await requireDesk(tenantId);
  const row = await prisma.queueEntry.findFirst({ where: { id, tenantId } });
  if (!row || row.status !== "REQUESTED") throw new QueueError("STATE", "That request is not waiting.", 409);
  const date = (input.date || row.requestedDate).trim();
  const slot = (input.slot || row.requestedSlot).trim();
  checkSlot(date, slot, tenant);
  await prisma.queueEntry.update({
    where: { id },
    data: { status: "CONFIRMED", requestedDate: date, requestedSlot: slot },
  });
  if (row.phone) {
    await safeSend(send, {
      ...confirmedMessage({ salon: tenant.name, date, slot, ...visitLinks(tenant.slug, row.cancelToken) }),
      to: row.phone,
    });
  }
  return deskSnapshot(tenantId);
}

export async function declineRequest(tenantId: string, id: string) {
  await requireDesk(tenantId);
  const row = await prisma.queueEntry.findFirst({ where: { id, tenantId } });
  if (!row || row.status !== "REQUESTED") throw new QueueError("STATE", "That request is not waiting.", 409);
  await prisma.queueEntry.update({ where: { id }, data: { status: "CANCELLED", doneAt: new Date() } });
  return deskSnapshot(tenantId);
}

export async function purgeOldQueueEntries(now = Date.now()) {
  const days = Math.max(1, Number(process.env.QUEUE_RETENTION_DAYS || 30) || 30);
  const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);
  const result = await prisma.queueEntry.deleteMany({ where: { joinedAt: { lt: cutoff } } });
  return result.count;
}
