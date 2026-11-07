import { displayPhone } from "@/lib/customers/parse";
import { blockedPhoneSet } from "@/lib/customers/service";
import { pointsBalances } from "@/lib/loyalty";
import { prisma } from "@/lib/prisma";
import { queueHomeUrl } from "@/lib/queue/messages";
import { indianMobile } from "@/lib/queue/phone";
import {
  daysSinceVisit,
  effectiveReminderDays,
  reminderCutoff,
  renderReminderMessage,
  visitDateLabel,
  whatsAppAppUrl,
  whatsAppMeUrl,
  whatsAppWebUrl,
  type DueVisitRow,
} from "@/lib/visit-reminders";

export async function listDueVisits(
  tenant: { id: string; name: string; slug: string; reminderDays: number; reminderTemplate: string },
  now = new Date(),
) {
  const days = effectiveReminderDays(tenant.reminderDays);
  const cutoff = reminderCutoff(days, now);
  const rows = await prisma.customer.findMany({
    where: { tenantId: tenant.id, lastVisitAt: { lte: cutoff } },
    orderBy: [{ lastVisitAt: "asc" }, { id: "asc" }],
    take: 200,
  });
  const phones = rows.map((row) => row.phone);
  const [blocked, balances, reminders] = await Promise.all([
    blockedPhoneSet(tenant.id, phones),
    pointsBalances(tenant.id, phones),
    phones.length
      ? prisma.visitReminder.findMany({
          where: { tenantId: tenant.id, phone: { in: phones }, undoneAt: null },
          select: { phone: true, sentAt: true },
        })
      : Promise.resolve([]),
  ]);
  const link = queueHomeUrl(tenant.slug);
  const customers: DueVisitRow[] = [];
  for (const row of rows) {
    if (!row.lastVisitAt || row.optedOutAt || blocked.has(row.phone)) continue;
    const remindedByLog = reminders.some((item) => item.phone === row.phone && item.sentAt.getTime() >= row.lastVisitAt!.getTime());
    const remindedByVisit = Boolean(row.lastRemindedVisitAt && row.lastRemindedVisitAt.getTime() >= row.lastVisitAt.getTime());
    if (remindedByLog || remindedByVisit) continue;
    const points = balances.get(row.phone) ?? 0;
    const message = renderReminderMessage({
      template: tenant.reminderTemplate,
      name: row.name,
      salon: tenant.name,
      points,
      link,
    });
    customers.push({
      id: row.id,
      name: row.name,
      phone: row.phone,
      phoneLabel: displayPhone(row.phone),
      lastVisitAt: row.lastVisitAt.toISOString(),
      lastVisitLabel: visitDateLabel(row.lastVisitAt),
      daysSince: daysSinceVisit(row.lastVisitAt, now),
      points,
      message,
      meUrl: whatsAppMeUrl(row.phone, message),
      webUrl: whatsAppWebUrl(row.phone, message),
      appUrl: whatsAppAppUrl(row.phone, message),
    });
  }
  return { customers, days };
}

export async function markReminded(input: { tenantId: string; customerId: string; userId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, tenantId: input.tenantId } });
  if (!customer?.lastVisitAt) return { ok: false as const, message: "That customer was not found." };
  const phone = indianMobile(customer.phone);
  if (!phone) return { ok: false as const, message: "That mobile number is not valid." };
  const existing = await prisma.visitReminder.findFirst({
    where: { tenantId: input.tenantId, phone, undoneAt: null, sentAt: { gte: customer.lastVisitAt } },
    orderBy: { sentAt: "desc" },
  });
  if (existing) return { ok: true as const, reminderId: existing.id, message: "Marked as reminded.", already: true };
  const row = await prisma.visitReminder.create({
    data: {
      tenantId: input.tenantId,
      phone,
      visitAt: customer.lastVisitAt,
      sentAt: now,
      method: "MANUAL",
      userId: input.userId,
    },
  });
  await prisma.customer.update({
    where: { id: customer.id },
    data: { lastRemindedVisitAt: customer.lastVisitAt, needsReminder: false, reminderLockUntil: null },
  });
  return { ok: true as const, reminderId: row.id, message: "Marked as reminded.", already: false };
}

export async function undoReminder(input: { tenantId: string; reminderId: string; now?: Date }) {
  const row = await prisma.visitReminder.findFirst({
    where: { id: input.reminderId, tenantId: input.tenantId, undoneAt: null },
  });
  if (!row) return { ok: false as const, message: "That reminder was not found." };
  await prisma.visitReminder.update({
    where: { id: row.id },
    data: { undoneAt: input.now ?? new Date() },
  });
  const customer = await prisma.customer.findFirst({ where: { tenantId: input.tenantId, phone: row.phone } });
  if (customer?.lastVisitAt) {
    const still = await prisma.visitReminder.findFirst({
      where: { tenantId: input.tenantId, phone: row.phone, undoneAt: null, sentAt: { gte: customer.lastVisitAt } },
    });
    if (!still) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          needsReminder: customer.optedOutAt ? false : true,
          lastRemindedVisitAt: null,
          reminderLockUntil: null,
        },
      });
    }
  }
  return { ok: true as const, message: "Undone. They are on the list again." };
}
