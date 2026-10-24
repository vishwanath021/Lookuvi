import { prisma } from "@/lib/prisma";
import { kolkataDayKey, kolkataMonthKey } from "@/lib/queue/day";
import { kolkataMonthStart } from "@/lib/ai/spend";
import { indianMobile } from "@/lib/queue/phone";
import { customerFilter, displayPhone, istNoon, nextCustomerName, parseCustomerImport } from "@/lib/customers/parse";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function phoneBlockedForSalon(tenantId: string, phone: string) {
  const hit = await prisma.whatsAppOptOut.findFirst({
    where: { phone, OR: [{ tenantId }, { tenantId: "" }] },
    select: { id: true },
  });
  return Boolean(hit);
}

export async function blockedPhoneSet(tenantId: string, phones: string[]) {
  const blocked = new Set<string>();
  for (let index = 0; index < phones.length; index += 500) {
    const rows = await prisma.whatsAppOptOut.findMany({
      where: { phone: { in: phones.slice(index, index + 500) }, OR: [{ tenantId }, { tenantId: "" }] },
      select: { phone: true },
    });
    for (const row of rows) blocked.add(row.phone);
  }
  return blocked;
}

/** Salon of the message a plain STOP is answering. Null when it cannot be attributed. */
export async function salonForInboundStop(phoneInput: string) {
  const phone = indianMobile(phoneInput);
  if (!phone) return null;
  const send = await prisma.whatsAppSend.findFirst({
    where: { phone, status: "SENT" },
    orderBy: { createdAt: "desc" },
    select: { tenantId: true, createdAt: true },
  });
  const entry = await prisma.queueEntry.findFirst({
    where: { phone },
    orderBy: { joinedAt: "desc" },
    select: { tenantId: true, joinedAt: true },
  });
  if (send && entry) return send.createdAt >= entry.joinedAt ? send.tenantId : entry.tenantId;
  if (send) return send.tenantId;
  if (entry) return entry.tenantId;
  const customers = await prisma.customer.findMany({ where: { phone }, select: { tenantId: true }, take: 2 });
  if (customers.length === 1) return customers[0].tenantId;
  return null;
}

export async function rememberCustomer(input: { tenantId: string; phone: string; name?: string }) {
  const phone = indianMobile(input.phone);
  if (!phone) return null;
  const blocked = await phoneBlockedForSalon(input.tenantId, phone);
  const existing = await prisma.customer.findUnique({ where: { tenantId_phone: { tenantId: input.tenantId, phone } } });
  const name = nextCustomerName(existing?.name || "", input.name || "");
  if (!existing) {
    return prisma.customer.create({
      data: {
        tenantId: input.tenantId,
        phone,
        name,
        optedOutAt: blocked ? new Date() : null,
        optOutSource: blocked ? "STOP" : "",
      },
    });
  }
  return prisma.customer.update({
    where: { id: existing.id },
    data: {
      name,
      ...(blocked && !existing.optedOutAt ? { optedOutAt: new Date(), optOutSource: "STOP", needsReminder: false } : {}),
    },
  });
}

export async function recordVisit(tenantId: string, phone: string, name: string, at = new Date()) {
  const row = await rememberCustomer({ tenantId, phone, name });
  if (!row || row.optedOutAt) {
    if (!row) return null;
    return prisma.customer.update({
      where: { id: row.id },
      data: { visitCount: { increment: 1 }, lastVisitAt: at },
    });
  }
  return prisma.customer.update({
    where: { id: row.id },
    data: { visitCount: { increment: 1 }, lastVisitAt: at, needsReminder: true, reminderLockUntil: null },
  });
}

async function applyImportedVisit(tenantId: string, phone: string, name: string, visitedOn: string) {
  const row = await rememberCustomer({ tenantId, phone, name });
  if (!row || !visitedOn) return row;
  const at = istNoon(visitedOn);
  const later = row.lastVisitAt && row.lastVisitAt.getTime() >= at.getTime();
  if (later) return row;
  return prisma.customer.update({
    where: { id: row.id },
    data: {
      lastVisitAt: at,
      visitCount: Math.max(row.visitCount, 1),
      needsReminder: row.optedOutAt ? false : true,
      reminderLockUntil: null,
    },
  });
}

export async function addCustomer(tenantId: string, phoneInput: string, name: string) {
  const phone = indianMobile(phoneInput);
  if (!phone) return { ok: false as const, message: "Enter a 10-digit Indian mobile number." };
  const row = await rememberCustomer({ tenantId, phone, name });
  return { ok: true as const, message: "Saved.", id: row?.id || "" };
}

export async function importCustomers(tenantId: string, text: string, now = new Date()) {
  const parsed = parseCustomerImport(text, kolkataDayKey(now));
  if (parsed.tooLong) return { ok: false as const, message: "Paste up to 500 lines at a time.", saved: 0, invalid: 0, datesIgnored: 0 };
  for (const row of parsed.rows) {
    if (row.visitedOn) await applyImportedVisit(tenantId, row.phone, row.name, row.visitedOn);
    else await rememberCustomer({ tenantId, phone: row.phone, name: row.name });
  }
  const saved = parsed.rows.length;
  const skipped = parsed.invalid ? ` Skipped ${parsed.invalid} that are not Indian mobiles.` : "";
  const dates = parsed.datesIgnored ? ` Ignored ${parsed.datesIgnored} dates.` : "";
  return { ok: true as const, message: `Saved ${saved} numbers.${skipped}${dates}`, saved, invalid: parsed.invalid, datesIgnored: parsed.datesIgnored };
}

