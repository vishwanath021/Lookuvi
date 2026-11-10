"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneIcon, WhatsAppIcon } from "@/components/icons/ContactIcons";
import { Notice, RequiredMark } from "@/components/ui/Notice";
import { indianMobile } from "@/lib/queue/phone";

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
  const [notice, setNotice] = useState<{ key: string; text: string; tone: "error" | "warning" | "info" | "success" } | null>(null);
  const [pending, setPending] = useState("");
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

  async function act(body: Record<string, unknown>, key: string) {
    setPending(key);
    setNotice(null);
    const res = await fetch("/api/v1/admin/customers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    const text = data.message || (res.ok ? "Saved." : "That did not work.");
    const tone = /not connected|nothing was sent|template is missing/i.test(text) ? "warning" : !res.ok ? "error" : "success";
    setNotice({ key, text, tone });
    if (res.ok && body.action === "adjust" && typeof data.balance === "number") {
      setCustomers((current) => current.map((row) => row.id === body.id ? { ...row, points: data.balance } : row));
    }
    if (res.ok) await reload();
    setPending("");
    return { ok: res.ok, ...data };
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
        {whatsapp !== "ready" ? (
          <Notice tone="warning">
            {whatsapp === "template"
              ? "The WhatsApp template is still waiting for approval. Nothing can be sent."
              : "WhatsApp is not connected yet. Reminders are paused and nothing is sent."}
          </Notice>
        ) : null}
      </section>

      {owner ? (
        <form
          className="card grid gap-2 p-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const days = Number(form.reminderDays);
            const cap = Number(form.whatsappMonthlyCap);
            if (!Number.isInteger(days) || days < 28 || days > 42) return;
            if (!Number.isInteger(cap) || cap < 0 || cap > 5000) return;
            void act({ action: "settings", remindersOn: form.remindersOn, reminderDays: days, whatsappMonthlyCap: cap }, "settings");
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
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Remind after (days)
              <input
                className="field mt-1"
                inputMode="numeric"
                aria-label="Remind after (days)"
                aria-invalid={form.reminderDays < 28 || form.reminderDays > 42}
                value={form.reminderDays ? String(form.reminderDays) : ""}
                onChange={(event) => {
                  const raw = event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  setForm({ ...form, reminderDays: raw === "" ? 0 : Number(raw) });
                }}
              />
              <span className="mt-1 block text-xs text-muted">At least 28 days after the last visit, so a reminder is not sent the same month they came.</span>
            </label>
            <label className="text-sm">Monthly cap
              <input
                className="field mt-1"
                inputMode="numeric"
                aria-label="Monthly WhatsApp limit"
                aria-invalid={form.whatsappMonthlyCap < 0 || form.whatsappMonthlyCap > 5000}
                value={String(form.whatsappMonthlyCap)}
                onChange={(event) => {
                  const raw = event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  setForm({ ...form, whatsappMonthlyCap: raw === "" ? 0 : Number(raw) });
                }}
              />
            </label>
          </div>
          {(form.reminderDays < 28 || form.reminderDays > 42) ? <Notice tone="error">Enter a whole number from 28 to 42 days.</Notice> : null}
          <button className="btn w-fit" type="submit" disabled={pending === "settings"}>{pending === "settings" ? "Saving…" : "Save"}</button>
          {notice?.key === "settings" ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
        </form>
      ) : null}

      {owner ? (
        <form
          className="card grid gap-2 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void act({ action: "broadcast", text: offer }, "broadcast");
          }}
        >
          <input className="field" maxLength={180} aria-label="Offer" value={offer} onChange={(event) => setOffer(event.target.value)} placeholder="Offer" />
          <button className="btn w-fit whitespace-nowrap" type="submit" disabled={pending === "broadcast"}>
            <WhatsAppIcon />
            {pending === "broadcast" ? "Sending…" : "Send offer on WhatsApp"}
          </button>
          <p className="max-w-3xl text-sm text-muted">It goes to everyone in your customer list, until this month&apos;s WhatsApp limit is used.</p>
          {notice?.key === "broadcast" ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
        </form>
      ) : null}

      {owner ? <NotBackYet lapsed={lapsed} whatsapp={whatsapp} pending={pending} onSend={(ids, key) => void act({ action: "comeback", ids }, key)} notice={notice?.key.startsWith("comeback") ? notice : null} /> : null}

      <CustomerTable customers={customers} query={query} page={page} pending={pending} owner={owner} onQuery={setQuery} onPage={setPage} onAct={(body, key) => act(body, key)} />
    </div>
  );
}

const CUSTOMER_PAGE = 8;

