import { NextResponse } from "next/server";
import { z } from "zod";
import { tooMany } from "@/lib/http/guard";
import { paymentsUnavailableMessage, razorpayConfigured, razorpayPublicKeyId } from "@/lib/payments/config";
import { createSalonPlanCheckout } from "@/lib/payments/checkout";
import { requireOwner } from "@/lib/session";

const schema = z.object({ salonPlanId: z.string().min(1) });

export async function POST(req: Request) {
  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "PAYMENTS_UNAVAILABLE", message: paymentsUnavailableMessage() }, { status: 503 });
  }
  const limited = await tooMany(req, "plan-billing-checkout", 8, 15 * 60 * 1000);
  if (limited) return limited;
  const access = await requireOwner();
  if ("error" in access && access.error) return access.error;
  if (!("tenant" in access)) return NextResponse.json({ error: "NO_TENANT" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  try {
    const checkout = await createSalonPlanCheckout({
      tenantId: access.tenant.id,
      salonPlanId: parsed.data.salonPlanId,
      actorUserId: access.session.user.id,
    });
    return NextResponse.json({
      ...checkout,
      keyId: razorpayPublicKeyId(),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "CHECKOUT";
    const status = code === "PLAN_NOT_ACTIVE" ? 400 : 502;
    return NextResponse.json({ error: code, message: "Could not start checkout." }, { status });
  }
}