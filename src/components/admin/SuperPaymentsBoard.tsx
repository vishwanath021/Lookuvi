"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  salon: string;
  slug: string;
  kind: string;
  status: string;
  amountPaise: number;
  receiptNumber: string;
  createdAt: string;
  flagged: boolean;
  flagReason: string;
  planName: string;
};

export function SuperPaymentsBoard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/v1/super/razorpay-payments?flagged=${flaggedOnly ? "1" : "0"}`);
      const data = (await res.json()) as { payments: Row[] };
      setRows(data.payments || []);
    })();
  }, [flaggedOnly]);

  return (
    <main className="p-6">
      <h1 className="page-title">Razorpay payments</h1>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={flaggedOnly} onChange={(event) => setFlaggedOnly(event.target.checked)} />
        Flagged only
      </label>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-2">Salon</th>
            <th>Kind</th>
            <th>Status</th>
            <th>Amount</th>
            <th>Receipt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-line">
              <td className="py-2">{row.salon} <span className="text-muted">({row.slug})</span></td>
              <td>{row.kind}{row.planName ? ` · ${row.planName}` : ""}</td>
              <td>{row.status}{row.flagged ? ` · ${row.flagReason}` : ""}</td>
              <td>₹{(row.amountPaise / 100).toLocaleString("en-IN")}</td>
              <td>{row.receiptNumber}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}