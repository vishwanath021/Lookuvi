import { normalizePhone } from "@/lib/preview-access";
import { prisma } from "@/lib/prisma";

function phonesMatch(left: string, right: string) {
  if (left && left === right) return true;
  const a = normalizePhone(left);
  const b = normalizePhone(right);
  return Boolean(a && a === b);
}

/**
 * Withdraw may delete leads only when the caller holds the guest cookie for that
 * phone, or the queue cancel token tied to the same session or phone.
 */
export async function possessesWithdrawSession(input: {
  tenantId: string;
  sessionId: string;
  guest: { customerId: string; tenantId: string } | null;
  ref?: string | null;
}) {
  const sessionId = input.sessionId.trim();
  if (sessionId.length < 8) return false;
  const ref = (input.ref || "").trim();
  if (ref.length >= 8) {
    const entry = await prisma.queueEntry.findFirst({
      where: { tenantId: input.tenantId, cancelToken: ref },
      select: { id: true, sessionId: true, phone: true },
    });
    if (entry) {
      if (entry.sessionId === sessionId) return true;
      const linked = await prisma.queueSession.findFirst({
        where: { entryId: entry.id, sessionId },
        select: { id: true },
      });
      if (linked) return true;
      if (entry.phone) {
        const leads = await prisma.lead.findMany({
          where: { tenantId: input.tenantId, sessionId },
          select: { phone: true },
        });
        if (leads.some((lead) => lead.phone && phonesMatch(lead.phone, entry.phone))) return true;
      }
    }
  }
  if (!input.guest || input.guest.tenantId !== input.tenantId) return false;
  const customer = await prisma.customer.findFirst({
    where: { id: input.guest.customerId, tenantId: input.tenantId },
    select: { phone: true },
  });
  if (!customer?.phone) return false;
  const leads = await prisma.lead.findMany({
    where: { tenantId: input.tenantId, sessionId },
    select: { phone: true },
  });
  return leads.some((lead) => lead.phone && phonesMatch(lead.phone, customer.phone));
}
