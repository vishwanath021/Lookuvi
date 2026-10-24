import { NextResponse } from "next/server";
import { requireMembership } from "@/lib/session";

/** Owner style toggles are retired. Tags are platform data on /super/styles. */
export async function PUT() {
  const access = await requireMembership();
  if ("error" in access && access.error) return access.error;
  return NextResponse.json({ error: "PLATFORM", message: "Styles are managed by Lookuvi." }, { status: 403 });
}
