import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";

export async function GET(req: Request) {
  const access = await requireOwner();
  if ("error" in access && access.error) return access.error;
  if (!("tenant" in access)) return NextResponse.json({ error: "NO_TENANT" }, { status: 403 });
  const rows = await prisma.payment.findMany({
    where: { tenantId: access.tenant.id, kind: "SALON_PLAN" },
    orderBy: { createdAt: "desc" },
    take: 24,
  });
  return NextResponse.json({
    payments: rows.map((row) => ({
      id: row.id,
      date: row.paidAt?.toISOString() || row.createdAt.toISOString(),
      amountPaise: row.amountPaise,
      status: row.status,
      receiptNumber: row.receiptNumber,
      razorpayPaymentId: row.razorpayPaymentId,
      refundId: row.refundId,
    })),
  });
}