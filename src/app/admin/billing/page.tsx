import { BillingPanel } from "@/components/admin/BillingPanel";
import { upiAccount, upiPayLink } from "@/lib/billing/upi";
import { billingProviderName, legalName } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { pageTenant } from "@/lib/session";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const { tenant, membership } = await pageTenant();
  const invoices = await prisma.invoice.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: 12 });
  if (membership.role !== "OWNER") {
    return <main><h1 className="page-title">Billing</h1><p className="mt-2 text-sm">Only the owner can change the plan.</p></main>;
  }
  const pendingRow = await prisma.paymentRequest.findFirst({
    where: { tenantId: tenant.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  let pending = null;
  if (pendingRow) {
    const account = upiAccount();
    const upiUri = upiPayLink({ pa: account.id, amountInr: pendingRow.amountInr, note: pendingRow.plan || pendingRow.packId || "Lookuvi" });
    pending = {
      paymentId: pendingRow.id,
      amountInr: pendingRow.amountInr,
      label: pendingRow.kind === "PACK" ? "Try-on pack" : `${pendingRow.plan} ${pendingRow.interval}`,
      upiId: account.id,
      upiPlaceholder: account.placeholder,
      upiUri,
      qrDataUrl: await QRCode.toDataURL(upiUri, { margin: 1, width: 280 }),
    };
  }
  return (
    <main>
      <h1 className="mb-4 page-title">Billing</h1>
      <BillingPanel plan={tenant.plan} status={tenant.status} credits={tenant.creditBalance} provider={billingProviderName()} pending={pending} />
      <h2 className="mb-2 mt-6 text-base font-semibold">Receipts</h2>
      <p className="mb-2 text-sm text-muted">{legalName()}</p>
      {invoices.length === 0 ? <p className="text-sm text-muted">No receipts yet.</p> : null}
      <ul className="text-sm">
        {invoices.map((invoice) => (
          <li key={invoice.id} className="flex items-center justify-between gap-3 border-b border-line py-2">
            <span>{invoice.number} · {invoice.description}</span>
            <span className="flex items-center gap-3">
              <span>₹{invoice.totalInr.toLocaleString("en-IN")}</span>
              <a className="underline" href={`/api/v1/receipts/${invoice.id}`}>Download</a>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
