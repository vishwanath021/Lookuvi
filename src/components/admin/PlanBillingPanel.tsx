"use client";

import { useCallback, useEffect, useState } from "react";
type Plan = { id: string; name: string; pricePaise: number; intervalMonths: number };
type HistoryRow = {
  id: string;
  date: string;
  amountPaise: number;
  status: string;
  receiptNumber: string;
  razorpayPaymentId: string;
  refundId: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export function PlanBillingPanel({
  paidUntil,
  currentPlan,
  plans,
  paymentsEnabled,
  gstin,
  unavailableMessage,
  gstLabel,
}: {
  paidUntil: string | null;
  currentPlan: Plan | null;
  plans: Plan[];
  paymentsEnabled: boolean;
  gstin: string;
  unavailableMessage: string;
  gstLabel: string;
}) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/v1/admin/plan-billing/history");
    if (!res.ok) return;
    const data = (await res.json()) as { payments: HistoryRow[] };
    setHistory(data.payments || []);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!paymentsEnabled) return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [paymentsEnabled]);

  async function payNow(planId: string) {
    if (!paymentsEnabled) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/v1/admin/plan-billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ salonPlanId: planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || "Checkout unavailable.");
        return;
      }
      const Razorpay = window.Razorpay;
      if (!Razorpay) {
        setMessage("Payment widget failed to load.");
        return;
      }
      const checkout = new Razorpay({
        key: data.keyId,
        amount: data.amountPaise,
        currency: data.currency,
        name: "Lookuvi",
        description: currentPlan?.name || "Salon plan",
        order_id: data.orderId,
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          await fetch("/api/v1/admin/plan-billing/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              paymentId: data.paymentId,
              orderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            }),
          });
          window.location.href = `/admin/billing/status?paymentId=${encodeURIComponent(data.paymentId)}`;
        },
        modal: {
          ondismiss: () => {
            setMessage("Payment not completed. You haven't been charged. You can try again.");
          },
        },
      });
      checkout.open();
    } finally {
      setLoading(false);
    }
  }

  const paidUntilLabel = paidUntil ? new Date(paidUntil).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "Not paid";

  return (
    <section className="card mt-4 grid gap-3 p-4" data-plan-billing>
      <h2 className="text-base font-semibold">Salon plan</h2>
      <p className="text-sm">
        Current plan: <strong>{currentPlan?.name || "None"}</strong> · Paid until: <strong>{paidUntilLabel}</strong>
      </p>
      {gstin ? <p className="text-xs text-muted">GSTIN: {gstin}</p> : null}
      <p className="text-xs text-muted">
        Prices are {gstLabel}.{" "}
        <a className="underline" href="/refund">Refund &amp; cancellation</a>
      </p>
      {!paymentsEnabled ? <p className="text-sm text-muted">{unavailableMessage}</p> : null}
      <div className="grid gap-2 md:grid-cols-2">
        {plans.map((plan) => (
          <article key={plan.id} className="rounded border border-line p-3">
            <h3 className="font-semibold">{plan.name}</h3>
            <p className="text-sm">
              {formatPaise(plan.pricePaise)} / {plan.intervalMonths} mo ({gstLabel})
            </p>
            {paymentsEnabled ? (
              <button className="btn mt-2" type="button" disabled={loading} onClick={() => void payNow(plan.id)}>
                Pay now
              </button>
            ) : null}
          </article>
        ))}
      </div>
      <h3 className="text-sm font-semibold">Payment history</h3>
      {history.length === 0 ? <p className="text-sm text-muted">No online payments yet.</p> : null}
      <ul className="text-sm">
        {history.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2">
            <span>
              {new Date(row.date).toLocaleDateString("en-IN")} · {formatPaise(row.amountPaise)} · {row.status}
            </span>
            <span className="text-xs text-muted">
              {row.receiptNumber}
              {row.razorpayPaymentId ? ` · ${row.razorpayPaymentId}` : ""}
              {row.refundId ? ` · refund ${row.refundId}` : ""}
            </span>
          </li>
        ))}
      </ul>
      {message ? <p className="text-sm" role="status">{message}</p> : null}
    </section>
  );
}