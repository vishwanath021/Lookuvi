"use client";

import { useEffect, useState } from "react";

type Plan = {
  id: string;
  name: string;
  pricePaise: number;
  intervalMonths: number;
  active: boolean;
};

export function SalonPlansBoard() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [name, setName] = useState("Lookuvi Salon");
  const [priceRupees, setPriceRupees] = useState(799);
  const [months, setMonths] = useState(1);
  const [active, setActive] = useState(true);
  const [editId, setEditId] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const res = await fetch("/api/v1/super/salon-plans");
    const data = (await res.json()) as { plans: Plan[] };
    setPlans(data.plans || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/v1/super/salon-plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: editId || undefined,
        name,
        pricePaise: Math.round(priceRupees * 100),
        intervalMonths: months,
        active,
      }),
    });
    if (!res.ok) {
      setNote("Could not save plan.");
      return;
    }
    setNote("Saved.");
    setEditId("");
    await load();
  }

  return (
    <main className="p-6">
      <h1 className="page-title">Salon billing plans</h1>
      <form className="card mt-4 grid max-w-md gap-2 p-4" onSubmit={(event) => void save(event)}>
        <label className="text-sm">
          Name
          <input className="field mt-1" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="text-sm">
          Price (₹, incl. GST on invoice)
          <input className="field mt-1" type="number" min={1} value={priceRupees} onChange={(event) => setPriceRupees(Number(event.target.value))} />
        </label>
        <label className="text-sm">
          Interval (months)
          <input className="field mt-1" type="number" min={1} value={months} onChange={(event) => setMonths(Number(event.target.value))} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          Active
        </label>
        <button className="btn" type="submit">{editId ? "Update plan" : "Add plan"}</button>
        {note ? <p className="text-sm">{note}</p> : null}
      </form>
      <ul className="mt-6 text-sm">
        {plans.map((plan) => (
          <li key={plan.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2">
            <span>
              {plan.name} · ₹{(plan.pricePaise / 100).toLocaleString("en-IN")} / {plan.intervalMonths} mo · {plan.active ? "active" : "off"}
            </span>
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                setEditId(plan.id);
                setName(plan.name);
                setPriceRupees(plan.pricePaise / 100);
                setMonths(plan.intervalMonths);
                setActive(plan.active);
              }}
            >
              Edit
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}