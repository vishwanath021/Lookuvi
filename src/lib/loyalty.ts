import { prisma } from "@/lib/prisma";
import { indianMobile } from "@/lib/queue/phone";

export const POINTS_REMINDER_TEMPLATE = "Time for your next visit at {{1}}? You have {{2}} points at {{1}}. Join the queue from home: {{3}} Try a look: {{4}} Reply STOP to opt out.";

export function pointsBalanceLine(points: number, salon: string) {
  return `You have ${points} ${points === 1 ? "point" : "points"} at ${salon}.`;
}

export function applyDelta(balance: number, delta: number) {
  if (!Number.isInteger(delta) || delta === 0) return { ok: false as const, message: "Enter a whole number of points other than zero." };
  const next = balance + delta;
  if (next < 0) return { ok: false as const, message: "That would take the balance below 0." };
  if (next > 100_000) return { ok: false as const, message: "That is more points than this salon can store." };
  return { ok: true as const, next };
}

/** The cheapest reward still above the balance, or a line when every reward is already affordable. */
export function rewardProgress(balance: number, rewards: { name: string; cost: number }[]) {
  const sorted = rewards.filter((reward) => reward.cost > 0 && reward.name.trim()).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  const next = sorted.find((reward) => reward.cost > balance);
  if (next) {
    const more = next.cost - balance;
    return `${more} more for ${next.name}.`;
  }
  const top = sorted[sorted.length - 1];
  if (!top) return "";
  return `You can redeem ${top.name}.`;
}

function storedPhone(phone: string) {
  return indianMobile(phone) || phone.trim();
}

export async function pointsBalance(tenantId: string, phone: string) {
  const key = storedPhone(phone);
  if (!key) return 0;
  const sum = await prisma.loyaltyLedger.aggregate({ where: { tenantId, phone: key }, _sum: { delta: true } });
  return sum._sum.delta ?? 0;
}

export async function pointsBalances(tenantId: string, phones: string[]) {
  const keys = [...new Set(phones.map(storedPhone).filter(Boolean))];
  const balances = new Map<string, number>();
  if (!keys.length) return balances;
  const grouped = await prisma.loyaltyLedger.groupBy({
    by: ["phone"],
    where: { tenantId, phone: { in: keys } },
    _sum: { delta: true },
  });
  for (const row of grouped) balances.set(row.phone, row._sum.delta ?? 0);
  return balances;
}

export async function listRewards(tenantId: string) {
  const rows = await prisma.loyaltyReward.findMany({ where: { tenantId }, orderBy: [{ sort: "asc" }, { name: "asc" }] });
  return rows.map((row) => ({ id: row.id, name: row.name, cost: row.cost }));
}

export class LoyaltyError extends Error {}

export async function changePoints(input: {
  tenantId: string;
  phone: string;
  delta: number;
  kind: "earn" | "redeem" | "adjust";
  reason: string;
  staffId?: string;
  visitId?: string;
  rewardId?: string;
  /** A finished visit earns once, even if Finish is retried. */
  oncePerVisit?: boolean;
}) {
  const phone = storedPhone(input.phone);
  if (!phone) throw new LoyaltyError("Add a mobile number before changing points.");
  const reason = input.reason.trim().slice(0, 120);
  if (!reason) throw new LoyaltyError("Add a reason.");
  return prisma.$transaction(async (tx) => {
    if (input.oncePerVisit && input.visitId) {
      const prior = await tx.loyaltyLedger.findFirst({ where: { tenantId: input.tenantId, visitId: input.visitId, kind: "earn" } });
      if (prior) {
        const sum = await tx.loyaltyLedger.aggregate({ where: { tenantId: input.tenantId, phone }, _sum: { delta: true } });
        return { balance: sum._sum.delta ?? 0, created: false };
      }
    }
    const sum = await tx.loyaltyLedger.aggregate({ where: { tenantId: input.tenantId, phone }, _sum: { delta: true } });
    const applied = applyDelta(sum._sum.delta ?? 0, input.delta);
    if (!applied.ok) throw new LoyaltyError(applied.message);
    await tx.loyaltyLedger.create({
      data: {
        tenantId: input.tenantId,
        phone,
        delta: input.delta,
        kind: input.kind,
        reason,
        staffId: input.staffId || "",
        visitId: input.visitId || "",
        rewardId: input.rewardId || "",
        balanceAfter: applied.next,
      },
    });
    return { balance: applied.next, created: true };
  });
}

export async function earnVisitPoints(input: { tenantId: string; phone: string; visitId: string; staffId?: string; points: number }) {
  if (!Number.isInteger(input.points) || input.points < 1) return { balance: await pointsBalance(input.tenantId, input.phone), created: false };
  return changePoints({
    tenantId: input.tenantId,
    phone: input.phone,
    delta: input.points,
    kind: "earn",
    reason: "Visit finished",
    staffId: input.staffId,
    visitId: input.visitId,
    oncePerVisit: true,
  });
}

export async function redeemReward(input: { tenantId: string; phone: string; rewardId: string; staffId?: string; visitId?: string }) {
  const reward = await prisma.loyaltyReward.findFirst({ where: { id: input.rewardId, tenantId: input.tenantId } });
  if (!reward) throw new LoyaltyError("That reward is not on the list.");
  return changePoints({
    tenantId: input.tenantId,
    phone: input.phone,
    delta: -reward.cost,
    kind: "redeem",
    reason: reward.name,
    staffId: input.staffId,
    visitId: input.visitId,
    rewardId: reward.id,
  });
}

export async function replaceRewards(tenantId: string, rewards: { name: string; cost: number }[]) {
  const cleaned = rewards
    .map((reward) => ({ name: reward.name.trim().slice(0, 60), cost: reward.cost }))
    .filter((reward) => reward.name);
  if (cleaned.length > 5) throw new LoyaltyError("A salon can have up to 5 rewards.");
  if (cleaned.some((reward) => !Number.isInteger(reward.cost) || reward.cost < 1 || reward.cost > 9999)) {
    throw new LoyaltyError("Each reward needs a whole points cost from 1 to 9999.");
  }
  await prisma.$transaction([
    prisma.loyaltyReward.deleteMany({ where: { tenantId } }),
    ...(cleaned.length
      ? [prisma.loyaltyReward.createMany({ data: cleaned.map((reward, sort) => ({ tenantId, name: reward.name, cost: reward.cost, sort })) })]
      : []),
  ]);
  return listRewards(tenantId);
}
