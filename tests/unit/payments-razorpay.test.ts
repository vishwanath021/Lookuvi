import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyCheckoutCallbackSignature } from "@/lib/payments/callback-signature";
import { createSalonPlanCheckout } from "@/lib/payments/checkout";
import { razorpayConfigured, paymentsUnavailableMessage } from "@/lib/payments/config";
import { expireStalePayments } from "@/lib/payments/expiry";
import { redactForLog } from "@/lib/payments/redact";
import { verifyRazorpaySignature, razorpaySignature } from "@/lib/billing/signature";
import { handleRazorpayPaymentWebhook } from "@/lib/payments/webhook";
import { tooMany } from "@/lib/http/guard";
import { prisma } from "@/lib/prisma";
import { resetRateLimits } from "@/lib/ratelimit";

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
    create: { id: tenantId, slug: "pay-test", name: "Pay Test" },
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
    await prisma.tenant.update({ where: { id: tenantId }, data: { paidUntil: null, salonBillingPlanId: null } });
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    vi.restoreAllMocks();
    resetRateLimits();
  });

  it("verifies webhook HMAC signatures", () => {
    const body = '{"event":"payment.captured"}';
    const sig = sign(body);
    expect(verifyRazorpaySignature(body, sig, "whsec_test")).toBe(true);
    expect(verifyRazorpaySignature(body, "nope", "whsec_test")).toBe(false);
    expect(
      verifyCheckoutCallbackSignature(
        "order_1",
        "pay_1",
        createHmac("sha256", "sec_test").update("order_1|pay_1").digest("hex"),
        "sec_test",
      ),
    ).toBe(true);
  });

  it("redacts key secret, webhook secret, signature, and card fields from log payloads", () => {
    const redacted = redactForLog({
      webhook_secret: "whsec_live",
      key_secret: "sec_live",
      razorpay_signature: "a".repeat(80),
      signature: "sig",
      card: "4111111111111111",
      note: "ok",
    }) as Record<string, unknown>;
    const text = JSON.stringify(redacted);
    expect(text).not.toMatch(/whsec_live|sec_live/);
    expect(redacted.webhook_secret).toBe("[redacted]");
    expect(redacted.key_secret).toBe("[redacted]");
    expect(redacted.razorpay_signature).toBe("[redacted]");
    expect(redacted.signature).toBe("[redacted]");
    expect(redacted.card).toBe("[redacted]");
    expect(redacted.note).toBe("ok");
  });

  it("treats Razorpay as unavailable when env keys are missing", () => {
    delete process.env.RAZORPAY_KEY_ID;
    expect(razorpayConfigured()).toBe(false);
    expect(paymentsUnavailableMessage()).toContain("not configured");
  });

  it("rate-limits checkout via tooMany on plan-billing-checkout", async () => {
    resetRateLimits();
    const req = () =>
      new Request("http://localhost/", {
        headers: { "x-forwarded-for": "198.51.100.50" },
      });
    for (let i = 0; i < 8; i++) {
      expect(await tooMany(req(), "plan-billing-checkout", 8, 60_000)).toBeNull();
    }
    const blocked = await tooMany(req(), "plan-billing-checkout", 8, 60_000);
    expect(blocked?.status).toBe(429);
  });

  it("rejects inactive and unknown salon plans", async () => {
    await prisma.salonBillingPlan.update({ where: { id: planId }, data: { active: false } });
    await expect(
      createSalonPlanCheckout({ tenantId, salonPlanId: planId, actorUserId: "u1" }, async () => new Response(null, { status: 500 })),
    ).rejects.toThrow(/PLAN_NOT_ACTIVE/);
    await expect(
      createSalonPlanCheckout({ tenantId, salonPlanId: "missing-plan", actorUserId: "u1" }, async () => new Response(null, { status: 500 })),
    ).rejects.toThrow(/PLAN_NOT_ACTIVE/);
  });

  it("sets order amount from the plan, not from the client", async () => {
    await prisma.salonBillingPlan.update({ where: { id: planId }, data: { pricePaise: 42_100 } });
    let sentAmount = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { amount: number };
      sentAmount = body.amount;
      return new Response(JSON.stringify({ id: "order_from_db" }), { status: 200 });
    }) as typeof fetch;
    const row = await createSalonPlanCheckout({ tenantId, salonPlanId: planId, actorUserId: "u1" }, fetchMock);
    expect(sentAmount).toBe(42_100);
    const stored = await prisma.payment.findUnique({ where: { id: row.paymentId } });
    expect(stored?.amountPaise).toBe(42_100);
  });

  it("payment.authorized records status but does not grant paidUntil", async () => {
    const orderId = "order_auth_only";
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
      id: "evt_auth_only",
      payload: { payment: { entity: { id: "pay_auth", order_id: orderId, amount: 79900, currency: "INR" } } },
    });
    await handleRazorpayPaymentWebhook(authBody, sign(authBody), "evt_auth_only");
    expect((await prisma.payment.findUnique({ where: { orderId } }))?.status).toBe("authorized");
    expect((await prisma.tenant.findUnique({ where: { id: tenantId } }))?.paidUntil).toBeNull();
  });

  it("payment.captured grants once; duplicate webhook is idempotent", async () => {
    const orderId = "order_capture_once";
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
    const capBody = JSON.stringify({
      event: "payment.captured",
      id: "evt_cap_once",
      payload: { payment: { entity: { id: "pay_cap", order_id: orderId, amount: 79900, currency: "INR" } } },
    });
    await handleRazorpayPaymentWebhook(capBody, sign(capBody), "evt_cap_once");
    expect((await prisma.tenant.findUnique({ where: { id: tenantId } }))?.paidUntil).toBeTruthy();
    const dup = await handleRazorpayPaymentWebhook(capBody, sign(capBody), "evt_cap_once");
    expect(dup.duplicate).toBe(true);
  });

  it("flags amount mismatch on capture", async () => {
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
    const badBody = JSON.stringify({
      event: "payment.captured",
      id: "evt_bad",
      payload: { payment: { entity: { id: "pay_c", order_id: "order_mismatch", amount: 1, currency: "INR" } } },
    });
    const flagged = await handleRazorpayPaymentWebhook(badBody, sign(badBody), "evt_bad");
    expect(flagged.flagged).toBe(true);
  });

  it("refund.processed marks payment refunded", async () => {
    const orderId = "order_refund";
    await prisma.payment.create({
      data: {
        tenantId,
        kind: "SALON_PLAN",
        status: "paid",
        amountPaise: 79900,
        currency: "INR",
        orderId,
        salonPlanId: planId,
        razorpayPaymentId: "pay_refund",
        paidAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const refundBody = JSON.stringify({
      event: "refund.processed",
      id: "evt_refund",
      payload: { payment: { entity: { id: "pay_refund" } }, refund: { entity: { id: "rfnd_1", payment_id: "pay_refund", amount: 79900 } } },
    });
    await handleRazorpayPaymentWebhook(refundBody, sign(refundBody), "evt_refund");
    expect((await prisma.payment.findUnique({ where: { orderId } }))?.status).toBe("refunded");
  });

  it("expires stale pending orders when expiresAt has passed", async () => {
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
    expect(await expireStalePayments()).toBeGreaterThan(0);
    expect((await prisma.payment.findUnique({ where: { orderId: "order_old" } }))?.status).toBe("expired");
  });
});