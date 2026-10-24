import { afterAll, describe, expect, it } from "vitest";
import { PLANS, TRIAL_TRYONS } from "@/data/plans";
import { activatePlan } from "@/lib/billing/apply";
import { nextReceiptNumber } from "@/lib/billing/receipt-number";
import { receiptPdf } from "@/lib/billing/receipt-pdf";
import { markPaymentPaid, openUpiPayment } from "@/lib/billing/upi-flow";
import { CreditError, reserveCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { expireTrials } from "@/lib/trial";

describe("launch billing decisions", () => {
  const slug = `launch-${Date.now()}`;

  afterAll(async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (tenant) {
      const payments = await prisma.paymentRequest.findMany({ where: { tenantId: tenant.id }, select: { id: true } });
      if (payments.length) await prisma.upiReference.deleteMany({ where: { paymentId: { in: payments.map((row) => row.id) } } });
      await prisma.paymentRequest.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.invoice.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.subscription.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.creditLedger.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
    await prisma.$disconnect();
  });

  it("keeps a pending UPI choice from adding try-ons, then grants them once when marked paid", async () => {
    const tenant = await prisma.tenant.create({
      data: {
        slug,
        name: "Launch salon",
        plan: "LITE",
        status: "TRIAL",
        creditBalance: TRIAL_TRYONS,
        dailyCap: PLANS.LITE.credits,
        trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });
    const pending = await openUpiPayment({ tenantId: tenant.id, kind: "PLAN", plan: "LITE", interval: "monthly" });
    expect(pending.pending).toBe(true);
    expect(pending.amountInr).toBe(799);
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } })).creditBalance).toBe(TRIAL_TRYONS);

    const paid = await markPaymentPaid({ paymentId: pending.paymentId, upiRef: "UPIREF123456", actorId: "tester" });
    expect(paid.invoiceNumber.startsWith("ABW-")).toBe(true);
    const after = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(after.status).toBe("ACTIVE");
    expect(after.creditBalance).toBe(TRIAL_TRYONS + PLANS.LITE.credits);
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { number: paid.invoiceNumber } });
    expect(invoice.documentKind).toBe("RECEIPT");
    expect(invoice.gstInr).toBe(0);
    const pdf = receiptPdf([invoice.number, "GST not charged"]);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

    await expect(markPaymentPaid({ paymentId: pending.paymentId, upiRef: "UPIREF999999", actorId: "tester" })).rejects.toThrow(/NOT_PENDING|UPI_USED/);
    const second = await openUpiPayment({ tenantId: tenant.id, kind: "PLAN", plan: "LITE", interval: "monthly" });
    await expect(markPaymentPaid({ paymentId: second.paymentId, upiRef: "UPIREF123456", actorId: "tester" })).rejects.toThrow("UPI_USED");
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } })).creditBalance).toBe(TRIAL_TRYONS + PLANS.LITE.credits);
  });

  it("gives unique receipt numbers when several are taken together", async () => {
    const numbers = await Promise.all([nextReceiptNumber(), nextReceiptNumber(), nextReceiptNumber(), nextReceiptNumber()]);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("expires only trials whose end date has passed, and blocks try-ons", async () => {
    const past = await prisma.tenant.create({
      data: { slug: `${slug}-past`, name: "Past trial", status: "TRIAL", trialEndsAt: new Date(Date.now() - 60_000), creditBalance: 5 },
    });
    const future = await prisma.tenant.create({
      data: { slug: `${slug}-future`, name: "Future trial", status: "TRIAL", trialEndsAt: new Date(Date.now() + 86_400_000), creditBalance: 5 },
    });
    const active = await prisma.tenant.create({
      data: { slug: `${slug}-active`, name: "Active", status: "ACTIVE", trialEndsAt: new Date(Date.now() - 60_000), creditBalance: 5 },
    });
    const count = await expireTrials();
    expect(count).toBeGreaterThanOrEqual(1);
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: past.id } })).status).toBe("EXPIRED");
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: future.id } })).status).toBe("TRIAL");
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: active.id } })).status).toBe("ACTIVE");
    await expect(reserveCredits(past.id, 1, "expired-try")).rejects.toBeInstanceOf(CreditError);
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: past.id } })).creditBalance).toBe(5);
    await prisma.tenant.deleteMany({ where: { id: { in: [past.id, future.id, active.id] } } });
  });

  it("still grants a full plan allowance from activatePlan for a new payment reference", async () => {
    const tenant = await prisma.tenant.create({
      data: { slug: `${slug}-pay`, name: "Paid", plan: "LITE", status: "TRIAL", creditBalance: 20, dailyCap: 50 },
    });
    const first = await activatePlan({ tenantId: tenant.id, plan: "STARTER", interval: "monthly", provider: "upi", externalId: "PAYREF000001", chargeSetup: false });
    expect(first.credits).toBe(120);
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } })).creditBalance).toBe(140);
    await activatePlan({ tenantId: tenant.id, plan: "STARTER", interval: "monthly", provider: "upi", externalId: "PAYREF000001", chargeSetup: false });
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } })).creditBalance).toBe(140);
    await prisma.invoice.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.subscription.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.creditLedger.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });
});
