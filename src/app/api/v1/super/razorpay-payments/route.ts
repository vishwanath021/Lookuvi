import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuper } from "@/lib/session";

export async function GET(req: Request) {
  const access = await requireSuper();
  if ("error" in access && access.error) return access.error;
  const flaggedOnly = new URL(req.url).searchParams.get("flagged") === "1";
  const tenantId = new URL(req.url).searchParams.get("tenantId") || "";
  const payments = await prisma.payment.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      ...(flaggedOnly ? { flagged: true } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { tenant: { select: { name: true, slug: true } }, salonPlan: true },
  });
  return NextResponse.json({
    payments: payments.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      salon: row.tenant.name,
      slug: row.tenant.slug,
      kind: row.kind,
      status: row.status,
      amountPaise: row.amountPaise,
      receiptNumber: row.receiptNumber,
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt?.toISOString() || null,
      flagged: row.flagged,
      flagReason: row.flagReason,
      planName: row.salonPlan?.name || "",
    })),
  });
}