import { prisma } from "@/lib/prisma";

/** Moves TRIAL salons whose end date has passed to EXPIRED. Does not touch ACTIVE or SUSPENDED. */
export async function expireTrials(now = new Date()) {
  const result = await prisma.tenant.updateMany({
    where: { status: "TRIAL", trialEndsAt: { lt: now } },
    data: { status: "EXPIRED" },
  });
  return result.count;
}
