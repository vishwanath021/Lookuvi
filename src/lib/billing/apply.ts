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

export async function addCreditPack(tenantId: string, packId: string, provider: string, externalId?: string) {
  const pack = CREDIT_PACKS.find((item) => item.id === packId);
  if (!pack) throw new Error("UNKNOWN_PACK");
  await grantCredits(tenantId, pack.credits, "PACK", externalId || pack.id);
  const money = withGst(pack.priceExGst);
  const tax = gstEnabled();
  const invoice = await prisma.invoice.create({
    data: {
      tenantId,
      number: await nextInvoiceNumber(),
      amountExGst: pack.priceExGst,
      gstInr: money.gstInr,
      totalInr: money.totalInr,
      description: `${pack.credits} try-ons via ${provider}`,
      status: "PAID",
      upiRef: externalId || "",
      documentKind: tax ? "TAX_INVOICE" : "RECEIPT",
    },
  });
  return { credits: pack.credits, invoiceNumber: invoice.number, totalInr: invoice.totalInr };
}

export function trialEndFromNow() {
  const end = new Date();
  end.setDate(end.getDate() + TRIAL_DAYS);
  return end;
}
