"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = {
  status: string;
  paidUntil: string | null;
  amountPaise: number;
  receiptNumber: string;
  planName: string;
  flagged: boolean;
};

export default function BillingStatusPage() {
  const params = useSearchParams();
  const paymentId = params.get("paymentId") || "";
  const [row, setRow] = useState<Status | null>(null);
  const [note, setNote] = useState("Confirming payment…");

  useEffect(() => {
    if (!paymentId) return;
    let cancelled = false;
    let tries = 0;
    const poll = async () => {
      const res = await fetch(`/api/v1/admin/plan-billing/status?paymentId=${encodeURIComponent(paymentId)}`);
      const data = (await res.json()) as Status;
      if (cancelled) return;
      setRow(data);
      if (data.status === "paid") {
        setNote("Payment received. Your plan is active.");
        return;
      }
      if (data.status === "failed" || data.flagged) {
        setNote(data.flagged ? "Payment needs review. Support will contact you." : "Payment failed. You can try again from Plan & Billing.");
        return;
      }
      tries += 1;
      if (tries < 40) setTimeout(() => void poll(), 1500);
      else setNote("Still confirming. Refresh this page in a minute.");
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="page-title">Payment status</h1>
      <p className="mt-2 text-sm" role="status">{note}</p>
      {row ? (
        <dl className="card mt-4 grid gap-2 p-4 text-sm">
          <div className="flex justify-between gap-2">
            <dt>Status</dt>
            <dd>{row.status}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Plan</dt>
            <dd>{row.planName}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Receipt</dt>
            <dd>{row.receiptNumber}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Paid until</dt>
            <dd>{row.paidUntil ? new Date(row.paidUntil).toLocaleDateString("en-IN") : "—"}</dd>
          </div>
        </dl>
      ) : null}
      <a className="btn secondary mt-4 inline-block" href="/admin/billing">Back to Plan &amp; Billing</a>
    </main>
  );
}