import { NextResponse } from "next/server";
import { requireMembership } from "@/lib/session";
import { resolveSession, unlockVisit, visitStatus, visitsToday } from "@/lib/visit-allowance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireMembership();
  if ("error" in access && access.error) return access.error;
  if (!("tenant" in access)) return NextResponse.json({ error: "AUTH" }, { status: 401 });
  const visits = await visitsToday(access.tenant.id);
  return NextResponse.json({ visits, limit: access.tenant.visitTryLimit });
}

export async function POST(req: Request) {
  const access = await requireMembership();
  if ("error" in access && access.error) return access.error;
  if (!("tenant" in access)) return NextResponse.json({ error: "AUTH" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const code = String(body?.sessionId || body?.code || "");
  const sessionId = await resolveSession(access.tenant.id, code);
  if (!sessionId) {
    return NextResponse.json({ error: "SESSION", message: "No visit matches that code." }, { status: 404 });
  }
  await unlockVisit(access.tenant.id, sessionId, access.tenant.visitTryLimit);
  const status = await visitStatus(access.tenant.id, sessionId, access.tenant.visitTryLimit);
  return NextResponse.json({ ok: true, sessionId, code: sessionId.slice(-8), ...status });
}
