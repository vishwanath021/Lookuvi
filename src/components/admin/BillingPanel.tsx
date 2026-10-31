"use client";

import { useState } from "react";
import { CREDIT_PACKS, PLANS, planById } from "@/data/plans";
import { formatInr } from "@/lib/json";
import { annualExGst } from "@/lib/pricing";

type Pending = {
  paymentId: string;
  amountInr: number;
  label: string;
  upiId: string;
  upiPlaceholder: boolean;
  upiUri: string;
  qrDataUrl: string;
};

export function BillingPanel({
  plan,
  status,
  credits,
  pending,
}: {
  plan: string;
  status: string;
  credits: number;
  provider?: string;
  locked?: boolean;
  pending?: Pending | null;
}) {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [current, setCurrent] = useState<Pending | null>(pending || null);
  const [message, setMessage] = useState("");
  const name = planById(plan).name;

  async function subscribe(nextPlan: string) {
    const res = await fetch("/api/v1/admin/billing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "subscribe", plan: nextPlan, interval }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.message || "Billing failed");
      return;
    }
    if (data.pending) {
      setCurrent(data);
      setMessage("Payment pending");
      return;
    }
    setMessage("Plan updated.");
    window.location.reload();
  }

  async function pack(packId: string) {
    const res = await fetch("/api/v1/admin/billing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pack", packId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.message || "Could not add try-ons");
      return;
    }
    if (data.pending) {
      setCurrent(data);
      setMessage("Payment pending");
      return;
    }
    setMessage("Try-ons added.");
    window.location.reload();
  }

  return (
    <div>
      <p className="text-sm">Current plan <strong>{name}</strong> · {status} · {credits.toLocaleString("en-IN")} try-ons left</p>
      <p className="mt-2 text-xs text-muted">
        Prices are shown before you pay. A plan renews for the same interval until you cancel or payment fails.
        {" "}
        <a className="underline" href="/refund">Refund &amp; cancellation</a>
        {" · "}
        <a className="underline" href="/grievance">Grievance</a>
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={interval === "yearly"} onChange={(event) => setInterval(event.target.checked ? "yearly" : "monthly")} />
        Annual (two months free)
      </label>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {Object.values(PLANS).map((item) => {
          const price = interval === "yearly" ? annualExGst(item.monthlyExGst) : item.monthlyExGst;
          return (
            <article key={item.id} className="card p-4">
              <h2 className="font-serif text-2xl">{item.name}</h2>
              <p>{formatInr(price)} · {item.credits} try-ons</p>
              <button className="btn mt-3" type="button" onClick={() => void subscribe(item.id)}>Choose</button>
            </article>
          );
        })}
      </div>
      <h2 className="mb-2 mt-6 text-base font-semibold">Try-on packs</h2>
      <div className="flex flex-wrap gap-2">
        {CREDIT_PACKS.map((item) => (
          <button key={item.id} className="btn secondary" type="button" onClick={() => void pack(item.id)}>
            {item.credits} · {formatInr(item.priceExGst)}
          </button>
        ))}
      </div>
      {current ? (
        <section className="card mt-4 grid gap-2 p-4" data-payment="pending">
          <h2 className="text-base font-semibold">Payment pending</h2>
          <p className="text-sm">{current.label} · {formatInr(current.amountInr)}</p>
          <p className="text-sm">UPI ID <strong>{current.upiId}</strong></p>
          {current.upiPlaceholder ? <p className="text-sm">Ask Lookuvi to confirm this UPI ID before you pay.</p> : null}
          <img src={current.qrDataUrl} alt="UPI QR" className="w-40" />
          <a className="text-sm underline" href={current.upiUri}>Open UPI app</a>
        </section>
      ) : null}
      {message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}
    </div>
  );
}
