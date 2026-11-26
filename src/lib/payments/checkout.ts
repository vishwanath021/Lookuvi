import { randomUUID } from "node:crypto";
import { allocatePaymentReceiptNumber } from "@/lib/payments/receipt-number";
import { createRazorpayOrder } from "@/lib/payments/razorpay-client";
import { prisma } from "@/lib/prisma";

export type SalonPlanCheckoutInput = {
  tenantId: string;
  salonPlanId: string;
  actorUserId: string;
};

export type DepositCheckoutInput = {
  tenantId: string;
  bookingId: string;
  amountPaise: number;
};

const ORDER_TTL_MS = 30 * 60 * 1000;

export async function createSalonPlanCheckout(input: SalonPlanCheckoutInput, fetchImpl?: typeof fetch) {
  const plan = await prisma.salonBillingPlan.findFirst({
    where: { id: input.salonPlanId, active: true },
  });
  if (!plan) throw new Error("PLAN_NOT_ACTIVE");
  const expiresAt = new Date(Date.now() + ORDER_TTL_MS);
  const receipt = await prisma.$transaction(async (tx) => {
    const receiptNumber = await allocatePaymentReceiptNumber(tx);
    const row = await tx.payment.create({
      data: {
        tenantId: input.tenantId,
        kind: "SALON_PLAN",
        status: "created",
        amountPaise: plan.pricePaise,
        currency: "INR",
        orderId: `pending_${randomUUID()}`,
        receiptNumber,
        salonPlanId: plan.id,
        expiresAt,
      },
    });
    return { paymentId: row.id, receiptNumber, amountPaise: plan.pricePaise };
  });
  const order = await createRazorpayOrder(
    {
      amountPaise: receipt.amountPaise,
      currency: "INR",
      receipt: receipt.receiptNumber,
      notes: {
        tenantId: input.tenantId,
        kind: "SALON_PLAN",
        salonPlanId: input.salonPlanId,
        paymentId: receipt.paymentId,
        actorUserId: input.actorUserId,
      },
    },
    fetchImpl,
  );
  await prisma.payment.update({
    where: { id: receipt.paymentId },
    data: { orderId: order.id },
  });
  return {
    paymentId: receipt.paymentId,
    orderId: order.id,
    amountPaise: receipt.amountPaise,
    currency: "INR" as const,
    receiptNumber: receipt.receiptNumber,
  };
}

export async function createBookingDepositCheckout(input: DepositCheckoutInput, fetchImpl?: typeof fetch) {
  const booking = await prisma.booking.findFirst({
    where: { id: input.bookingId, tenantId: input.tenantId },
  });
  if (!booking) throw new Error("BOOKING_NOT_FOUND");
  if (input.amountPaise < 1) throw new Error("DEPOSIT_OFF");
  const expiresAt = new Date(Date.now() + ORDER_TTL_MS);
  const receipt = await prisma.$transaction(async (tx) => {
    const receiptNumber = await allocatePaymentReceiptNumber(tx);
    const row = await tx.payment.create({
      data: {
        tenantId: input.tenantId,
        kind: "BOOKING_DEPOSIT",
        status: "created",
        amountPaise: input.amountPaise,
        currency: "INR",
        orderId: `pending_${randomUUID()}`,
        receiptNumber,
        bookingId: input.bookingId,
        expiresAt,
      },
    });
    return { paymentId: row.id, receiptNumber };
  });
  const order = await createRazorpayOrder(
    {
      amountPaise: input.amountPaise,
      currency: "INR",
      receipt: receipt.receiptNumber,
      notes: {
        tenantId: input.tenantId,
        kind: "BOOKING_DEPOSIT",
        bookingId: input.bookingId,
        paymentId: receipt.paymentId,
      },
    },
    fetchImpl,
  );
  await prisma.payment.update({
    where: { id: receipt.paymentId },
    data: { orderId: order.id },
  });
  return {
    paymentId: receipt.paymentId,
    orderId: order.id,
    amountPaise: input.amountPaise,
    currency: "INR" as const,
    receiptNumber: receipt.receiptNumber,
  };
}