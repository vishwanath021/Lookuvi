import { planById } from "@/data/plans";
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

/**
 * Changes the plan name and the daily cap. It does not add try-ons and does not
 * mark the salon paid. Try-ons are added by Mark paid, a pack, or Adjust try-ons.
 */
export async function applyPlanChange(tenantId: string, nextPlanId: string) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const next = planById(nextPlanId);
  const dailyCap = dailyCapAfterPlanChange(tenant.dailyCap, tenant.plan, next.id);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: next.id, dailyCap },
  });
  return {
    plan: next.id,
    creditsGranted: 0,
    dailyCap,
    balance: tenant.creditBalance,
    includedCreditMark: tenant.includedCreditMark,
  };
}
