import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { kolkataMonthKey } from "@/lib/queue/day";
import { notifyGuest, templateFor, whatsAppConfigured, type NotifyEnv, type NotifyMessage, type NotifyResult } from "@/lib/notify";
import { offerMessage, queueHomeUrl, reminderMessage, tryOnUrl } from "@/lib/queue/messages";
import { cleanOffer } from "@/lib/customers/parse";
import { blockedPhoneSet, phoneBlockedForSalon } from "@/lib/customers/service";

const OUTREACH_LOCK = 872164;
const DAY_MS = 24 * 60 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const STALE_MS = 10 * 60 * 1000;
const BATCH = 40;

type Sender = (message: NotifyMessage, env?: NotifyEnv) => Promise<NotifyResult>;

async function defaultSend(message: NotifyMessage, env?: NotifyEnv) {
  return notifyGuest(message, env || (process.env as NotifyEnv));
}

export function outreachReady(env: NotifyEnv, kind: "reminder" | "offer") {
  if (!whatsAppConfigured(env)) return "OFF" as const;
  if (!templateFor(kind, env)) return "TEMPLATE" as const;
  return "READY" as const;
}

async function claimSlot(input: {
  tenantId: string;
  cap: number;
  kind: "reminder" | "offer";
  phone: string;
  customerId: string;
  broadcastId?: string;
  monthKey: string;
}) {
  return prisma.$transaction(async (tx) => {
    if ((process.env.DATABASE_URL || "").startsWith("postgres")) {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${OUTREACH_LOCK})`);
    }
    const staleBefore = new Date(Date.now() - STALE_MS);
    await tx.whatsAppSend.updateMany({
      where: { tenantId: input.tenantId, status: "PENDING", createdAt: { lt: staleBefore } },
      data: { status: "FAILED", error: "STALE" },
    });
    const held = await tx.whatsAppSend.count({
      where: {
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        kind: { in: ["reminder", "offer"] },
        status: { in: ["SENT", "PENDING"] },
      },
    });
    if (held >= input.cap) return null;
    return tx.whatsAppSend.create({
      data: {
        tenantId: input.tenantId,
        customerId: input.customerId,
        phone: input.phone,
        kind: input.kind,
        status: "PENDING",
        broadcastId: input.broadcastId || "",
        linkToken: randomBytes(18).toString("base64url"),
        monthKey: input.monthKey,
      },
    });
  });
}

async function remindOne(
  salon: { id: string; name: string; slug: string; whatsappMonthlyCap: number },
  customer: { id: string; phone: string; lastVisitAt: Date | null },
  send: Sender,
  env: NotifyEnv,
  now: Date,
) {
  const claimed = await prisma.customer.updateMany({
    where: {
      id: customer.id,
      needsReminder: true,
      optedOutAt: null,
      OR: [{ reminderLockUntil: null }, { reminderLockUntil: { lt: now } }],
    },
    data: { reminderLockUntil: new Date(now.getTime() + LOCK_MS) },
  });
  if (claimed.count !== 1) return "skip" as const;
  if (await phoneBlockedForSalon(salon.id, customer.phone)) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { optedOutAt: new Date(), optOutSource: "STOP", needsReminder: false, reminderLockUntil: null },
    });
    return "skip" as const;
  }
  const slot = await claimSlot({
    tenantId: salon.id,
    cap: salon.whatsappMonthlyCap,
    kind: "reminder",
    phone: customer.phone,
    customerId: customer.id,
    monthKey: kolkataMonthKey(now),
  });
  if (!slot?.linkToken) {
    await prisma.customer.update({ where: { id: customer.id }, data: { reminderLockUntil: null } });
    return "cap" as const;
  }
  let result: NotifyResult;
  try {
    result = await send(
      { ...reminderMessage({ salon: salon.name, join: `${queueHomeUrl(salon.slug)}?r=${slot.linkToken}`, tryOn: tryOnUrl(salon.slug) }), to: customer.phone },
      env,
    );
  } catch {
    result = { ok: false, provider: "none", error: "NETWORK" };
  }
  if (result.ok && result.provider === "whatsapp") {
    await prisma.whatsAppSend.update({ where: { id: slot.id }, data: { status: "SENT", provider: "whatsapp" } });
    await prisma.customer.update({
      where: { id: customer.id },
      data: { needsReminder: false, reminderLockUntil: null, lastRemindedVisitAt: customer.lastVisitAt },
    });
    return "sent" as const;
  }
  await prisma.whatsAppSend.update({
    where: { id: slot.id },
    data: { status: "FAILED", provider: result.provider, error: (result.error || "FAILED").slice(0, 40) },
  });
  await prisma.customer.update({ where: { id: customer.id }, data: { reminderLockUntil: null } });
  return result.error === "TEMPLATE" ? "template" as const : "fail" as const;
}

export async function sweepDueReminders(send: Sender = defaultSend, env: NotifyEnv = process.env as NotifyEnv, now = new Date()) {
  const ready = outreachReady(env, "reminder");
  if (ready !== "READY") return { sent: 0, reason: ready, salons: 0 };
  const salons = await prisma.tenant.findMany({
    where: { deletedAt: null, remindersOn: true, productQueue: true, status: { notIn: ["SUSPENDED", "EXPIRED"] } },
    select: { id: true, name: true, slug: true, reminderDays: true, whatsappMonthlyCap: true },
  });
  let sent = 0;
  for (const salon of salons) {
    const days = Math.min(42, Math.max(28, salon.reminderDays || 35));
    const cutoff = new Date(now.getTime() - days * DAY_MS);
    const due = await prisma.customer.findMany({
      where: { tenantId: salon.id, needsReminder: true, optedOutAt: null, lastVisitAt: { lte: cutoff } },
      orderBy: { lastVisitAt: "asc" },
      take: BATCH,
    });
    for (const customer of due) {
      const outcome = await remindOne(salon, customer, send, env, now);
      if (outcome === "sent") sent += 1;
      if (outcome === "cap" || outcome === "template") break;
    }
  }
  return { sent, reason: "READY" as const, salons: salons.length };
}

export async function sendBroadcast(tenantId: string, text: string, send: Sender = defaultSend, env: NotifyEnv = process.env as NotifyEnv, now = new Date()) {
  const offer = cleanOffer(text);
  if (offer.length < 3) return { ok: false as const, message: "Write the offer in a few words.", sent: 0, held: 0 };
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { ok: false as const, message: "Salon not found.", sent: 0, held: 0 };
  const ready = outreachReady(env, "offer");
  if (ready === "OFF") return { ok: true as const, message: "WhatsApp is not connected, so nothing was sent.", sent: 0, held: 0 };
  if (ready === "TEMPLATE") return { ok: true as const, message: "The offer template is missing, so nothing was sent.", sent: 0, held: 0 };
  const broadcast = await prisma.salonBroadcast.create({ data: { tenantId, text: offer } });
  const people = await prisma.customer.findMany({
    where: { tenantId, optedOutAt: null },
    select: { id: true, phone: true, lastVisitAt: true },
  });
  people.sort((a, b) => {
    if (!a.lastVisitAt && !b.lastVisitAt) return a.id.localeCompare(b.id);
    if (!a.lastVisitAt) return 1;
    if (!b.lastVisitAt) return -1;
    return b.lastVisitAt.getTime() - a.lastVisitAt.getTime();
  });
  const blocked = await blockedPhoneSet(tenantId, people.map((row) => row.phone));
  let sent = 0;
  let held = 0;
  let stop: "" | "cap" | "template" = "";
  for (const person of people) {
    if (blocked.has(person.phone)) continue;
    if (stop === "cap") {
      held += 1;
      continue;
    }
    if (stop === "template") break;
    const slot = await claimSlot({
      tenantId,
      cap: tenant.whatsappMonthlyCap,
      kind: "offer",
      phone: person.phone,
      customerId: person.id,
      broadcastId: broadcast.id,
      monthKey: kolkataMonthKey(now),
    });
    if (!slot?.linkToken) {
      stop = "cap";
      held += 1;
      continue;
    }
    let result: NotifyResult;
    try {
      result = await send(
        { ...offerMessage({ salon: tenant.name, offer, join: `${queueHomeUrl(tenant.slug)}?r=${slot.linkToken}`, tryOn: tryOnUrl(tenant.slug) }), to: person.phone },
        env,
      );
    } catch {
      result = { ok: false, provider: "none", error: "NETWORK" };
    }
    if (result.ok && result.provider === "whatsapp") {
      await prisma.whatsAppSend.update({ where: { id: slot.id }, data: { status: "SENT", provider: "whatsapp" } });
      sent += 1;
    } else {
      await prisma.whatsAppSend.update({
        where: { id: slot.id },
        data: { status: "FAILED", provider: result.provider, error: (result.error || "FAILED").slice(0, 40) },
      });
      if (result.error === "TEMPLATE") stop = "template";
    }
  }
  await prisma.salonBroadcast.update({ where: { id: broadcast.id }, data: { sent, held } });
  if (stop === "template" && sent === 0) return { ok: true as const, message: "The offer template is missing, so nothing was sent.", sent, held };
  if (sent === 0 && held > 0) return { ok: true as const, message: "The monthly limit is used, so nothing new was sent.", sent, held };
  const tail = held ? ` ${held} were not sent because the monthly limit was reached.` : "";
  const templateNote = stop === "template" ? " The offer template failed after that." : "";
  return { ok: true as const, message: `Sent to ${sent} people.${tail}${templateNote}`, sent, held };
}
