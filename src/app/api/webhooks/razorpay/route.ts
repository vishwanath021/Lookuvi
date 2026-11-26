import { NextResponse } from "next/server";
import { getBillingProvider } from "@/lib/billing";
import { billingProviderName } from "@/lib/env";
import { handleRazorpayPaymentWebhook } from "@/lib/payments/webhook";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && billingProviderName() === "mock") {
    return NextResponse.json({ error: "WEBHOOK_DISABLED" }, { status: 404 });
  }
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";
  const headerEventId = req.headers.get("x-razorpay-event-id") || "";
  try {
    const paymentEvent = await handleRazorpayPaymentWebhook(rawBody, signature, headerEventId);
    if (paymentEvent.duplicate) return NextResponse.json({ ok: true, duplicate: true, type: paymentEvent.type });
    if (paymentEvent.type !== "ignored" && !paymentEvent.missing) {
      return NextResponse.json({ ok: true, ...paymentEvent });
    }
    const event = await getBillingProvider().handleWebhook(rawBody, signature);
    if (event.type === "subscription.halted") {
      await prisma.subscription.updateMany({ where: { externalId: event.externalId }, data: { status: "HALTED" } });
    }
    return NextResponse.json({ ok: true, ...paymentEvent, legacyType: event.type });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WEBHOOK";
    const status = message === "INVALID_SIGNATURE" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}