import { planById } from "@/data/plans";
import { prisma } from "@/lib/prisma";

/**
 * Super-admin plan change does not grant credits.
 * The trial grant at salon creation is the first assignment.
 * A paid renewal grants one period through activatePlan, once per payment id.
 * To add the difference after an upgrade, use Adjust credits.
 * A downgrade never removes tries already on the salon.
 */
export function planUpgradeCredits() {
  return 0;
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
  const dailyCap = dailyCapAfterPlanChange(tenant.dailyCap, tenant.plan, next.id);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: next.id, dailyCap },
  });
  return { plan: next.id, creditsGranted: planUpgradeCredits(), dailyCap, balance: tenant.creditBalance };
}
