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

function rateSentence(stats: Stats) {
  if (!stats.remindedCustomers) return "No reminders in the last 90 days yet. The pilot target is 20% of reminded people joining again from the link.";
  const pct = Math.round((stats.returnedCustomers / stats.remindedCustomers) * 100);
  return `${stats.returnedCustomers} of ${stats.remindedCustomers} people reminded in the last 90 days joined again from the link (${pct}%). The pilot target is 20%.`;
}

export function CustomersBoard({
  role,
  initialCustomers,
  initialStats,
  settings,
  whatsapp,
  homeLink,
  tryOnLink,
  tries,
}: {
  role: string;
  initialCustomers: Customer[];
  initialStats: Stats;
  settings: Settings;
  whatsapp: "off" | "template" | "ready";
  homeLink: string;
  tryOnLink: string;
  tries: { used: number; allowance: number } | null;
}) {
  const owner = role === "OWNER";
  const [customers, setCustomers] = useState(initialCustomers);
  const [stats, setStats] = useState(initialStats);
  const [form, setForm] = useState(settings);
  const [query, setQuery] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [importText, setImportText] = useState("");
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
      <section className="card grid gap-2 p-4" data-return-panel="yes">
        <div className="grid gap-3 sm:grid-cols-4">
          <p><span className="block text-xs uppercase tracking-[0.14em] text-muted">Reminders sent</span><span className="font-serif text-3xl" data-reminders-sent={stats.remindersSent}>{stats.remindersSent}</span></p>
          <p><span className="block text-xs uppercase tracking-[0.14em] text-muted">Offers sent</span><span className="font-serif text-3xl">{stats.offersSent}</span></p>
          <p><span className="block text-xs uppercase tracking-[0.14em] text-muted">WhatsApp used</span><span className="font-serif text-3xl" data-whatsapp-used={stats.used}>{stats.used} of {stats.cap}</span></p>
          <p><span className="block text-xs uppercase tracking-[0.14em] text-muted">Came back</span><span className="font-serif text-3xl" data-returns={stats.returnsThisMonth}>{stats.returnsThisMonth}</span></p>
        </div>
        <p className="text-sm" data-return-rate="yes">{rateSentence(stats)}</p>
        {tries ? <p className="text-sm text-muted">{tries.used} of {tries.allowance} included try-ons used this month. Change the allowance in Settings.</p> : null}
        {whatsapp === "off" ? <p className="text-sm">WhatsApp is not connected, so reminders and offers are waiting and the monthly limit is not used.</p> : null}
        {whatsapp === "template" ? <p className="text-sm">WhatsApp is connected, but the reminder or offer template name is missing, so those messages are waiting.</p> : null}
        {whatsapp === "ready" ? <p className="text-sm text-muted">WhatsApp is connected.</p> : null}
        <p className="break-all text-sm">Join from home: {homeLink}</p>
        <p className="break-all text-sm">Try a look: {tryOnLink}</p>
      </section>

      {owner ? (
        <form
          className="card grid gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void act({ action: "settings", remindersOn: form.remindersOn, reminderDays: Number(form.reminderDays), whatsappMonthlyCap: Number(form.whatsappMonthlyCap) });
          }}
        >
          <h2 className="font-serif text-2xl">Reminder settings</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.remindersOn} onChange={(event) => setForm({ ...form, remindersOn: event.target.checked })} />
            Send a reminder after the last visit
          </label>
          <label className="text-sm">Days after the last visit
            <input className="field mt-1" type="number" min={28} max={42} aria-label="Days after the last visit" value={form.reminderDays} onChange={(event) => setForm({ ...form, reminderDays: Number(event.target.value) })} />
          </label>
          <label className="text-sm">WhatsApp reminders and offers this month
            <input className="field mt-1" type="number" min={0} max={5000} aria-label="Monthly WhatsApp limit" value={form.whatsappMonthlyCap} onChange={(event) => setForm({ ...form, whatsappMonthlyCap: Number(event.target.value) })} />
          </label>
          <p className="text-xs text-muted">People with a last visit older than this interval are reminded on the next check, up to the monthly limit. Live queue messages are not counted in the limit. The WhatsApp button on the queue desk opens a chat on the staff phone and is not counted either.</p>
          <button className="btn" type="submit" disabled={busy}>Save reminder settings</button>
        </form>
      ) : <p className="text-sm text-muted">The owner sets reminders and offers.</p>}

      {owner ? (
        <form
          className="card grid gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void act({ action: "broadcast", text: offer });
          }}
        >
          <h2 className="font-serif text-2xl">Send an offer</h2>
          <textarea className="field min-h-24" maxLength={180} aria-label="Offer" value={offer} onChange={(event) => setOffer(event.target.value)} placeholder="Festival week: haircut and blow-dry at the usual chair." />
          <button className="btn" type="submit" disabled={busy}>Send offer</button>
        </form>
      ) : null}

      <form
        className="card grid gap-3 p-4"
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
        <h2 className="font-serif text-2xl">Add a number</h2>
        <label className="text-sm">Phone
          <input className="field mt-1" inputMode="tel" aria-label="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="text-sm">Name, if you have it
          <input className="field mt-1" aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
        </label>
        <button className="btn" type="submit" disabled={busy}>Add number</button>
      </form>

      <form
        className="card grid gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void act({ action: "import", text: importText }).then((ok) => {
            if (ok) setImportText("");
          });
        }}
      >
        <h2 className="font-serif text-2xl">Import</h2>
        <p className="text-sm text-muted">One person per line. A date is optional: 9876543210, Asha, 2026-09-01</p>
        <textarea className="field min-h-28" aria-label="Import numbers" value={importText} onChange={(event) => setImportText(event.target.value)} />
        <button className="btn" type="submit" disabled={busy}>Save numbers</button>
      </form>

      {notice ? <p className="text-sm" role="status">{notice}</p> : null}

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Saved numbers</h2>
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
        {customers.length === 0 ? <p className="text-sm text-muted">No numbers saved yet.</p> : null}
        {customers.length === 100 ? <p className="text-sm text-muted">Showing the first 100. Search to narrow.</p> : null}
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
            {!row.stop && row.optedOut && !row.canResume ? <p className="text-sm">Reminders are off</p> : null}
          </article>
        ))}
      </section>
    </div>
  );
}
