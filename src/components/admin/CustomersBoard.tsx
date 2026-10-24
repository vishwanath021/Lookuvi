"use client";

import { useState } from "react";

type Customer = {
  id: string;
  name: string;
  phone: string;
  phoneLabel: string;
  visitCount: number;
  lastVisitAt: string;
  lastVisitLabel: string;
  optedOut: boolean;
  stop: boolean;
  canResume: boolean;
};

type Stats = {
  remindersSent: number;
  offersSent: number;
  used: number;
  cap: number;
  remindedCustomers: number;
  returnedCustomers: number;
  returnsThisMonth: number;
};

type Settings = { remindersOn: boolean; reminderDays: number; whatsappMonthlyCap: number };

export function CustomersBoard({
  role,
  initialCustomers,
  initialStats,
  settings,
  whatsapp,
}: {
  role: string;
  initialCustomers: Customer[];
  initialStats: Stats;
  settings: Settings;
  whatsapp: "off" | "template" | "ready";
}) {
  const owner = role === "OWNER";
  const [customers, setCustomers] = useState(initialCustomers);
  const [stats, setStats] = useState(initialStats);
  const [form, setForm] = useState(settings);
  const [query, setQuery] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [offer, setOffer] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload(nextQuery = query) {
    const res = await fetch(`/api/v1/admin/customers?q=${encodeURIComponent(nextQuery)}`);
    const data = await res.json();
    if (data.customers) setCustomers(data.customers);
    if (data.stats) setStats(data.stats);
    if (data.settings) setForm(data.settings);
  }

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setNotice("");
    const res = await fetch("/api/v1/admin/customers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setNotice(data.message || (res.ok ? "Saved." : "That did not work."));
    if (res.ok) await reload();
    setBusy(false);
    return res.ok;
  }

  return (
    <div className="mt-4 grid gap-4">
      <section className="card grid gap-3 p-4" data-return-panel="yes">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <p><span className="block text-xs uppercase tracking-[0.14em] text-muted">Reminders</span><span className="font-serif text-3xl" data-reminders-sent={stats.remindersSent}>{stats.remindersSent}</span></p>
          <p><span className="block text-xs uppercase tracking-[0.14em] text-muted">Offers</span><span className="font-serif text-3xl">{stats.offersSent}</span></p>
          <p><span className="block text-xs uppercase tracking-[0.14em] text-muted">WhatsApp used</span><span className="font-serif text-3xl" data-whatsapp-used={stats.used}>{stats.used} of {stats.cap}</span></p>
          <p><span className="block text-xs uppercase tracking-[0.14em] text-muted">Came back</span><span className="font-serif text-3xl" data-returns={stats.returnsThisMonth}>{stats.returnsThisMonth}</span></p>
        </div>
        {whatsapp !== "ready" ? <p className="rounded-xl bg-[#f8efdc] px-3 py-2 text-sm" role="status">WhatsApp is not connected. Reminders are paused.</p> : null}
      </section>

      <form
        className="card grid gap-2 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void act({ action: "add", phone, name }).then((ok) => {
            if (ok) {
              setPhone("");
              setName("");
            }
          });
        }}
      >
        <h2 className="text-base font-semibold">Add customer</h2>
        <div className="flex flex-wrap gap-2">
          <input className="field min-w-0 flex-1" inputMode="tel" aria-label="Phone" placeholder="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} required />
          <input className="field min-w-0 flex-1" aria-label="Name" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
          <button className="btn" type="submit" disabled={busy}>Add</button>
        </div>
        <label className="text-sm">
          CSV
          <input
            className="mt-1 block text-sm"
            type="file"
            accept=".csv,text/csv,text/plain"
            aria-label="CSV upload"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file.text().then((text) => act({ action: "import", text }));
              event.target.value = "";
            }}
          />
        </label>
      </form>

      {owner ? (
        <form
          className="card grid gap-2 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void act({ action: "settings", remindersOn: form.remindersOn, reminderDays: Number(form.reminderDays), whatsappMonthlyCap: Number(form.whatsappMonthlyCap) });
          }}
        >
          <h2 className="text-base font-semibold">Reminders</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.remindersOn} onChange={(event) => setForm({ ...form, remindersOn: event.target.checked })} />
            On
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="text-sm">Days
              <input className="field narrow mt-1" type="number" min={28} max={42} aria-label="Days after the last visit" value={form.reminderDays} onChange={(event) => setForm({ ...form, reminderDays: Number(event.target.value) })} />
            </label>
            <label className="text-sm">Monthly cap
              <input className="field narrow mt-1" type="number" min={0} max={5000} aria-label="Monthly WhatsApp limit" value={form.whatsappMonthlyCap} onChange={(event) => setForm({ ...form, whatsappMonthlyCap: Number(event.target.value) })} />
            </label>
          </div>
          <button className="btn w-fit" type="submit" disabled={busy}>Save</button>
        </form>
      ) : null}

      {owner ? (
        <form
          className="card flex flex-wrap items-center gap-2 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void act({ action: "broadcast", text: offer });
          }}
        >
          <input className="field min-w-0 flex-1" maxLength={180} aria-label="Offer" value={offer} onChange={(event) => setOffer(event.target.value)} placeholder="Offer" />
          <button className="btn" type="submit" disabled={busy}>Send offer</button>
        </form>
      ) : null}

      {notice ? <p className="text-sm" role="status">{notice}</p> : null}

      <section className="grid gap-3">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void reload(query);
          }}
        >
          <input className="field" aria-label="Search customers" placeholder="Name or phone" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button className="btn secondary" type="submit" disabled={busy}>Search</button>
        </form>
        {customers.length === 0 ? <p className="text-sm text-muted">No customers yet.</p> : null}
        {customers.map((row) => (
          <article key={row.id} className="card grid gap-1 p-4" data-customer-phone={row.phone}>
            <p className="text-lg">{row.name || "No name"}</p>
            <p className="text-sm">{row.phoneLabel}</p>
            <p className="text-sm text-muted">{row.visitCount} {row.visitCount === 1 ? "visit" : "visits"} · {row.lastVisitLabel}</p>
            {row.stop ? <p className="text-sm">Replied STOP</p> : null}
            {!row.stop && row.canResume && owner ? (
              <button className="btn secondary mt-2 w-fit" type="button" disabled={busy} onClick={() => void act({ action: "resume", id: row.id })}>Turn reminders on</button>
            ) : null}
            {!row.stop && row.canResume && !owner ? <p className="text-sm">Stopped at the desk</p> : null}
            {!row.stop && !row.optedOut ? (
              <button className="btn secondary mt-2 w-fit" type="button" disabled={busy} onClick={() => void act({ action: "stop", id: row.id })}>Stop reminders</button>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