export async function listCustomers(tenantId: string, q: string) {
  const rows = await prisma.customer.findMany({
    where: customerFilter(tenantId, q),
    orderBy: [{ lastVisitAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  const phones = rows.map((row) => row.phone);
  const blocked = await blockedPhoneSet(tenantId, phones);
  return rows.map((row) => {
    const stopped = blocked.has(row.phone) || row.optOutSource === "STOP";
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      phoneLabel: displayPhone(row.phone),
      visitCount: row.visitCount,
      lastVisitAt: row.lastVisitAt ? row.lastVisitAt.toISOString() : "",
      lastVisitLabel: row.lastVisitAt
        ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(row.lastVisitAt)
        : "No visit yet",
      optedOut: Boolean(row.optedOutAt) || blocked.has(row.phone),
      stop: stopped,
      canResume: Boolean(row.optedOutAt) && row.optOutSource === "DESK" && !blocked.has(row.phone),
    };
  });
}

export async function deskOptOut(tenantId: string, id: string) {
  const result = await prisma.customer.updateMany({
    where: { id, tenantId },
    data: { optedOutAt: new Date(), optOutSource: "DESK", needsReminder: false, reminderLockUntil: null },
  });
  if (!result.count) return { ok: false as const, message: "That number is not on this salon's list." };
  const row = await prisma.customer.findFirst({ where: { id, tenantId } });
  if (row && (await phoneBlockedForSalon(tenantId, row.phone))) {
    await prisma.customer.update({ where: { id }, data: { optOutSource: "STOP" } });
  }
  return { ok: true as const, message: "Reminders are off for this number." };
}

export async function resumeReminders(tenantId: string, id: string) {
  const row = await prisma.customer.findFirst({ where: { id, tenantId } });
  if (!row) return { ok: false as const, message: "That number is not on this salon's list." };
  if ((await phoneBlockedForSalon(tenantId, row.phone)) || row.optOutSource === "STOP") {
    return { ok: false as const, message: "This number replied STOP. Reminders stay off." };
  }
  await prisma.customer.update({ where: { id }, data: { optedOutAt: null, optOutSource: "" } });
  return { ok: true as const, message: "Reminders are on for this number." };
}

/** Salon STOP, or a shared-number STOPALL / UNSUBSCRIBE (tenantId ""). */
export async function applyStop(phoneInput: string, scope: { tenantId: string } | { global: true }) {
  const phone = indianMobile(phoneInput);
  if (!phone) return 0;
  const tenantId = "global" in scope ? "" : scope.tenantId;
  await prisma.whatsAppOptOut.upsert({
    where: { phone_tenantId: { phone, tenantId } },
    create: { phone, tenantId },
    update: {},
  });
  const result = await prisma.customer.updateMany({
    where: tenantId ? { phone, tenantId } : { phone },
    data: { optedOutAt: new Date(), optOutSource: "STOP", needsReminder: false, reminderLockUntil: null },
  });
  return result.count;
}

export async function saveReminderSettings(tenantId: string, input: { remindersOn: boolean; reminderDays: number; whatsappMonthlyCap: number }) {
  if (!Number.isInteger(input.reminderDays) || input.reminderDays < 28 || input.reminderDays > 42) {
    return { ok: false as const, message: "Use a whole number of days from 28 to 42." };
  }
  if (!Number.isInteger(input.whatsappMonthlyCap) || input.whatsappMonthlyCap < 0 || input.whatsappMonthlyCap > 5000) {
    return { ok: false as const, message: "Use a monthly limit from 0 to 5000." };
  }
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      remindersOn: input.remindersOn,
      reminderDays: input.reminderDays,
      whatsappMonthlyCap: input.whatsappMonthlyCap,
    },
  });
  return { ok: true as const, message: "Reminder settings saved." };
}

/** Count a return only for a reminder send to this phone at this salon. */
export async function attributeReturn(input: { tenantId: string; phone: string; linkToken: string }) {
  const token = input.linkToken.trim();
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(token)) return false;
  const send = await prisma.whatsAppSend.findFirst({
    where: { linkToken: token, tenantId: input.tenantId, status: "SENT", kind: "reminder" },
  });
  if (!send || send.phone !== input.phone || !send.customerId) return false;
  try {
    await prisma.customerReturn.create({
      data: { tenantId: input.tenantId, customerId: send.customerId, sendId: send.id },
    });
    return true;
  } catch {
    return false;
  }
}

export async function returnStats(tenantId: string, now = new Date()) {
  const monthKey = kolkataMonthKey(now);
  const since = new Date(now.getTime() - 90 * DAY_MS);
  const [remindersSent, offersSent, windowRows, returnsThisMonth] = await Promise.all([
    prisma.whatsAppSend.count({ where: { tenantId, monthKey, kind: "reminder", status: "SENT" } }),
    prisma.whatsAppSend.count({ where: { tenantId, monthKey, kind: "offer", status: "SENT" } }),
    prisma.whatsAppSend.findMany({
      where: { tenantId, kind: "reminder", status: "SENT", createdAt: { gte: since } },
      select: { id: true, customerId: true },
    }),
    prisma.customerReturn.count({ where: { tenantId, createdAt: { gte: kolkataMonthStart(now) } } }),
  ]);
  const sendIds = windowRows.map((row) => row.id);
  const returns = sendIds.length
    ? await prisma.customerReturn.findMany({ where: { sendId: { in: sendIds } }, select: { customerId: true } })
    : [];
  const reminded = new Set(windowRows.map((row) => row.customerId).filter(Boolean));
  const returned = new Set(returns.map((row) => row.customerId));
  return {
    remindersSent,
    offersSent,
    used: remindersSent + offersSent,
    remindedCustomers: reminded.size,
    returnedCustomers: [...reminded].filter((id) => returned.has(id)).length,
    returnsThisMonth,
  };
}
