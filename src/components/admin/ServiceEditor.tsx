"use client";

import { useState } from "react";
import { BRIDAL_PACKAGE_KEYS } from "@/data/bridal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Row = { id: string; key: string; name: string; priceInr: number; durationMin: number | null; active: boolean };

function serviceKey(name: string) {
  const key = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return key.length >= 2 ? key : "service";
}

export function ServiceEditor({ initial, bridal, canEdit }: { initial: Row[]; bridal: boolean; canEdit: boolean }) {
  const [rows, setRows] = useState(initial.filter((row) => bridal || !BRIDAL_PACKAGE_KEYS.has(row.key)));
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const key = serviceKey(name);
    const priceInr = Math.max(0, Math.round(Number(price) || 0));
    const res = await fetch("/api/v1/admin/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, name, priceInr }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id) {
      setMessage(data.message || "Could not save that price.");
      return;
    }
    setRows((current) => [...current.filter((row) => row.key !== key), { id: data.id, key, name, priceInr, durationMin: null, active: true }]);
    setName("");
    setPrice("");
    setMessage("Saved.");
  }

  async function patch(row: Row, body: Record<string, unknown>, next: Partial<Row>) {
    const res = await fetch(`/api/v1/admin/services/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setMessage("Could not update that price.");
      return;
    }
    setRows((current) => current.map((item) => (item.id === row.id ? { ...item, ...next } : item)));
  }

  async function remove(row: Row) {
    const res = await fetch(`/api/v1/admin/services/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      setMessage("Could not delete that price.");
      return;
    }
    setRows((current) => current.filter((item) => item.id !== row.id));
  }

  return (
    <div>
      {rows.length === 0 ? <p className="text-sm text-muted">No prices yet.</p> : null}
      <ul className="grid gap-2" data-service-count={rows.length}>
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
            {canEdit ? (
              <label className="sr-only" htmlFor={`price-${row.id}`}>Price for {row.name}</label>
            ) : null}
            <span className="text-muted">₹</span>
            <input
              id={`price-${row.id}`}
              className="field narrow"
              inputMode="numeric"
              aria-label={`${row.name} price`}
              defaultValue={row.priceInr}
              disabled={!canEdit}
              onBlur={(event) => {
                if (!canEdit) return;
                const priceInr = Math.max(0, Math.round(Number(event.target.value) || 0));
                void patch(row, { priceInr }, { priceInr });
              }}
            />
            <input
              type="checkbox"
              role="switch"
              aria-label={`${row.name} on`}
              checked={row.active}
              disabled={!canEdit}
              onChange={(event) => void patch(row, { active: event.target.checked }, { active: event.target.checked })}
            />
            {canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="btn secondary px-2" type="button" aria-label={`More for ${row.name}`}>⋯</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => void remove(row)}>Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={add}>
          <input className="field min-w-0 flex-1" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} required aria-label="Service name" />
          <input className="field narrow" inputMode="numeric" placeholder="₹" value={price} onChange={(event) => setPrice(event.target.value)} aria-label="Price in rupees" />
          <button className="btn" type="submit">Add</button>
        </form>
      ) : <p className="mt-3 text-sm text-muted">Only the owner can change prices.</p>}
      {message ? <p className="mt-2 text-sm" role="status">{message}</p> : null}
    </div>
  );
}
