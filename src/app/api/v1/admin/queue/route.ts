import { NextResponse } from "next/server";
import { z } from "zod";
import { queueJson } from "@/lib/queue/http";
import { dismissAsk, grantTries, markArrived } from "@/lib/at-salon";
import {
  addWalkIn,
  callNext,
  confirmRequest,
  declineRequest,
  deskSnapshot,
  finishEntry,
  redeemOnEntry,
  saveQueueSettings,
  setClosedToday,
  setQueueOpen,
  returnToLine,
  startEntry,
} from "@/lib/queue/service";
import { queueActionNeedsOwner } from "@/lib/desk-role";
import { requireMembership, requireOwner } from "@/lib/session";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open") }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("close-today") }),
  z.object({ action: z.literal("open-today") }),
  z.object({ action: z.literal("next") }),
  z.object({ action: z.literal("start"), id: z.string().min(1) }),
  z.object({ action: z.literal("return"), id: z.string().min(1) }),
  z.object({ action: z.literal("done"), id: z.string().min(1) }),
  z.object({ action: z.literal("redeem"), id: z.string().min(1), rewardId: z.string().min(1) }),
  z.object({ action: z.literal("noshow"), id: z.string().min(1) }),
  z.object({ action: z.literal("arrived"), id: z.string().min(1) }),
  z.object({ action: z.literal("dismiss"), id: z.string().min(1) }),
  z.object({ action: z.literal("tries"), id: z.string().min(1), extra: z.number() }),
  z.object({
    action: z.literal("walkin"),
    name: z.string().optional().transform((value) => (value ?? "").trim().slice(0, 80)),
    phone: z.string().optional().transform((value) => (value ?? "").trim().slice(0, 20)),
    serviceId: z.string().max(40).optional(),
  }),
  z.object({
    action: z.literal("confirm"),
    id: z.string().min(1),
    date: z.string().max(10).optional(),
    slot: z.string().max(5).optional(),
  }),
  z.object({ action: z.literal("decline"), id: z.string().min(1) }),
  z.object({
    action: z.literal("settings"),
    units: z.number().int().min(1).max(30),
    avgMinutes: z.number().int().min(5).max(240),
    alertLeadMin: z.number().int().min(0).max(120),
    mode: z.enum(["LIVE", "REQUEST"]),
    unitLabel: z.enum(["chair", "station", "room"]),
  }),
]);

function noStore(response: NextResponse) {
  response.headers.set("cache-control", "private, no-store");
  return response;
}

async function desk() {
  const access = await requireMembership();
  if ("error" in access && access.error) return access.error;
  if (!("tenant" in access)) return NextResponse.json({ error: "NO_TENANT" }, { status: 403 });
  return access;
}

export async function GET() {
  const access = await desk();
  if (access instanceof NextResponse) return noStore(access);
  try {
    return noStore(NextResponse.json(await deskSnapshot(access.tenant.id)));
  } catch (error) {
    const response = queueJson(error);
    if (response) return noStore(response);
    throw error;
  }
}

export async function POST(req: Request) {
  const access = await desk();
  if (access instanceof NextResponse) return noStore(access);
  const tenant = access.tenant;
  const staffId = access.session.user.id;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return noStore(NextResponse.json({ error: "INVALID", message: "That update was not understood." }, { status: 400 }));
  const body = parsed.data;
  try {
    if (queueActionNeedsOwner(body.action)) {
      const owner = await requireOwner();
      if ("error" in owner && owner.error) return noStore(owner.error);
    }
    if (body.action === "open") return noStore(NextResponse.json(await setQueueOpen(tenant.id, true)));
    if (body.action === "pause") return noStore(NextResponse.json(await setQueueOpen(tenant.id, false)));
    if (body.action === "close-today") return noStore(NextResponse.json(await setClosedToday(tenant.id, true)));
    if (body.action === "open-today") return noStore(NextResponse.json(await setClosedToday(tenant.id, false)));
    if (body.action === "next") return noStore(NextResponse.json(await callNext(tenant.id)));
    if (body.action === "start") return noStore(NextResponse.json(await startEntry(tenant.id, body.id)));
    if (body.action === "return") return noStore(NextResponse.json(await returnToLine(tenant.id, body.id)));
    if (body.action === "done") return noStore(NextResponse.json(await finishEntry(tenant.id, body.id, "DONE", undefined, staffId)));
    if (body.action === "redeem") return noStore(NextResponse.json(await redeemOnEntry(tenant.id, body.id, body.rewardId, staffId)));
    if (body.action === "noshow") return noStore(NextResponse.json(await finishEntry(tenant.id, body.id, "NO_SHOW", undefined, staffId)));
    if (body.action === "arrived" || body.action === "dismiss" || body.action === "tries") {
      const result = body.action === "arrived"
        ? await markArrived(tenant.id, body.id)
        : body.action === "dismiss"
          ? await dismissAsk(tenant.id, body.id)
          : await grantTries(tenant.id, body.id, body.extra);
      if (!result.ok) return noStore(NextResponse.json({ error: "QUEUE", message: result.message }, { status: result.status }));
      return noStore(NextResponse.json(await deskSnapshot(tenant.id)));
    }
    if (body.action === "walkin") return noStore(NextResponse.json(await addWalkIn(tenant.id, body)));
    if (body.action === "confirm") return noStore(NextResponse.json(await confirmRequest(tenant.id, body.id, body)));
    if (body.action === "decline") return noStore(NextResponse.json(await declineRequest(tenant.id, body.id)));
    return noStore(NextResponse.json(await saveQueueSettings(tenant.id, body)));
  } catch (error) {
    const response = queueJson(error);
    if (response) return noStore(response);
    throw error;
  }
}
