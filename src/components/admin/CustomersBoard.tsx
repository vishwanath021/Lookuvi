"use client";

import { useEffect, useRef, useState } from "react";

type Customer = {
  id: string;
  name: string;
  phone: string;
  phoneLabel: string;
  points: number;
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

type LapsedCustomer = {
  id: string;
  name: string;
  phone: string;
  phoneLabel: string;
  points: number;
  visitCount: number;
  lastVisitLabel: string;
  optedOut: boolean;
};

type Lapsed = {
  summary: string;
  count: number;
  weeks6: LapsedCustomer[];
  months2: LapsedCustomer[];
  months3: LapsedCustomer[];
};

export function CustomersBoard({
  role,
  initialCustomers,
  initialStats,
  settings,
  whatsapp,
  initialLapsed,
}: {
  role: string;
  initialCustomers: Customer[];
  initialStats: Stats;
  settings: Settings;
  whatsapp: "off" | "template" | "ready";
  initialLapsed: Lapsed;
}) {
  const owner = role === "OWNER";
  const [customers, setCustomers] = useState(initialCustomers);
  const [lapsed, setLapsed] = useState(initialLapsed);
  const [stats, setStats] = useState(initialStats);
  const [form, setForm] = useState(settings);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [offer, setOffer] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const skipQueryFetch = useRef(true);
  const reloadRef = useRef<(nextQuery?: string) => Promise<void>>(async () => undefined);

  async function reload(nextQuery = query) {
    const res = await fetch(`/api/v1/admin/customers?q=${encodeURIComponent(nextQuery)}`);
    const data = await res.json();
    if (data.customers) setCustomers(data.customers);
    if (data.lapsed) setLapsed(data.lapsed);
    if (data.stats) setStats(data.stats);
    if (data.settings) setForm(data.settings);
  }

  reloadRef.current = reload;

  useEffect(() => {
    if (skipQueryFetch.current) {
      skipQueryFetch.current = false;
      return;
    }
    setPage(0);
    const timer = setTimeout(() => { void reloadRef.current(query); }, 300);
    return () => clearTimeout(timer);
  }, [query]);

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

      {owner ? <NotBackYet lapsed={lapsed} whatsapp={whatsapp} busy={busy} onSend={(ids) => void act({ action: "comeback", ids })} /> : null}

      {notice ? <p className="text-sm" role="status">{notice}</p> : null}

      <CustomerTable customers={customers} query={query} page={page} busy={busy} owner={owner} onQuery={setQuery} onPage={setPage} onAct={(body) => void act(body)} />
    </div>
  );
}

const CUSTOMER_PAGE = 8;

function CustomerTable({
  customers,
  query,
  page,
  busy,
  owner,
  onQuery,
  onPage,
  onAct,
}: {
  customers: Customer[];
  query: string;
  page: number;
  busy: boolean;
  owner: boolean;
  onQuery: (value: string) => void;
  onPage: (value: number) => void;
  onAct: (body: Record<string, unknown>) => void;
}) {
  const pages = Math.max(1, Math.ceil(customers.length / CUSTOMER_PAGE));
  const safePage = Math.min(page, pages - 1);
  const rows = customers.slice(safePage * CUSTOMER_PAGE, safePage * CUSTOMER_PAGE + CUSTOMER_PAGE);
  return (
    <section className="grid gap-3" data-customer-table="yes">
      <input className="field max-w-sm" aria-label="Search customers" placeholder="Name or phone" value={query} onChange={(event) => onQuery(event.target.value)} />
      {customers.length === 0 ? <p className="text-sm text-muted">No customers yet.</p> : (
        <div className="overflow-x-auto rounded-[14px] border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-muted">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Visits</th>
                <th className="px-3 py-2 font-medium">Last visit</th>
                <th className="px-3 py-2 font-medium">Points</th>
                <th className="px-3 py-2 font-medium">Reminders</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line align-top" data-customer-phone={row.phone}>
                  <td className="px-3 py-2 font-medium">{row.name || "No name"}</td>
                  <td className="px-3 py-2">{row.phoneLabel}</td>
                  <td className="px-3 py-2">{row.visitCount}</td>
                  <td className="px-3 py-2">{row.lastVisitLabel}</td>
                  <td className="px-3 py-2" data-customer-points={row.points}>{row.points}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.stop ? <span>Replied STOP</span> : null}
                      {!row.stop && row.canResume && !owner ? <span>Stopped at the desk</span> : null}
                      {!row.stop && row.canResume && owner ? (
                        <button className="btn secondary min-h-11" type="button" disabled={busy} onClick={() => onAct({ action: "resume", id: row.id })}>Turn reminders on</button>
                      ) : null}
                      {!row.stop && !row.optedOut ? (
                        <button className="btn secondary min-h-11" type="button" disabled={busy} onClick={() => onAct({ action: "stop", id: row.id })}>Stop reminders</button>
                      ) : null}
                      <details>
                        <summary className="cursor-pointer text-sm font-medium">Adjust points</summary>
                        <form
                          className="mt-2 flex flex-wrap items-end gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const data = new FormData(event.currentTarget);
                            onAct({ action: "adjust", id: row.id, delta: Number(data.get("delta")), reason: String(data.get("reason") || "") });
                            event.currentTarget.reset();
                          }}
                        >
                          <input className="field narrow" name="delta" type="number" step={1} required aria-label={`Points change for ${row.phoneLabel}`} placeholder="+1" />
                          <input className="field w-28" name="reason" required maxLength={120} aria-label={`Reason for ${row.phoneLabel}`} placeholder="Reason" />
                          <button className="btn secondary min-h-11" type="submit" disabled={busy}>Save</button>
                        </form>
                      </details>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {customers.length > CUSTOMER_PAGE ? (
        <div className="flex items-center gap-2">
          <button className="btn secondary min-h-11" type="button" disabled={safePage === 0} onClick={() => onPage(safePage - 1)}>Previous</button>
          <p className="text-sm">{safePage + 1} of {pages}</p>
          <button className="btn secondary min-h-11" type="button" disabled={safePage >= pages - 1} onClick={() => onPage(safePage + 1)}>Next</button>
        </div>
      ) : null}
    </section>
  );
}

