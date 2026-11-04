import { NextResponse } from "next/server";
import { cachedSpendSummary } from "@/lib/ai/spend";
import { requireSuper } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Month spend for the AI page. Cached so a refresh does not recount the ledger. */
export async function GET() {
  const access = await requireSuper();
  if ("error" in access && access.error) return access.error;
  const spend = await cachedSpendSummary();
  return NextResponse.json({
    spentInr: spend.spentInr,
    capInr: spend.capInr,
    calls: spend.calls,
    pending: false,
  });
}
