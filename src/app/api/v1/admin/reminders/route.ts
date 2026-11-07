import { NextResponse } from "next/server";
import { z } from "zod";
import { tooMany } from "@/lib/http/guard";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { dueVisitIntro, REMINDER_MARK_LIMIT, REMINDER_MARK_WINDOW_MS } from "@/lib/visit-reminders";
import { listDueVisits, markReminded, undoReminder } from "@/lib/visit-reminders-data";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark"), id: z.string().min(1).max(40) }),
  z.object({ action: z.literal("undo"), id: z.string().min(1).max(40) }),
]);

async function owner() {
  const access = await requireOwner();
  if ("error" in access && access.error) return access.error;
  if (!("tenant" in access) || !("session" in access)) return NextResponse.json({ error: "OWNER_ONLY" }, { status: 403 });
  return access;
}

export async function GET() {
  const access = await owner();
  if (access instanceof NextResponse) return access;
  const listed = await listDueVisits(access.tenant);
  return NextResponse.json({
    customers: listed.customers,
    days: listed.days,
    intro: dueVisitIntro(listed.days),
  });
}

export async function POST(req: Request) {
  const access = await owner();
  if (access instanceof NextResponse) return access;
  const limited = await tooMany(req, `remind-mark:${access.session.user.id}`, REMINDER_MARK_LIMIT, REMINDER_MARK_WINDOW_MS);
  if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID", message: "That update was not understood." }, { status: 400 });
  const tenantId = access.tenant.id;
  if (parsed.data.action === "undo") {
    const result = await undoReminder({ tenantId, reminderId: parsed.data.id });
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  }
  const result = await markReminded({ tenantId, customerId: parsed.data.id, userId: access.session.user.id });
  if (!result.ok) return NextResponse.json(result, { status: 404 });
  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.id, tenantId },
    select: { phone: true },
  });
  return NextResponse.json({ ...result, phone: customer?.phone || "" });
}