function CustomerTable({
  customers,
  query,
  page,
  pending,
  owner,
  onQuery,
  onPage,
  onAct,
}: {
  customers: Customer[];
  query: string;
  page: number;
  pending: string;
  owner: boolean;
  onQuery: (value: string) => void;
  onPage: (value: number) => void;
  onAct: (body: Record<string, unknown>, key: string) => Promise<{ ok?: boolean; balance?: number; history?: PointRow[]; message?: string }>;
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
              <CustomerCard key={row.id} row={row} pending={pending} owner={owner} onAct={onAct} onAdjust={() => setAdjust(row)} />
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
                      <RowActions row={row} pending={pending} owner={owner} onAct={onAct} onAdjust={() => setAdjust(row)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <AdjustSheet row={adjust} pending={pending} owner={owner} onClose={() => setAdjust(null)} onAct={onAct} />
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

type PointRow = { id: string; delta: number; kind: string; reason: string; label: string };

function contactLinks(phone: string) {
  const mobile = indianMobile(phone);
  if (!mobile) return null;
  return { callUrl: `tel:+${mobile}`, whatsappUrl: `https://wa.me/${mobile}` };
}

function CustomerCard({
  row,
  pending,
  owner,
  onAct,
  onAdjust,
}: {
  row: Customer;
  pending: string;
  owner: boolean;
  onAct: (body: Record<string, unknown>, key: string) => Promise<{ ok?: boolean; balance?: number; history?: PointRow[]; message?: string }>;
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
        <ContactLinks phone={row.phone} />
      </div>
      <RowActions row={row} pending={pending} owner={owner} onAct={onAct} onAdjust={onAdjust} />
    </article>
  );
}

function ContactLinks({ phone }: { phone: string }) {
  const links = contactLinks(phone);
  if (!links) return <p className="text-xs text-muted">No phone</p>;
  return (
    <p className="mt-1 flex gap-2 text-xs">
      <a className="inline-flex min-h-11 items-center gap-1" href={links.callUrl}><PhoneIcon /> Call</a>
      <a className="inline-flex min-h-11 items-center gap-1" href={links.whatsappUrl} target="_blank" rel="noreferrer"><WhatsAppIcon /> WhatsApp</a>
    </p>
  );
}

function RowActions({
  row,
  pending,
  owner,
  onAct,
  onAdjust,
}: {
  row: Customer;
  pending: string;
  owner: boolean;
  onAct: (body: Record<string, unknown>, key: string) => Promise<{ ok?: boolean }>;
  onAdjust: () => void;
}) {
  const blocked = row.stop || row.optedOut;
  const key = `remind-${row.id}`;
  return (
    <div className="flex shrink-0 items-center gap-1">
      {owner ? (
        <button className="btn secondary queue-icon" type="button" aria-label={`Remind ${row.name || row.phoneLabel} on WhatsApp`} disabled={pending === key || blocked} onClick={() => void onAct({ action: "comeback", ids: [row.id] }, key)}>
          <WhatsAppIcon />
        </button>
      ) : null}
      <button className="btn secondary queue-icon" type="button" aria-label={`Points for ${row.name || row.phoneLabel}`} onClick={onAdjust}>⋯</button>
    </div>
  );
}

/** Keep each keystroke exactly. Trim only when the owner saves. */
export function reasonDraft(value: string) {
  return value.slice(0, 120);
}

function AdjustSheet({
  row,
  pending,
  owner,
  onClose,
  onAct,
}: {
  row: Customer | null;
  pending: string;
  owner: boolean;
  onClose: () => void;
  onAct: (body: Record<string, unknown>, key: string) => Promise<{ ok?: boolean; balance?: number; history?: PointRow[]; message?: string }>;
}) {
  if (!row) return null;
  return (
    <div className="fixed inset-0 z-50 grid items-start overflow-y-auto bg-black/40 p-4 pt-8 sm:place-items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="card grid w-full max-w-sm gap-3 p-4" role="dialog" aria-label="Adjust points" onMouseDown={(event) => event.stopPropagation()}>
        <PointsEditor key={row.id} row={row} pending={pending} owner={owner} onClose={onClose} onAct={onAct} />
      </div>
    </div>
  );
}

function PointsEditor({
  row,
  pending,
  owner,
  onClose,
  onAct,
}: {
  row: Customer;
  pending: string;
  owner: boolean;
  onClose: () => void;
  onAct: (body: Record<string, unknown>, key: string) => Promise<{ ok?: boolean; balance?: number; history?: PointRow[]; message?: string }>;
}) {
  const [mode, setMode] = useState<"add" | "correct">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [balance, setBalance] = useState(row.points);
  const [history, setHistory] = useState<PointRow[]>([]);
  const saving = pending === "adjust";

  useEffect(() => {
    let alive = true;
    void fetch(`/api/v1/admin/customers?history=${row.id}`).then((res) => res.json()).then((data) => {
      if (alive && Array.isArray(data.history)) setHistory(data.history);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [row.id]);

  return (
    <>
      <h2 className="text-base font-semibold">{row.name || "No name"}</h2>
      <p className="nums text-sm font-normal" data-points-balance={balance}>Balance is {balance}.</p>
      {row.stop ? <Notice tone="warning">Replied STOP</Notice> : null}
      {!row.stop && row.canResume && !owner ? <p className="text-sm text-muted">Stopped at the desk</p> : null}
      {!row.stop && row.canResume && owner ? (
        <button className="btn secondary" type="button" disabled={pending === "resume"} onClick={() => { void onAct({ action: "resume", id: row.id }, "resume"); onClose(); }}>Turn reminders on</button>
      ) : null}
      {!row.stop && !row.optedOut ? (
        <button className="btn secondary" type="button" disabled={pending === "stop"} onClick={() => { void onAct({ action: "stop", id: row.id }, "stop"); onClose(); }}>Stop reminders</button>
      ) : null}
      {owner ? (
        <form
          className="grid gap-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const count = Number(amount);
            if (!Number.isInteger(count) || count < 1) {
              setError("Enter a whole number of points, at least 1.");
              return;
            }
            if (!reason.trim()) {
              setError("Add a reason.");
              return;
            }
            setError("");
            void onAct({ action: "adjust", id: row.id, mode, amount: count, reason: reason.trim() }, "adjust").then((result) => {
              if (!result?.ok) {
                setError(result?.message || "That did not work.");
                return;
              }
              if (typeof result.balance === "number") setBalance(result.balance);
              if (result.history) setHistory(result.history);
              setSaved(result.message || "Saved.");
              setAmount("");
              setReason("");
            });
          }}
        >
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Points change">
            <button className={`btn min-h-11 ${mode === "add" ? "" : "secondary"}`} type="button" onClick={() => setMode("add")}>Add points</button>
            <button className={`btn min-h-11 ${mode === "correct" ? "" : "secondary"}`} type="button" onClick={() => setMode("correct")}>Deduct / correct</button>
          </div>
          <label className="text-sm">{mode === "add" ? "Points to add" : "Points to deduct"}<RequiredMark />
            <input className="field mt-1 text-base" inputMode="numeric" aria-invalid={Boolean(error && !amount)} aria-label={mode === "add" ? "Points to add" : "Points to deduct"} value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))} />
          </label>
          <label className="text-sm">Reason<RequiredMark />
            <input
              className="field mt-1 text-base"
              aria-label={`Reason for ${row.phoneLabel}`}
              aria-invalid={Boolean(error && !reason.trim())}
              value={reason}
              onChange={(event) => setReason(reasonDraft(event.target.value))}
            />
          </label>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <button className="btn" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          {saved ? <Notice tone="success">{saved}</Notice> : null}
        </form>
      ) : null}
      {history.length ? (
        <ul className="grid gap-1 text-sm" data-points-history="yes">
          {history.map((entry) => (
            <li key={entry.id}>
              <span className="nums">{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</span>
              {" · "}
              {entry.kind === "correct" ? "Correction" : entry.kind === "redeem" ? "Redeemed" : entry.kind === "earn" ? "Visit" : "Added"}
              {entry.reason ? ` · ${entry.reason}` : ""}
              {" · "}
              <span className="text-muted">{entry.label}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted">No points changes yet.</p>}
      <button className="btn ghost" type="button" onClick={onClose}>Close</button>
    </>
  );
}

function NotBackYet({
  lapsed,
  whatsapp,
  pending,
  notice,
  onSend,
}: {
  lapsed: Lapsed;
  whatsapp: "off" | "template" | "ready";
  pending: string;
  notice: { text: string; tone: "error" | "warning" | "info" | "success" } | null;
  onSend: (ids: string[], key: string) => void;
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
        <Notice tone="warning">
          {whatsapp === "template"
            ? "The WhatsApp template is still waiting for approval. Nothing can be sent."
            : "WhatsApp is not connected yet. Nothing was sent."}
        </Notice>
      ) : null}
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      {bands.map((band) => (
        <div key={band.id} className="grid gap-2" data-lapsed-band={band.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{band.title}</h3>
            <button
              className="btn secondary disabled:opacity-40"
              type="button"
              disabled={pending === `comeback-${band.id}` || !ready || band.rows.every((row) => row.optedOut)}
              onClick={() => onSend(band.rows.filter((row) => !row.optedOut).map((row) => row.id), `comeback-${band.id}`)}
            >
              {pending === `comeback-${band.id}` ? "Sending…" : "Send come-back message"}
            </button>
          </div>
          {band.rows.length === 0 ? <p className="text-sm text-muted">No one in this group.</p> : null}
          {band.rows.map((row) => (
            <article key={`${band.id}-${row.id}`} className="rounded-xl border border-line px-3 py-2" data-lapsed-phone={row.phone}>
              <p>{row.name || "No name"}</p>
              <p className="text-sm">{row.phoneLabel}</p>
              <p className="text-sm text-muted">{row.visitCount} {row.visitCount === 1 ? "visit" : "visits"} · {row.lastVisitLabel} · {row.points} {row.points === 1 ? "point" : "points"}</p>
              {row.optedOut ? <p className="text-sm">Reminders off</p> : null}
              <button className="btn secondary mt-2 disabled:opacity-40" type="button" disabled={pending === `comeback-${row.id}` || !ready || row.optedOut} onClick={() => onSend([row.id], `comeback-${row.id}`)}>
                {pending === `comeback-${row.id}` ? "Sending…" : "Send come-back message"}
              </button>
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}
