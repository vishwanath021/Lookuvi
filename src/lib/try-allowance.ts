import { AI_PREVIEW_KINDS } from "@/lib/preview-access";
import { prisma } from "@/lib/prisma";
import { kolkataMonthStart } from "@/lib/ai/spend";

export const DEFAULT_MONTHLY_TRY_ALLOWANCE = 30;

export const MONTHLY_TRY_MESSAGE = "This salon has used this month's included try-ons. Ask the salon to raise the allowance.";

export async function monthlySucceededTries(tenantId: string, now = new Date()) {
  return prisma.tryOn.count({
    where: {
      tenantId,
      status: "SUCCEEDED",
      kind: { in: [...AI_PREVIEW_KINDS] },
      createdAt: { gte: kolkataMonthStart(now) },
    },
  });
}

/** Hard count for the salon this month. Signed-in and anonymous daily caps stay where they are. */
export async function refuseMonthlyTries(tenantId: string, allowance: number, now = new Date()) {
  const cap = Math.max(0, allowance);
  const used = await monthlySucceededTries(tenantId, now);
  if (used >= cap) return { error: "MONTHLY_CAP" as const, message: MONTHLY_TRY_MESSAGE, used, allowance: cap };
  return null;
}
