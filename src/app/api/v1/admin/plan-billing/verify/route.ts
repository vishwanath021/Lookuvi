import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCheckoutCallbackSignature } from "@/lib/payments/callback-signature";
import { paymentsUnavailableMessage, razorpayConfigured } from "@/lib/payments/config";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";

const schema = z.object({
  paymentId: z.string().min(1),
  orderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  signature: z.string().min(1),
});

/** Verifies checkout callback signature; webhook remains source of truth for paid. */
export async function POST(req: Request) {
  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "PAYMENTS_UNAVAILABLE", message: paymentsUnavailableMessage() }, { status: 503 });
  }
  const access = await requireOwner();
  if ("error" in access && access.error) return access.error;
  if (!("tenant" in access)) return NextResponse.json({ error: "NO_TENANT" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const row = await prisma.payment.findFirst({
    where: { id: parsed.data.paymentId, tenantId: access.tenant.id, orderId: parsed.data.orderId },
  });
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  const ok = verifyCheckoutCallbackSignature(parsed.data.orderId, parsed.data.razorpayPaymentId, parsed.data.signature, secret);
  if (!ok) return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  if (row.razorpayPaymentId && row.razorpayPaymentId !== parsed.data.razorpayPaymentId) {
    return NextResponse.json({ error: "PAYMENT_MISMATCH" }, { status: 400 });
  }
  if (!row.razorpayPaymentId) {
    await prisma.payment.update({
      where: { id: row.id },
      data: { razorpayPaymentId: parsed.data.razorpayPaymentId },
    });
  }
  return NextResponse.json({ ok: true, status: row.status, poll: true });
}