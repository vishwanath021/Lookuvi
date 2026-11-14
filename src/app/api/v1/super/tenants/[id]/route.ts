import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isPlanId } from "@/data/plans";
import { applyPlanChange } from "@/lib/billing/plan-assign";
import { CreditError, grantCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { ensureBridalPackages } from "@/lib/bridal-packages";
import { hoursWrite } from "@/lib/queue/schedule";
import { requireSuper } from "@/lib/session";

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  status: z.enum(["TRIAL", "ACTIVE", "SUSPENDED", "EXPIRED"]).optional(),
  plan: z.string().optional(),
  creditDelta: z.number().int().min(-100000).max(100000).optional(),
  note: z.string().max(200).optional(),
  productTryOn: z.boolean().optional(),
  productQueue: z.boolean().optional(),
  productBridal: z.boolean().optional(),
  productGroom: z.boolean().optional(),
  productMakeupStudio: z.boolean().optional(),
  openTime: z.string().max(8).nullable().optional(),
  closeTime: z.string().max(8).nullable().optional(),
  weeklyHours: z.string().max(4000).nullable().optional(),
  anonDailyCap: z.number().int().min(0).max(500).optional(),
  memberDailyCap: z.number().int().min(0).max(500).optional(),
  monthlyTryAllowance: z.number().int().min(0).max(5000).optional(),
  visitTryLimit: z.number().int().min(1).max(20).optional(),
  teamLogins: z.boolean().optional(),
  remove: z.literal(true).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireSuper();
  if ("error" in access && access.error) return access.error;
  if (!("session" in access)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID", message: "That salon update was not understood." }, { status: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "NOT_FOUND", message: "That salon was not found." }, { status: 404 });
  if (parsed.data.remove) {
    const deletedAt = new Date();
    const removed = await prisma.tenant.updateMany({ where: { id, deletedAt: null }, data: { deletedAt } });
    if (!removed.count) return NextResponse.json({ error: "NOT_FOUND", message: "That salon was not found." }, { status: 404 });
    await prisma.auditLog.create({
      data: {
        actorId: access.session.user.id,
        action: "SALON_DELETE",
        target: id,
        meta: JSON.stringify({ slug: tenant.slug, deletedAt: deletedAt.toISOString() }),
      },
    });
    return NextResponse.json({ ok: true, deleted: true });
  }
  if (parsed.data.plan && !isPlanId(parsed.data.plan)) return NextResponse.json({ error: "PLAN" }, { status: 400 });
  let hours: { openTime: string; closeTime: string; weeklyHours: string; hoursOverride: string; hoursOverrideUntil: Date | null } | undefined;
  if (parsed.data.openTime !== undefined || parsed.data.closeTime !== undefined || parsed.data.weeklyHours !== undefined) {
    const written = hoursWrite({
      weeklyHours: parsed.data.weeklyHours,
      openTime: parsed.data.openTime,
      closeTime: parsed.data.closeTime,
    });
    if (!written.ok) return NextResponse.json({ error: "HOURS", message: written.message }, { status: 400 });
    const changed = written.weeklyHours !== tenant.weeklyHours || written.openTime !== tenant.openTime || written.closeTime !== tenant.closeTime;
    hours = {
      openTime: written.openTime,
      closeTime: written.closeTime,
      weeklyHours: written.weeklyHours,
      hoursOverride: changed ? "" : tenant.hoursOverride,
      hoursOverrideUntil: changed ? null : tenant.hoursOverrideUntil,
    };
  }
  const planChange = parsed.data.plan && isPlanId(parsed.data.plan) ? await applyPlanChange(id, parsed.data.plan) : null;
  const patch: Record<string, unknown> = { ...(hours ?? {}) };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.productTryOn !== undefined) patch.productTryOn = parsed.data.productTryOn;
  if (parsed.data.productQueue !== undefined) patch.productQueue = parsed.data.productQueue;
  if (parsed.data.productBridal !== undefined) patch.productBridal = parsed.data.productBridal;
  if (parsed.data.productGroom !== undefined) patch.productGroom = parsed.data.productGroom;
  if (parsed.data.productMakeupStudio !== undefined) patch.productMakeupStudio = parsed.data.productMakeupStudio;
  if (parsed.data.anonDailyCap !== undefined) patch.anonDailyCap = parsed.data.anonDailyCap;
  if (parsed.data.memberDailyCap !== undefined) patch.memberDailyCap = parsed.data.memberDailyCap;
  if (parsed.data.monthlyTryAllowance !== undefined) patch.monthlyTryAllowance = parsed.data.monthlyTryAllowance;
  if (parsed.data.visitTryLimit !== undefined) patch.visitTryLimit = parsed.data.visitTryLimit;
  if (parsed.data.teamLogins !== undefined) patch.teamLogins = parsed.data.teamLogins;
  if (Object.keys(patch).length) {
    await prisma.tenant.update({ where: { id }, data: patch as Prisma.TenantUpdateInput });
  }
  if (parsed.data.productBridal === true) await ensureBridalPackages(id);
  if (planChange) {
    await prisma.auditLog.create({
      data: {
        actorId: access.session.user.id,
        action: "PLAN_ASSIGN",
        target: id,
        meta: JSON.stringify({ plan: planChange.plan, creditsGranted: planChange.creditsGranted, dailyCap: planChange.dailyCap }),
      },
    });
  }
  if (parsed.data.creditDelta) {
    let balance: number;
    try {
      balance = await grantCredits(id, parsed.data.creditDelta, "ADJUSTMENT", "super", parsed.data.note || "");
    } catch (error) {
      if (error instanceof CreditError) {
        return NextResponse.json({ error: "INSUFFICIENT", message: "The balance can't go below zero." }, { status: 400 });
      }
      throw error;
    }
    await prisma.auditLog.create({
      data: {
        actorId: access.session.user.id,
        action: "CREDIT_ADJUST",
        target: id,
        meta: JSON.stringify({ creditDelta: parsed.data.creditDelta, balanceAfter: balance, note: parsed.data.note || "" }),
      },
    });
  }
  const productChange = parsed.data.productTryOn !== undefined || parsed.data.productQueue !== undefined || parsed.data.productBridal !== undefined || parsed.data.productGroom !== undefined || parsed.data.productMakeupStudio !== undefined;
  if (!planChange && !parsed.data.creditDelta) {
    await prisma.auditLog.create({
      data: {
        actorId: access.session.user.id,
        action: "TENANT_UPDATE",
        target: id,
        meta: JSON.stringify(parsed.data),
      },
    });
  } else if (productChange) {
    await prisma.auditLog.create({
      data: {
        actorId: access.session.user.id,
        action: "TENANT_UPDATE",
        target: id,
        meta: JSON.stringify({ productTryOn: parsed.data.productTryOn, productQueue: parsed.data.productQueue, productBridal: parsed.data.productBridal, productGroom: parsed.data.productGroom, productMakeupStudio: parsed.data.productMakeupStudio }),
      },
    });
  }
  return NextResponse.json({
    ok: true,
    ...(planChange ? { plan: planChange.plan, creditsGranted: planChange.creditsGranted, dailyCap: planChange.dailyCap } : {}),
  });
}
