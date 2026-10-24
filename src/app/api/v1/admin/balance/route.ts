import { NextResponse } from "next/server";
import { requireMembership } from "@/lib/session";

export async function GET() {
  const access = await requireMembership();
  if ("error" in access && access.error) return access.error;
  if (!("tenant" in access)) return NextResponse.json({ error: "NO_TENANT" }, { status: 403 });
  return NextResponse.json({ credits: access.tenant.creditBalance, status: access.tenant.status });
}
