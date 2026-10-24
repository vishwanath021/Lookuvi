import { planById } from "@/data/plans";
import { grantCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

/**
 * Tries added when the plan moves up. The mark is the highest plan inclusion
 * already granted, so a downgrade and a second upgrade add nothing.
 * Goodwill and other adjustments do not change the mark.
 */
export function planUpgradeCredits(includedCreditMark: number, nextPlanId: string) {
  return Math.max(0, planById(nextPlanId).credits - Math.max(0, includedCreditMark));
}

/**
 * dailyCap follows the new plan only while it is still the previous plan's
 * included credit count (the value set when the salon was created).
 * A custom daily cap is left alone.
 */
export function dailyCapAfterPlanChange(currentDailyCap: number, previousPlanId: string, nextPlanId: string) {
  if (currentDailyCap !== planById(previousPlanId).credits) return currentDailyCap;
  return planById(nextPlanId).credits;
}

export async function applyPlanChange(tenantId: string, nextPlanId: string) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const next = planById(nextPlanId);
  const creditsGranted = planUpgradeCredits(tenant.includedCreditMark, next.id);
  const dailyCap = dailyCapAfterPlanChange(tenant.dailyCap, tenant.plan, next.id);
  const includedCreditMark = Math.max(tenant.includedCreditMark, next.credits);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: next.id, dailyCap, includedCreditMark },
  });
  let balance = tenant.creditBalance;
  if (creditsGranted > 0) {
    balance = await grantCredits(tenantId, creditsGranted, "PLAN_ASSIGN", `plan:${tenant.plan}->${next.id}`);
  }
  return { plan: next.id, creditsGranted, dailyCap, balance, includedCreditMark };
}
