import { openUpiPayment } from "@/lib/billing/upi-flow";
import { OWNER_PLAN_MESSAGE, ownerSelfServeBlocked } from "@/lib/billing/access";
import type { BillingProvider } from "@/lib/billing/types";

export class MockBilling implements BillingProvider {
  name = "mock";

  async createSubscription(input: { tenantId: string; plan: string; interval: "monthly" | "yearly" }) {
    if (ownerSelfServeBlocked()) throw new Error(OWNER_PLAN_MESSAGE);
    const pending = await openUpiPayment({ tenantId: input.tenantId, kind: "PLAN", plan: input.plan, interval: input.interval });
    return { checkoutUrl: pending.checkoutUrl, externalId: pending.externalId };
  }

  async createCreditPackOrder(input: { tenantId: string; packId: string }) {
    if (ownerSelfServeBlocked()) throw new Error(OWNER_PLAN_MESSAGE);
    const pending = await openUpiPayment({ tenantId: input.tenantId, kind: "PACK", packId: input.packId });
    return { checkoutUrl: pending.checkoutUrl, externalId: pending.externalId };
  }

  async cancelSubscription(externalId: string) {
    const { prisma } = await import("@/lib/prisma");
    await prisma.subscription.updateMany({ where: { externalId }, data: { status: "CANCELLED" } });
  }

  async handleWebhook(): Promise<import("@/lib/billing/types").BillingEvent> {
    return { type: "ignored", externalId: "mock" };
  }
}
