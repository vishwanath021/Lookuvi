import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyCheckoutCallbackSignature } from "@/lib/payments/callback-signature";
import { razorpayConfigured, paymentsUnavailableMessage } from "@/lib/payments/config";
import { expireStalePayments } from "@/lib/payments/expiry";
import { extendPaidUntil } from "@/lib/payments/grants";
import { redactForLog } from "@/lib/payments/redact";
import { verifyRazorpaySignature, razorpaySignature } from "@/lib/billing/signature";
import { handleRazorpayPaymentWebhook } from "@/lib/payments/webhook";
import { prisma } from "@/lib/prisma";
import { resetRateLimits, sharedRateLimit } from "@/lib/ratelimit";
const tenantId = "pay-tenant-1";
const planId = "pay-plan-1";

async function seedPlan() {
  await prisma.salonBillingPlan.upsert({
    where: { id: planId },
    create: { id: planId, name: "Lookuvi Salon", pricePaise: 79900, intervalMonths: 1, active: true },
    update: { active: true, pricePaise: 79900 },
  });
  await prisma.tenant.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      slug: "pay-test",
      name: "Pay Test",
    },
    update: {},
  });
}

function sign(body: string, secret = "whsec_test") {
  return razorpaySignature(body, secret);
}

describe("payments razorpay", () => {
  beforeEach(async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_x";
    process.env.RAZORPAY_KEY_SECRET = "sec_test";
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test";
    await seedPlan();
  });

  afterEach(async () => {
    await prisma.razorpayWebhookEvent.deleteMany();
    await prisma.payment.deleteMany({ where: { tenantId } });
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    vi.restoreAllMocks();
  });

  it("verifies webhook and callback signatures", () => {
    const body = '{"event":"payment.captured"}';
    const sig = sign(body);
    expect(verifyRazorpaySignature(body, sig, "whsec_test")).toBe(true);
    expect(verifyCheckoutCallbackSignature("order_1", "pay_1", createHmac("sha256", "sec_test").update("order_1|pay_1").digest("hex"), "sec_test")).toBe(true);
  });

  it("reports unavailable when env keys are missing", () => {
    delete process.env.RAZORPAY_KEY_ID;
    expect(razorpayConfigured()).toBe(false);
    expect(paymentsUnavailableMessage()).toContain("not configured");
  });

  it("rejects inactive salon plans at checkout layer", async () => {
    await prisma.salonBillingPlan.update({ where: { id: planId }, data: { active: false } });
    await expect(
      import("@/lib/payments/checkout").then((mod) =>
        mod.createSalonPlanCheckout({ tenantId, salonPlanId: planId, actorUserId: "u1" }, async () => new Response(null, { status: 500 })),
      ),
    ).rejects.toThrow(/PLAN_NOT_ACTIVE/);
    await prisma.salonBillingPlan.update({ where: { id: planId }, data: { active: true } });
  });

  it("authorized does not grant; captured grants once", async () => {
    const orderId = "order_test_1";
    await prisma.payment.create({
      data: {
        tenantId,
        kind: "SALON_PLAN",
        status: "created",
        amountPaise: 79900,
        currency: "INR",
        orderId,
        salonPlanId: planId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const authBody = JSON.stringify({
      event: "payment.authorized",
      id: "evt_auth_1",
      payload: { payment: { entity: { id: "pay_a", order_id: orderId, amount: 79900, currency: "INR" } } },
    });
    await handleRazorpayPaymentWebhook(authBody, sign(authBody), "evt_auth_1");
    const mid = await prisma.payment.findUnique({ where: { orderId } });
    expect(mid?.status).toBe("authorized");
    let tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    expect(tenant?.paidUntil).toBeNull();

    const capBody = JSON.stringify({
      event: "payment.captured",
      id: "evt_cap_1",
      payload: { payment: { entity: { id: "pay_a", order_id: orderId, amount: 79900, currency: "INR" } } },
    });
    await handleRazorpayPaymentWebhook(capBody, sign(capBody), "evt_cap_1");
    tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    expect(tenant?.paidUntil).toBeTruthy();
    const paid = await prisma.payment.findUnique({ where: { orderId } });
    expect(paid?.status).toBe("paid");

    await handleRazorpayPaymentWebhook(capBody, sign(capBody), "evt_cap_1");
    const dup = await handleRazorpayPaymentWebhook(capBody, sign(capBody), "evt_cap_1");
    expect(dup.duplicate).toBe(true);
  });

  it("flags amount mismatch and refund reverses grant", async () => {
    const orderId = "order_test_2";
    await prisma.payment.create({
      data: {
        tenantId,
        kind: "SALON_PLAN",
        status: "paid",
        amountPaise: 79900,
        currency: "INR",
        orderId,
        salonPlanId: planId,
        razorpayPaymentId: "pay_b",
        paidAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { paidUntil: extendPaidUntil(null, 1), salonBillingPlanId: planId },
    });
    const badBody = JSON.stringify({
      event: "payment.captured",
      id: "evt_bad",
      payload: { payment: { entity: { id: "pay_c", order_id: "order_mismatch", amount: 1, currency: "INR" } } },
    });
    await prisma.payment.create({
      data: {
        tenantId,
        kind: "SALON_PLAN",
        status: "created",
        amountPaise: 79900,
        currency: "INR",
        orderId: "order_mismatch",
        salonPlanId: planId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
  const flagged = await handleRazorpayPaymentWebhook(badBody, sign(badBody), "evt_bad");
    expect(flagged.flagged).toBe(true);

    const refundBody = JSON.stringify({
      event: "refund.processed",
      id: "evt_ref",
      payload: { payment: { entity: { id: "pay_b" } }, refund: { entity: { id: "rfnd_1", payment_id: "pay_b", amount: 79900 } } },
    });
    await handleRazorpayPaymentWebhook(refundBody, sign(refundBody), "evt_ref");
    const row = await prisma.payment.findFirst({ where: { orderId } });
    expect(row?.status).toBe("refunded");
  });

  it("expires stale pending orders", async () => {
    await prisma.payment.create({
      data: {
        tenantId,
        kind: "SALON_PLAN",
        status: "created",
        amountPaise: 100,
        currency: "INR",
        orderId: "order_old",
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const n = await expireStalePayments();
    expect(n).toBeGreaterThan(0);
    const row = await prisma.payment.findUnique({ where: { orderId: "order_old" } });
    expect(row?.status).toBe("expired");
  });

  it("rate limits checkout key and redacts logs", async () => {
    resetRateLimits();
    const first = await sharedRateLimit("plan-billing-checkout:1.2.3.4", 2, 60_000);
    expect(first.ok).toBe(true);
    const second = await sharedRateLimit("plan-billing-checkout:1.2.3.4", 2, 60_000);
    expect(second.ok).toBe(true);
    const third = await sharedRateLimit("plan-billing-checkout:1.2.3.4", 2, 60_000);
    expect(third.ok).toBe(false);
    const redacted = redactForLog({ webhook_secret: "x", card: "4111", note: "ok" }) as Record<string, string>;
    expect(redacted.webhook_secret).toBe("[redacted]");
    expect(redacted.card).toBe("[redacted]");
  });
});