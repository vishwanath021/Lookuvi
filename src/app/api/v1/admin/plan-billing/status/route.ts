import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";

export async function GET(req: Request) {
  const access = await requireOwner();
  if ("error" in access && access.error) return access.error;
  if (!("tenant" in access)) return NextResponse.json({ error: "NO_TENANT" }, { status: 403 });
  const paymentId = new URL(req.url).searchParams.get("paymentId") || "";
  if (!paymentId) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const row = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId: access.tenant.id },
    include: { salonPlan: true },
  });
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const tenant = await prisma.tenant.findUnique({ where: { id: access.tenant.id } });
  return NextResponse.json({
    status: row.status,
    paidUntil: tenant?.paidUntil?.toISOString() || null,
    amountPaise: row.amountPaise,
    receiptNumber: row.receiptNumber,
    razorpayPaymentId: row.razorpayPaymentId,
    planName: row.salonPlan?.name || "",
    flagged: row.flagged,
  });
}