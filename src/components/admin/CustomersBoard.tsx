"use client";

import { useEffect, useRef, useState } from "react";
import { WhatsAppIcon } from "@/components/icons/ContactIcons";

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
          <p><span className="block text-xs uppercase tracking-[0.14em] text-muted">Reminders</span><span className="nums text-3xl" data-reminders-sent={stats.remindersSent}>{stats.remindersSent}</span></p>
          <p><span className="block text-xs uppercase tracking-[0.14em] text-muted">Offers</span><span className="nums text-3xl">{stats.offersSent}</span></p>
          <p><span className="block text-xs uppercase tracking-[0.14em] text-muted">WhatsApp used</span><span className="nums text-3xl" data-whatsapp-used={stats.used}>{stats.used} of {stats.cap}</span></p>
          <p><span className="block text-xs uppercase tracking-[0.14em] text-muted">Came back</span><span className="nums text-3xl" data-returns={stats.returnsThisMonth}>{stats.returnsThisMonth}</span></p>
        </div>
        {whatsapp !== "ready" ? <p className="rounded-xl bg-[#f8efdc] px-3 py-2 text-sm" role="status">WhatsApp is not connected. Reminders are paused.</p> : null}
      </section>

      {owner ? (
        <form
          className="card grid gap-2 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void act({ action: "settings", remindersOn: form.remindersOn, reminderDays: Number(form.reminderDays), whatsappMonthlyCap: Number(form.whatsappMonthlyCap) });
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Reminders</h2>
            <button
              className={`relative h-11 w-16 shrink-0 rounded-full border border-line ${form.remindersOn ? "bg-[var(--brand)]" : "bg-sand"}`}
              type="button"
              role="switch"
              aria-checked={form.remindersOn}
              aria-label="Reminders"
              onClick={() => setForm({ ...form, remindersOn: !form.remindersOn })}
            >
              <span className={`absolute top-1 h-9 w-9 rounded-full bg-white shadow ${form.remindersOn ? "left-6" : "left-1"}`} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Days
              <input className="field mt-1" type="number" min={28} max={42} aria-label="Days after the last visit" value={form.reminderDays} onChange={(event) => setForm({ ...form, reminderDays: Number(event.target.value) })} />
            </label>
            <label className="text-sm">Monthly cap
              <input className="field mt-1" type="number" min={0} max={5000} aria-label="Monthly WhatsApp limit" value={form.whatsappMonthlyCap} onChange={(event) => setForm({ ...form, whatsappMonthlyCap: Number(event.target.value) })} />
            </label>
          </div>
          <button className="btn w-fit" type="submit" disabled={busy}>Save</button>
        </form>
      ) : null}

      {owner ? (
        <form
          className="card grid gap-2 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void act({ action: "broadcast", text: offer });
          }}
        >
          <input className="field" maxLength={180} aria-label="Offer" value={offer} onChange={(event) => setOffer(event.target.value)} placeholder="Offer" />
          <button className="btn w-fit whitespace-nowrap" type="submit" disabled={busy}>
            <WhatsAppIcon />
            Send offer on WhatsApp
          </button>
          <p className="max-w-3xl text-sm text-muted">It goes to everyone in your customer list, until this month&apos;s WhatsApp limit is used.</p>
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
  const [adjust, setAdjust] = useState<Customer | null>(null);
  const pages = Math.max(1, Math.ceil(customers.length / CUSTOMER_PAGE));
  const safePage = Math.min(page, pages - 1);
  const rows = customers.slice(safePage * CUSTOMER_PAGE, safePage * CUSTOMER_PAGE + CUSTOMER_PAGE);
  return (
    <section className="grid gap-3" data-customer-table="yes">
      <input className="field max-w-sm" aria-label="Search customers" placeholder="Name or phone" value={query} onChange={(event) => onQuery(event.target.value)} />
      {customers.length === 0 ? <p className="text-sm text-muted">No customers yet.</p> : (
        <>
          <div className="grid md:hidden">
            {rows.map((row) => (
              <CustomerCard key={row.id} row={row} busy={busy} owner={owner} onAct={onAct} onAdjust={() => setAdjust(row)} />
            ))}
          </div>
          <div className="hidden overflow-x-hidden rounded-[14px] border border-line bg-white md:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted">
                  <th className="w-[24%] px-3 py-2 font-medium">Name</th>
                  <th className="w-[18%] px-3 py-2 font-medium">Phone</th>
                  <th className="w-[10%] px-3 py-2 font-medium">Visits</th>
                  <th className="w-[18%] px-3 py-2 font-medium">Last visit</th>
                  <th className="w-[10%] px-3 py-2 font-medium">Points</th>
                  <th className="w-[20%] px-3 py-2 font-medium">Reminders</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-line" data-customer-phone={row.phone}>
                    <td className="truncate px-3 py-2 font-medium">{row.name || "No name"}</td>
                    <td className="nums truncate px-3 py-2 font-normal">{row.phoneLabel}</td>
                    <td className="nums px-3 py-2 font-normal">{row.visitCount}</td>
                    <td className="nums truncate px-3 py-2 font-normal">{row.lastVisitLabel}</td>
                    <td className="nums px-3 py-2 font-normal" data-customer-points={row.points}>{row.points}</td>
                    <td className="px-3 py-2">
                      <RowActions row={row} busy={busy} owner={owner} onAct={onAct} onAdjust={() => setAdjust(row)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <AdjustSheet row={adjust} busy={busy} owner={owner} onClose={() => setAdjust(null)} onAct={onAct} />
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

function CustomerCard({
  row,
  busy,
  owner,
  onAct,
  onAdjust,
}: {
  row: Customer;
  busy: boolean;
  owner: boolean;
  onAct: (body: Record<string, unknown>) => void;
  onAdjust: () => void;
}) {
  return (
    <article className="flex items-center gap-2 border-b border-line py-2" data-customer-phone={row.phone}>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="min-w-0 truncate font-medium">{row.name || "No name"}</span>
          <span className="nums shrink-0 text-sm font-normal" data-customer-points={row.points}>{row.points}</span>
        </p>
        <p className="truncate text-xs text-muted">{row.phoneLabel} · {row.visitCount} {row.visitCount === 1 ? "visit" : "visits"} · {row.lastVisitLabel}</p>
      </div>
      <RowActions row={row} busy={busy} owner={owner} onAct={onAct} onAdjust={onAdjust} />
    </article>
  );
}

function RowActions({
  row,
  busy,
  owner,
  onAct,
  onAdjust,
}: {
  row: Customer;
  busy: boolean;
  owner: boolean;
  onAct: (body: Record<string, unknown>) => void;
  onAdjust: () => void;
}) {
  const blocked = row.stop || row.optedOut;
  return (
    <div className="flex shrink-0 items-center gap-1">
      {owner ? (
        <button className="btn secondary queue-icon" type="button" aria-label={`Remind ${row.name || row.phoneLabel} on WhatsApp`} disabled={busy || blocked} onClick={() => onAct({ action: "comeback", ids: [row.id] })}>
          <WhatsAppIcon />
        </button>
      ) : null}
      <button className="btn secondary queue-icon" type="button" aria-label={`Points for ${row.name || row.phoneLabel}`} onClick={onAdjust}>⋯</button>
    </div>
  );
}

function AdjustSheet({
  row,
  busy,
  owner,
  onClose,
  onAct,
}: {
  row: Customer | null;
  busy: boolean;
  owner: boolean;
  onClose: () => void;
  onAct: (body: Record<string, unknown>) => void;
}) {
  if (!row) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4 sm:place-items-center" role="dialog" aria-label="Adjust points">
      <div className="card grid w-full max-w-sm gap-3 p-4">
        <h2 className="text-base font-semibold">{row.name || "No name"}</h2>
        <p className="nums text-sm font-normal text-muted">{row.points} points</p>
        {row.stop ? <p className="text-sm">Replied STOP</p> : null}
        {!row.stop && row.canResume && !owner ? <p className="text-sm">Stopped at the desk</p> : null}
        {!row.stop && row.canResume && owner ? (
          <button className="btn secondary" type="button" disabled={busy} onClick={() => { onAct({ action: "resume", id: row.id }); onClose(); }}>Turn reminders on</button>
        ) : null}
        {!row.stop && !row.optedOut ? (
          <button className="btn secondary" type="button" disabled={busy} onClick={() => { onAct({ action: "stop", id: row.id }); onClose(); }}>Stop reminders</button>
        ) : null}
        {owner ? (
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              onAct({ action: "adjust", id: row.id, delta: Number(data.get("delta")), reason: String(data.get("reason") || "") });
              onClose();
            }}
          >
            <label className="text-sm">Points change
              <input className="field mt-1" name="delta" type="number" step={1} required aria-label={`Points change for ${row.phoneLabel}`} placeholder="+1" />
            </label>
            <label className="text-sm">Reason
              <input className="field mt-1" name="reason" required maxLength={120} aria-label={`Reason for ${row.phoneLabel}`} placeholder="Reason" />
            </label>
            <button className="btn" type="submit" disabled={busy}>Save</button>
          </form>
        ) : null}
        <button className="btn ghost" type="button" onClick={onClose}>Close</button>
      </div>
    </div>
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
