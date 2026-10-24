import QRCode from "qrcode";
import { CREDIT_PACKS, planById, type PlanId } from "@/data/plans";
import { activatePlan, addCreditPack } from "@/lib/billing/apply";
import { upiAccount, upiPayLink } from "@/lib/billing/upi";
import { annualExGst, withGst } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

function chargeInr(kind: "PLAN" | "PACK", plan: string, packId: string, interval: "monthly" | "yearly") {
  if (kind === "PACK") {
    const pack = CREDIT_PACKS.find((item) => item.id === packId);
    if (!pack) throw new Error("UNKNOWN_PACK");
    return { amountInr: withGst(pack.priceExGst).totalInr, label: `${pack.credits} try-ons` };
  }
  const item = planById(plan);
  const ex = interval === "yearly" ? annualExGst(item.monthlyExGst) : item.monthlyExGst;
  return { amountInr: withGst(ex).totalInr, label: `${item.name} ${interval}` };
}

export async function openUpiPayment(input: {
  tenantId: string;
  kind: "PLAN" | "PACK";
  plan?: string;
  packId?: string;
  interval?: "monthly" | "yearly";
}) {
  const interval = input.interval || "monthly";
  const plan = input.plan || "";
  const packId = input.packId || "";
  const money = chargeInr(input.kind, plan, packId, interval);
  const existing = await prisma.paymentRequest.findFirst({
    where: { tenantId: input.tenantId, kind: input.kind, plan, packId, interval, status: "PENDING", amountInr: money.amountInr },
    orderBy: { createdAt: "desc" },
  });
  const row = existing || await prisma.paymentRequest.create({
    data: {
      tenantId: input.tenantId,
      kind: input.kind,
      plan,
      packId,
      interval,
      amountInr: money.amountInr,
      status: "PENDING",
    },
  });
  const account = upiAccount();
  const upiUri = upiPayLink({ pa: account.id, amountInr: row.amountInr, note: money.label });
  const qrDataUrl = await QRCode.toDataURL(upiUri, { margin: 1, width: 280 });
  return {
    pending: true as const,
    paymentId: row.id,
    amountInr: row.amountInr,
    label: money.label,
    upiId: account.id,
    upiPlaceholder: account.placeholder,
    upiUri,
    qrDataUrl,
    checkoutUrl: "/admin/billing",
    externalId: row.id,
  };
}

export async function markPaymentPaid(input: { paymentId: string; upiRef: string; actorId: string }) {
  const upiRef = input.upiRef.trim();
  if (!/^[A-Za-z0-9]{6,32}$/.test(upiRef)) throw new Error("UPI_REF");
  const payment = await prisma.paymentRequest.findUnique({ where: { id: input.paymentId } });
  if (!payment || payment.status !== "PENDING") throw new Error("NOT_PENDING");
  try {
    await prisma.upiReference.create({ data: { ref: upiRef, paymentId: payment.id } });
  } catch {
    throw new Error("UPI_USED");
  }
  const claimed = await prisma.paymentRequest.updateMany({
    where: { id: payment.id, status: "PENDING" },
    data: { status: "PAYING", upiRef },
  });
  if (claimed.count !== 1) {
    await prisma.upiReference.delete({ where: { ref: upiRef } }).catch(() => undefined);
    throw new Error("NOT_PENDING");
  }
  try {
    const result = payment.kind === "PACK"
      ? await addCreditPack(payment.tenantId, payment.packId, "upi", upiRef)
      : await activatePlan({
        tenantId: payment.tenantId,
        plan: payment.plan,
        interval: payment.interval === "yearly" ? "yearly" : "monthly",
        provider: "upi",
        externalId: upiRef,
        chargeSetup: false,
      });
    const invoice = await prisma.invoice.findFirst({ where: { number: result.invoiceNumber } });
    await prisma.paymentRequest.update({
      where: { id: payment.id },
      data: { status: "PAID", paidAt: new Date(), invoiceId: invoice?.id || "", upiRef },
    });
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "MARK_PAID",
        target: payment.tenantId,
        meta: JSON.stringify({ upiRef, invoice: result.invoiceNumber, plan: payment.plan, packId: payment.packId }),
      },
    });
    return { ...result, paymentId: payment.id, invoiceId: invoice?.id || "" };
  } catch (error) {
    await prisma.paymentRequest.update({ where: { id: payment.id }, data: { status: "PENDING", upiRef: "" } }).catch(() => undefined);
    await prisma.upiReference.delete({ where: { ref: upiRef } }).catch(() => undefined);
    throw error;
  }
}

export async function ensurePendingAndPay(input: {
  tenantId: string;
  upiRef: string;
  actorId: string;
  plan?: PlanId | string;
  packId?: string;
  interval?: "monthly" | "yearly";
  paymentId?: string;
}) {
  if (input.paymentId) return markPaymentPaid({ paymentId: input.paymentId, upiRef: input.upiRef, actorId: input.actorId });
  const opened = await openUpiPayment({
    tenantId: input.tenantId,
    kind: input.packId ? "PACK" : "PLAN",
    plan: input.plan,
    packId: input.packId,
    interval: input.interval,
  });
  return markPaymentPaid({ paymentId: opened.paymentId, upiRef: input.upiRef, actorId: input.actorId });
}
