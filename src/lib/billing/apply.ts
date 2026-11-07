import { Prisma } from "@prisma/client";
import { CREDIT_PACKS, planById, TRIAL_DAYS } from "@/data/plans";
import { allocateReceiptNumber } from "@/lib/billing/receipt-number";
import { dailyCapAfterPlanChange } from "@/lib/billing/plan-assign";
import { grantCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { gstEnabled, withGst } from "@/lib/pricing";

async function nextInvoiceNumber() {
  return prisma.$transaction((tx) => allocateReceiptNumber(tx));
}

export async function activatePlan(input: {
  tenantId: string;
  plan: string;
  interval: "monthly" | "yearly";
  provider: string;
  externalId?: string;
  chargeSetup: boolean;
}) {
  const plan = planById(input.plan);
  const current = await prisma.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + (input.interval === "yearly" ? 12 : 1));
  await prisma.tenant.update({
    where: { id: input.tenantId },
    data: {
      plan: plan.id,
      status: "ACTIVE",
      removeBranding: plan.removeBranding,
      dailyCap: dailyCapAfterPlanChange(current.dailyCap, current.plan, plan.id),
      includedCreditMark: Math.max(current.includedCreditMark, plan.credits),
      trialEndsAt: null,
    },
  });
  await prisma.subscription.upsert({
    where: { tenantId: input.tenantId },
    create: {
      tenantId: input.tenantId,
      plan: plan.id,
      interval: input.interval,
      provider: input.provider,
      externalId: input.externalId,
      status: "ACTIVE",
      currentPeriodEnd: periodEnd,
    },
    update: {
      plan: plan.id,
      interval: input.interval,
      provider: input.provider,
      externalId: input.externalId,
      status: "ACTIVE",
      currentPeriodEnd: periodEnd,
    },
  });
  const paymentRef = input.externalId || "";
  const alreadyGranted = paymentRef
    ? await prisma.creditLedger.findFirst({ where: { tenantId: input.tenantId, reason: "PLAN_GRANT", refId: paymentRef } })
    : null;
  if (!alreadyGranted) await grantCredits(input.tenantId, plan.credits, "PLAN_GRANT", paymentRef || plan.id);
  const recurring = input.interval === "yearly" ? plan.monthlyExGst * 10 : plan.monthlyExGst;
  const setup = input.chargeSetup ? plan.setupExGst : 0;
  const money = withGst(recurring + setup);
  const tax = gstEnabled();
  const invoice = await prisma.invoice.create({
    data: {
      tenantId: input.tenantId,
      number: await nextInvoiceNumber(),
      amountExGst: recurring + setup,
      gstInr: money.gstInr,
      totalInr: money.totalInr,
      description: tax
        ? `${plan.name} ${input.interval}${setup ? ` + setup` : ""} (ex-GST Rs ${recurring + setup})`
        : `${plan.name} ${input.interval} receipt`,
      status: "PAID",
      upiRef: paymentRef,
      documentKind: tax ? "TAX_INVOICE" : "RECEIPT",
    },
  });
  return { plan: plan.id, credits: plan.credits, invoiceNumber: invoice.number, totalInr: invoice.totalInr };
}

function uniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** A repeated provider payment id returns the first grant and does not add credits again. */
export async function addCreditPack(tenantId: string, packId: string, provider: string, externalId?: string) {
  const pack = CREDIT_PACKS.find((item) => item.id === packId);
  if (!pack) throw new Error("UNKNOWN_PACK");
  const paymentId = (externalId || "").trim();
  const money = withGst(pack.priceExGst);
  const replay = async () => {
    if (!paymentId) return null;
    const prior = await prisma.creditPackGrant.findUnique({ where: { externalId: paymentId } });
    if (!prior) return null;
    return { credits: pack.credits, invoiceNumber: prior.invoiceNumber, totalInr: money.totalInr, alreadyApplied: true as const };
  };
  const existing = await replay();
  if (existing) return existing;
  try {
    return await prisma.$transaction(async (tx) => {
      if (paymentId) {
        await tx.creditPackGrant.create({
          data: { externalId: paymentId, tenantId, packId, provider },
        });
      }
      const tenant = await tx.tenant.update({
        where: { id: tenantId },
        data: { creditBalance: { increment: pack.credits } },
      });
      await tx.creditLedger.create({
        data: {
          tenantId,
          delta: pack.credits,
          reason: "PACK",
          refId: paymentId || pack.id,
          balanceAfter: tenant.creditBalance,
        },
      });
      const tax = gstEnabled();
      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          number: await allocateReceiptNumber(tx),
          amountExGst: pack.priceExGst,
          gstInr: money.gstInr,
          totalInr: money.totalInr,
          description: `${pack.credits} try-ons via ${provider}`,
          status: "PAID",
          upiRef: paymentId,
          documentKind: tax ? "TAX_INVOICE" : "RECEIPT",
        },
      });
      if (paymentId) {
        await tx.creditPackGrant.update({
          where: { externalId: paymentId },
          data: { invoiceNumber: invoice.number },
        });
      }
      return { credits: pack.credits, invoiceNumber: invoice.number, totalInr: invoice.totalInr, alreadyApplied: false as const };
    });
  } catch (error) {
    const prior = await replay();
    if (prior && uniqueConflict(error)) return prior;
    throw error;
  }
}

export function trialEndFromNow() {
  const end = new Date();
  end.setDate(end.getDate() + TRIAL_DAYS);
  return end;
}
