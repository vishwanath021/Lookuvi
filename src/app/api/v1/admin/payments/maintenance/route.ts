import { NextResponse } from "next/server";
import { expireStalePayments } from "@/lib/payments/expiry";
import { requireSuper } from "@/lib/session";

/** Admin-protected expiry cleanup when cron is not available. */
export async function POST() {
  const access = await requireSuper();
  if ("error" in access && access.error) return access.error;
  const expired = await expireStalePayments();
  return NextResponse.json({ ok: true, expired });
}