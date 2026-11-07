import { NextResponse } from "next/server";
import { visitBudget } from "@/lib/at-salon";
import { AI_PREVIEW_KINDS } from "@/lib/preview-access";
import { prisma } from "@/lib/prisma";
import { DEFAULT_VISIT_TRY_LIMIT } from "@/lib/visit-tries";
import { visitStatus } from "@/lib/visit-allowance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || "";
  const sessionId = url.searchParams.get("sessionId") || "";
  const deviceId = url.searchParams.get("deviceId") || "";
  if (!slug || sessionId.length < 8) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, visitTryLimit: true, tryOnsAtSalon: true } });
  if (!tenant) return NextResponse.json({ error: "TENANT" }, { status: 404 });
  const limit = tenant.visitTryLimit ?? DEFAULT_VISIT_TRY_LIMIT;
  if (tenant.tryOnsAtSalon) {
    const budget = await visitBudget({ tenantId: tenant.id, sessionId, deviceId, limit, kinds: AI_PREVIEW_KINDS });
    return NextResponse.json({ used: budget.used, allowance: budget.allowance, allowed: budget.allowed });
  }
  const status = await visitStatus(tenant.id, sessionId, limit);
  return NextResponse.json({ used: status.used, allowance: status.allowance, allowed: status.allowed });
}
