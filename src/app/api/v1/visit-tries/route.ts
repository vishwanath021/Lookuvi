import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_VISIT_TRY_LIMIT } from "@/lib/visit-tries";
import { visitStatus } from "@/lib/visit-allowance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || "";
  const sessionId = url.searchParams.get("sessionId") || "";
  if (!slug || sessionId.length < 8) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, visitTryLimit: true } });
  if (!tenant) return NextResponse.json({ error: "TENANT" }, { status: 404 });
  const status = await visitStatus(tenant.id, sessionId, tenant.visitTryLimit ?? DEFAULT_VISIT_TRY_LIMIT);
  return NextResponse.json({ used: status.used, allowance: status.allowance, allowed: status.allowed });
}
