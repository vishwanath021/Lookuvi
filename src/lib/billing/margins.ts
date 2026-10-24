import { PLANS } from "@/data/plans";
import { kolkataMonthStart, SPEND_CAP_STATUSES } from "@/lib/ai/spend";
import { prisma } from "@/lib/prisma";

export type SalonMargin = {
  id: string;
  name: string;
  plan: string;
  planName: string;
  paidInr: number;
  tryOns: number;
  aiCostInr: number;
  marginInr: number;
};

export async function monthSpendTiles(now = new Date()) {
  const since = kolkataMonthStart(now);
  const [spend, images] = await Promise.all([
    prisma.aiCall.aggregate({
      where: { createdAt: { gte: since }, status: { in: [...SPEND_CAP_STATUSES] } },
      _sum: { costInrPaise: true },
    }),
    prisma.tryOn.count({ where: { createdAt: { gte: since }, status: "SUCCEEDED" } }),
  ]);
  const monthInr = Math.round(spend._sum.costInrPaise || 0) / 100;
  const averageInr = images === 0 ? null : Math.round((monthInr / images) * 100) / 100;
  return { monthInr, images, averageInr };
}

export async function salonMargins(now = new Date()): Promise<SalonMargin[]> {
  const since = kolkataMonthStart(now);
  const [tenants, invoices, calls, tries] = await Promise.all([
    prisma.tenant.findMany({ select: { id: true, name: true, plan: true }, orderBy: { name: "asc" } }),
    prisma.invoice.groupBy({
      by: ["tenantId"],
      where: { status: "PAID", createdAt: { gte: since } },
      _sum: { totalInr: true },
    }),
    prisma.aiCall.groupBy({
      by: ["tenantId"],
      where: { createdAt: { gte: since }, status: { in: [...SPEND_CAP_STATUSES] } },
      _sum: { costInrPaise: true },
    }),
    prisma.tryOn.groupBy({
      by: ["tenantId"],
      where: { createdAt: { gte: since }, status: "SUCCEEDED" },
      _count: { _all: true },
    }),
  ]);
  const paid = new Map(invoices.map((row) => [row.tenantId, row._sum.totalInr || 0]));
  const cost = new Map(calls.map((row) => [row.tenantId, Math.round(row._sum.costInrPaise || 0) / 100]));
  const used = new Map(tries.map((row) => [row.tenantId, row._count._all]));
  return tenants.map((tenant) => {
    const plan = PLANS[tenant.plan as keyof typeof PLANS];
    const paidInr = paid.get(tenant.id) || 0;
    const aiCostInr = cost.get(tenant.id) || 0;
    return {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
      planName: plan?.name || tenant.plan,
      paidInr,
      tryOns: used.get(tenant.id) || 0,
      aiCostInr,
      marginInr: Math.round((paidInr - aiCostInr) * 100) / 100,
    };
  });
}
