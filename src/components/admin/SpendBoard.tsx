"use client";

import { useMemo, useState } from "react";
import { PLANS } from "@/data/plans";
import type { SalonMargin } from "@/lib/billing/margins";
import { formatAiInr } from "@/lib/display";

type Tiles = { monthInr: number; images: number; averageInr: number | null };
type Key = "name" | "plan" | "paid" | "tries" | "cost" | "margin";

export function SpendBoard({ tiles, rows }: { tiles: Tiles; rows: SalonMargin[] }) {
  const [sort, setSort] = useState<Key>("margin");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [plan, setPlan] = useState("");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = rows.filter((row) => {
      if (plan && row.plan !== plan) return false;
      if (needle && !row.name.toLowerCase().includes(needle)) return false;
      return true;
    });
    const value = (row: SalonMargin) => {
      if (sort === "name") return row.name;
      if (sort === "plan") return row.planName;
      if (sort === "paid") return row.paidInr;
      if (sort === "tries") return row.tryOns;
      if (sort === "cost") return row.aiCostInr;
      return row.marginInr;
    };
    list.sort((a, b) => {
      const left = value(a);
      const right = value(b);
      const cmp = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right));
      return dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, plan, query, sort, dir]);

  function head(key: Key, label: string) {
    return (
      <th className="py-2 pr-3">
        <button
          className="text-xs uppercase text-muted"
          type="button"
          onClick={() => {
            if (sort === key) setDir((current) => (current === "asc" ? "desc" : "asc"));
            else {
              setSort(key);
              setDir(key === "name" || key === "plan" ? "asc" : "desc");
            }
          }}
        >
          {label}{sort === key ? (dir === "asc" ? " ↑" : " ↓") : ""}
        </button>
      </th>
    );
  }

  return (
    <div>
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <article className="card p-4">
          <p className="text-sm text-muted">Month spend</p>
          <p className="mt-1 font-serif text-3xl">{formatAiInr(tiles.monthInr)}</p>
        </article>
        <article className="card p-4">
          <p className="text-sm text-muted">Images</p>
          <p className="mt-1 font-serif text-3xl">{tiles.images.toLocaleString("en-IN")}</p>
        </article>
        <article className="card p-4">
          <p className="text-sm text-muted">Average ₹/image</p>
          <p className="mt-1 font-serif text-3xl">{tiles.averageInr == null ? "—" : formatAiInr(tiles.averageInr)}</p>
        </article>
      </section>
      <div className="mt-6 flex flex-wrap gap-2">
        <input className="field max-w-xs" aria-label="Search salons" placeholder="Salon" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className="field max-w-[12rem]" aria-label="Plan" value={plan} onChange={(event) => setPlan(event.target.value)}>
          <option value="">All plans</option>
          {Object.values(PLANS).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <a className="btn secondary" href="/super/costs/log">Image log</a>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {head("name", "Salon")}
              {head("plan", "Plan")}
              {head("paid", "Paid")}
              {head("tries", "Try-ons used")}
              {head("cost", "AI cost")}
              {head("margin", "Margin")}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="py-2 pr-3 font-medium">{row.name}</td>
                <td className="py-2 pr-3">{row.planName}</td>
                <td className="py-2 pr-3">₹{row.paidInr.toLocaleString("en-IN")}</td>
                <td className="py-2 pr-3">{row.tryOns}</td>
                <td className="py-2 pr-3">{formatAiInr(row.aiCostInr)}</td>
                <td className="py-2 pr-3" style={row.marginInr < 0 ? { color: "var(--bad)" } : undefined}>{formatAiInr(row.marginInr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
