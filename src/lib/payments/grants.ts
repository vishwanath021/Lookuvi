import { prisma } from "@/lib/prisma";

export function extendPaidUntil(current: Date | null | undefined, intervalMonths: number, from = new Date()) {
  const base = current && current.getTime() > from.getTime() ? current : from;
  const next = new Date(base);
  next.setMonth(next.getMonth() + intervalMonths);
  return next;
}

export async function grantSalonPlanPeriod(input: {
  tenantId: string;
  salonPlanId: string;
  intervalMonths: number;
}) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });
  const paidUntil = extendPaidUntil(tenant.paidUntil, input.intervalMonths);
  await prisma.tenant.update({
    where: { id: input.tenantId },
    data: {
      paidUntil,
      salonBillingPlanId: input.salonPlanId,
      status: "ACTIVE",
      trialEndsAt: null,
    },
  });
  return { paidUntil };
}

export async function confirmBookingDeposit(bookingId: string) {
  await prisma.booking.update({
    where: { id: bookingId },
    data: { depositStatus: "PAID" },
  });
}

export async function reverseSalonPlanGrant(input: { tenantId: string; intervalMonths: number; fullRefund: boolean }) {
  if (!input.fullRefund) return;
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant?.paidUntil) return;
  const next = new Date(tenant.paidUntil);
  next.setMonth(next.getMonth() - input.intervalMonths);
  const paidUntil = next.getTime() < Date.now() ? null : next;
  await prisma.tenant.update({
    where: { id: input.tenantId },
    data: { paidUntil },
  });
}

export async function reverseBookingDeposit(bookingId: string) {
  await prisma.booking.update({
    where: { id: bookingId },
    data: { depositStatus: "" },
  });
}