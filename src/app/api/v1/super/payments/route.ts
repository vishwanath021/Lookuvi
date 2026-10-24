import { NextResponse } from "next/server";
import { z } from "zod";
import { isPlanId } from "@/data/plans";
import { ensurePendingAndPay } from "@/lib/billing/upi-flow";
import { prisma } from "@/lib/prisma";
import { requireSuper } from "@/lib/session";

export async function GET(req: Request) {
  const access = await requireSuper();
  if ("error" in access && access.error) return access.error;
  const tenantId = new URL(req.url).searchParams.get("tenantId") || "";
  if (!tenantId) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const payments = await prisma.paymentRequest.findMany({
    where: { tenantId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  return NextResponse.json({
    payments: payments.map((row) => ({
      id: row.id,
      kind: row.kind,
      plan: row.plan,
      packId: row.packId,
      interval: row.interval,
      amountInr: row.amountInr,
    })),
  });
}

const bodySchema = z.object({
  tenantId: z.string().min(1),
  paymentId: z.string().optional(),
  upiRef: z.string().min(6).max(32),
  plan: z.string().optional(),
  packId: z.string().optional(),
  interval: z.enum(["monthly", "yearly"]).optional(),
});

export async function POST(req: Request) {
  const access = await requireSuper();
  if ("error" in access && access.error) return access.error;
  if (!("session" in access)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID", message: "Enter the UPI reference." }, { status: 400 });
  if (parsed.data.plan && !isPlanId(parsed.data.plan)) return NextResponse.json({ error: "PLAN" }, { status: 400 });
  try {
    const result = await ensurePendingAndPay({
      tenantId: parsed.data.tenantId,
      paymentId: parsed.data.paymentId,
      upiRef: parsed.data.upiRef,
      actorId: access.session.user.id,
      plan: parsed.data.plan,
      packId: parsed.data.packId,
      interval: parsed.data.interval,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "BILLING";
    const message = code === "UPI_REF"
      ? "Use the UPI reference from the payment, 6 to 32 letters or digits."
      : code === "UPI_USED"
        ? "That UPI reference is already used."
        : code === "NOT_PENDING"
          ? "That payment is no longer pending."
          : "Could not mark that payment.";
    return NextResponse.json({ error: code, message }, { status: 400 });
  }
}
