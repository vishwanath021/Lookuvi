import { NextResponse } from "next/server";
import { receiptPdf } from "@/lib/billing/receipt-pdf";
import { legalName } from "@/lib/env";
import { gstEnabled } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { requireMembership, requireSuper } from "@/lib/session";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { tenant: { select: { name: true } } } });
  if (!invoice) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const superAccess = await requireSuper();
  const member = await requireMembership();
  const superOk = !("error" in superAccess && superAccess.error);
  const ownerOk = !("error" in member && member.error) && "tenant" in member && member.tenant.id === invoice.tenantId && member.membership.role === "OWNER";
  if (!superOk && !ownerOk) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const tax = invoice.documentKind === "TAX_INVOICE" && gstEnabled();
  const pdf = receiptPdf([
    legalName(),
    tax ? "Tax invoice" : "Receipt",
    tax ? "" : "This is a receipt, not a tax invoice.",
    `Number ${invoice.number}`,
    `Salon ${invoice.tenant.name}`,
    invoice.description,
    `Amount Rs ${invoice.totalInr}`,
    invoice.gstInr > 0 ? `GST Rs ${invoice.gstInr}` : "GST not charged",
    invoice.upiRef ? `UPI reference ${invoice.upiRef}` : "",
    invoice.createdAt.toISOString().slice(0, 10),
  ].filter(Boolean));
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${invoice.number}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
