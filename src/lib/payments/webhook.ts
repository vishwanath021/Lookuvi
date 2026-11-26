import { verifyRazorpaySignature } from "@/lib/billing/signature";
import {
  confirmBookingDeposit,
  grantSalonPlanPeriod,
  reverseBookingDeposit,
  reverseSalonPlanGrant,
} from "@/lib/payments/grants";
import { redactForLog } from "@/lib/payments/redact";
import { prisma } from "@/lib/prisma";

type PaymentEntity = {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  invoice_id?: string;
  notes?: Record<string, string>;
  status?: string;
};

type RefundEntity = {
  id?: string;
  payment_id?: string;
  amount?: number;
};

type WebhookBody = {
  event?: string;
  id?: string;
  payload?: {
    payment?: { entity?: PaymentEntity };
    refund?: { entity?: RefundEntity };
    order?: { entity?: { id?: string; amount?: number; currency?: string } };
  };
};

async function recordWebhookEvent(eventId: string, event: string) {
  try {
    await prisma.razorpayWebhookEvent.create({ data: { eventId, event } });
    return { duplicate: false as const };
  } catch {
    return { duplicate: true as const };
  }
}

async function flagPaymentMismatch(paymentId: string, reason: string) {
  await prisma.payment.update({
    where: { id: paymentId },
    data: { flagged: true, flagReason: reason, status: "flagged" },
  });
  await prisma.auditLog.create({
    data: {
      actorId: "razorpay",
      action: "PAYMENT_FLAGGED",
      target: paymentId,
      meta: JSON.stringify(redactForLog({ reason })),
    },
  });
}

async function loadPaymentByOrder(orderId: string) {
  if (!orderId) return null;
  return prisma.payment.findUnique({ where: { orderId } });
}

function entityAmountOk(stored: number, got?: number) {
  if (got === undefined || got === null) return true;
  return stored === got;
}

export async function handleRazorpayPaymentWebhook(rawBody: string, signature: string, headerEventId: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  if (!verifyRazorpaySignature(rawBody, signature, secret)) throw new Error("INVALID_SIGNATURE");
  const body = JSON.parse(rawBody) as WebhookBody;
  const event = body.event || "ignored";
  const pay = body.payload?.payment?.entity;
  const orderId = pay?.order_id || body.payload?.order?.entity?.id || "";
  const paymentId = pay?.id || "";
  const eventId = headerEventId || body.id || `${event}:${paymentId || orderId}`;
  const seen = await recordWebhookEvent(eventId, event);
  if (seen.duplicate) return { type: event, duplicate: true };

  const row = await loadPaymentByOrder(orderId);
  const needsOrder =
    event === "payment.authorized" ||
    event === "payment.captured" ||
    event === "payment.failed" ||
    event === "order.paid";
  if (!row && needsOrder) {
    return { type: event, duplicate: false, missing: true };
  }

  if (event === "payment.authorized") {
    if (row && row.status === "created") {
      await prisma.payment.update({
        where: { id: row.id },
        data: {
          status: "authorized",
          razorpayPaymentId: paymentId,
          razorpayInvoiceId: pay?.invoice_id || "",
        },
      });
    }
    return { type: event, duplicate: false, granted: false };
  }

  if (event === "payment.failed") {
    if (row) {
      await prisma.payment.update({
        where: { id: row.id },
        data: { status: "failed", failedAt: new Date(), razorpayPaymentId: paymentId },
      });
    }
    return { type: event, duplicate: false };
  }

  const captureEvents = event === "payment.captured" || event === "order.paid";
  if (captureEvents && row) {
    if (row.status === "paid") return { type: event, duplicate: false, alreadyPaid: true };
    if (!entityAmountOk(row.amountPaise, pay?.amount ?? body.payload?.order?.entity?.amount)) {
      await flagPaymentMismatch(row.id, "AMOUNT_MISMATCH");
      return { type: event, duplicate: false, flagged: true };
    }
    const currency = pay?.currency || body.payload?.order?.entity?.currency || "INR";
    if (currency !== row.currency) {
      await flagPaymentMismatch(row.id, "CURRENCY_MISMATCH");
      return { type: event, duplicate: false, flagged: true };
    }
    await prisma.payment.update({
      where: { id: row.id },
      data: {
        status: "paid",
        paidAt: new Date(),
        razorpayPaymentId: paymentId,
        razorpayInvoiceId: pay?.invoice_id || "",
      },
    });
    if (row.kind === "SALON_PLAN" && row.salonPlanId) {
      const plan = await prisma.salonBillingPlan.findUnique({ where: { id: row.salonPlanId } });
      if (plan) {
        await grantSalonPlanPeriod({
          tenantId: row.tenantId,
          salonPlanId: plan.id,
          intervalMonths: plan.intervalMonths,
        });
      }
    }
    if (row.kind === "BOOKING_DEPOSIT" && row.bookingId) {
      await confirmBookingDeposit(row.bookingId);
    }
    return { type: event, duplicate: false, granted: true };
  }

  if (event === "refund.processed") {
    const refund = body.payload?.refund?.entity;
    const rpayId = refund?.payment_id || pay?.id || "";
    const paymentRow =
      row ||
      (rpayId ? await prisma.payment.findFirst({ where: { razorpayPaymentId: rpayId } }) : null);
    if (!paymentRow) return { type: event, duplicate: false };
    if (paymentRow.status === "refunded") return { type: event, duplicate: false, alreadyRefunded: true };
    const fullRefund = refund?.amount !== undefined ? refund.amount >= paymentRow.amountPaise : true;
    await prisma.payment.update({
      where: { id: paymentRow.id },
      data: {
        status: "refunded",
        refundedAt: new Date(),
        refundId: refund?.id || "",
      },
    });
    if (paymentRow.kind === "SALON_PLAN" && paymentRow.salonPlanId) {
      const plan = await prisma.salonBillingPlan.findUnique({ where: { id: paymentRow.salonPlanId } });
      await reverseSalonPlanGrant({
        tenantId: paymentRow.tenantId,
        intervalMonths: plan?.intervalMonths || 1,
        fullRefund,
      });
    }
    if (paymentRow.kind === "BOOKING_DEPOSIT" && paymentRow.bookingId) {
      await reverseBookingDeposit(paymentRow.bookingId);
    }
    return { type: event, duplicate: false, reversed: fullRefund };
  }

  return { type: event, duplicate: false };
}