import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addCustomer,
  adjustCustomerPoints,
  deskOptOut,
  importCustomers,
  listCustomers,
  resumeReminders,
  returnStats,
  saveReminderSettings,
} from "@/lib/customers/service";
import { listLapsed } from "@/lib/customers/lapsed";
import { sendBroadcast, sendComeBack } from "@/lib/reminders";
import { customerActionNeedsOwner } from "@/lib/desk-role";
import { requireMembership, requireOwner } from "@/lib/session";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), phone: z.string().max(20), name: z.string().max(80).optional() }),
  z.object({ action: z.literal("import"), text: z.string().max(40_000) }),
  z.object({ action: z.literal("stop"), id: z.string().min(1).max(40) }),
  z.object({ action: z.literal("resume"), id: z.string().min(1).max(40) }),
  z.object({
    action: z.literal("settings"),
    remindersOn: z.boolean(),
    reminderDays: z.number().int(),
    whatsappMonthlyCap: z.number().int(),
  }),
  z.object({ action: z.literal("broadcast"), text: z.string().max(200) }),
  z.object({ action: z.literal("comeback"), ids: z.array(z.string().min(1).max(40)).min(1).max(100) }),
  z.object({
    action: z.literal("adjust"),
    id: z.string().min(1).max(40),
    delta: z.number().int().min(-100).max(100),
    reason: z.string().trim().min(1).max(120),
  }),
]);

async function member() {
  const access = await requireMembership();
  if ("error" in access && access.error) return access.error;
  if (!("tenant" in access)) return NextResponse.json({ error: "NO_TENANT" }, { status: 403 });
  return access;
}

export async function GET(req: Request) {
  const access = await member();
  if (access instanceof NextResponse) return access;
  const q = new URL(req.url).searchParams.get("q") || "";
  const [customers, stats, lapsed] = await Promise.all([
    listCustomers(access.tenant.id, q),
    returnStats(access.tenant.id),
    listLapsed(access.tenant.id),
  ]);
  return NextResponse.json({
    customers,
    lapsed,
    stats: { ...stats, cap: access.tenant.whatsappMonthlyCap },
    settings: {
      remindersOn: access.tenant.remindersOn,
      reminderDays: access.tenant.reminderDays,
      whatsappMonthlyCap: access.tenant.whatsappMonthlyCap,
    },
  });
}

export async function POST(req: Request) {
  const access = await member();
  if (access instanceof NextResponse) return access;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID", message: "That update was not understood." }, { status: 400 });
  const body = parsed.data;
  const tenantId = access.tenant.id;
  if (customerActionNeedsOwner(body.action)) {
    const owner = await requireOwner();
    if ("error" in owner && owner.error) return owner.error;
  }
  if (body.action === "add") {
    const result = await addCustomer(tenantId, body.phone, body.name || "");
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }
  if (body.action === "import") {
    const result = await importCustomers(tenantId, body.text);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }
  if (body.action === "adjust") {
    const result = await adjustCustomerPoints(tenantId, body.id, body.delta, body.reason, access.session.user.id);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }
  if (body.action === "stop") return NextResponse.json(await deskOptOut(tenantId, body.id));
  if (body.action === "resume") return NextResponse.json(await resumeReminders(tenantId, body.id));
  if (body.action === "settings") {
    return NextResponse.json(await saveReminderSettings(tenantId, body));
  }
  if (body.action === "comeback") {
    const result = await sendComeBack(tenantId, body.ids);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }
  const result = await sendBroadcast(tenantId, body.text);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