function NotBackYet({
  lapsed,
  whatsapp,
  busy,
  onSend,
}: {
  lapsed: Lapsed;
  whatsapp: "off" | "template" | "ready";
  busy: boolean;
  onSend: (ids: string[]) => void;
}) {
  const ready = whatsapp === "ready";
  const bands = [
    { id: "weeks6", title: "6+ weeks", rows: lapsed.weeks6 },
    { id: "months2", title: "2+ months", rows: lapsed.months2 },
    { id: "months3", title: "3+ months", rows: lapsed.months3 },
  ];
  return (
    <section className="card grid gap-4 p-4" data-not-back="yes">
      <div>
        <h2 className="text-base font-semibold">Not back yet</h2>
        <p className="mt-1 text-sm" data-lapsed-summary="yes">{lapsed.summary}</p>
        <p className="text-sm text-muted">Two come-back messages per visit: one around 6 weeks, one at 2 months. Then it stops until the next visit. These three groups stay fixed so a customer is not messaged again after that. To change who shows on Due for a visit, set Days since their last visit in Reminders.</p>
      </div>
      {!ready ? (
        <p className="rounded-xl bg-[#f8efdc] px-3 py-2 text-sm" role="status">
          {whatsapp === "template"
            ? "The WhatsApp template is still waiting for approval. Nothing can be sent."
            : "WhatsApp is not connected. Nothing can be sent."}
        </p>
      ) : null}
      {bands.map((band) => (
        <div key={band.id} className="grid gap-2" data-lapsed-band={band.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{band.title}</h3>
            <button
              className="btn secondary disabled:opacity-40"
              type="button"
              disabled={busy || !ready || band.rows.every((row) => row.optedOut)}
              onClick={() => onSend(band.rows.filter((row) => !row.optedOut).map((row) => row.id))}
            >
              Send come-back message
            </button>
          </div>
          {band.rows.length === 0 ? <p className="text-sm text-muted">No one in this group.</p> : null}
          {band.rows.map((row) => (
            <article key={`${band.id}-${row.id}`} className="rounded-xl border border-line px-3 py-2" data-lapsed-phone={row.phone}>
              <p>{row.name || "No name"}</p>
              <p className="text-sm">{row.phoneLabel}</p>
              <p className="text-sm text-muted">{row.visitCount} {row.visitCount === 1 ? "visit" : "visits"} · {row.lastVisitLabel} · {row.points} {row.points === 1 ? "point" : "points"}</p>
              {row.optedOut ? <p className="text-sm">Reminders off</p> : null}
              <button className="btn secondary mt-2 disabled:opacity-40" type="button" disabled={busy || !ready || row.optedOut} onClick={() => onSend([row.id])}>
                Send come-back message
              </button>
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}
