import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { closedGuestHub } from "@/lib/feature-gate";
import { tooMany } from "@/lib/http/guard";
import { readGuestToken } from "@/lib/preview-access";
import { paymentsUnavailableMessage, razorpayConfigured, razorpayPublicKeyId } from "@/lib/payments/config";
import { createBookingDepositCheckout } from "@/lib/payments/checkout";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  slug: z.string(),
  bookingId: z.string().min(1),
});

export async function POST(req: Request) {
  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "PAYMENTS_UNAVAILABLE", message: paymentsUnavailableMessage() }, { status: 503 });
  }
  const closed = closedGuestHub();
  if (closed) return closed;
  const limited = await tooMany(req, "booking-deposit-checkout", 12, 60 * 60 * 1000);
  if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { slug: parsed.data.slug } });
  const guest = readGuestToken((await cookies()).get("helix_guest")?.value);
  if (!tenant || !guest || guest.tenantId !== tenant.id) {
    return NextResponse.json({ error: "AUTH" }, { status: 401 });
  }
  if (tenant.bookingDepositPaise < 1) {
    return NextResponse.json({ error: "DEPOSIT_OFF" }, { status: 400 });
  }
  try {
    const checkout = await createBookingDepositCheckout({
      tenantId: tenant.id,
      bookingId: parsed.data.bookingId,
      amountPaise: tenant.bookingDepositPaise,
    });
    return NextResponse.json({ ...checkout, keyId: razorpayPublicKeyId() });
  } catch (error) {
    const code = error instanceof Error ? error.message : "CHECKOUT";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}