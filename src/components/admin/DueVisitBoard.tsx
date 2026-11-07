"use client";

import { useEffect, useState } from "react";
import {
  WHATSAPP_WINDOW,
  dueVisitIntro,
  type DueVisitRow,
} from "@/lib/visit-reminders";

type Toast = { text: string; undoId?: string };

export function DueVisitBoard({
  initialRows,
  days,
}: {
  initialRows: DueVisitRow[];
  days: number;
}) {
  const [rows, setRows] = useState(initialRows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<DueVisitRow[]>([]);
  const [index, setIndex] = useState(0);
  const [sent, setSent] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [phase, setPhase] = useState<"idle" | "sending" | "done">("idle");
  const [busy, setBusy] = useState(false);
  const [useApp, setUseApp] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    setShowTip(window.localStorage.getItem("lookuvi-due-tip") !== "off");
    setUseApp(window.localStorage.getItem("lookuvi-wa-app") === "1");
    setReady(true);
  }, []);

  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const selectedCount = rows.filter((row) => selected.has(row.id)).length;
  const current = queue[index];

  function chatUrl(row: DueVisitRow) {
    return useApp ? row.appUrl : row.webUrl;
  }

  function toggle(id: string) {
    setSelected((currentSet) => {
      const next = new Set(currentSet);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)));
  }

  function start() {
    const picked = rows.filter((row) => selected.has(row.id));
    if (!picked.length) return;
    window.open(chatUrl(picked[0]), WHATSAPP_WINDOW);
    setQueue(picked);
    setIndex(0);
    setSent(0);
    setSkipped(0);
    setPhase("sending");
  }

  async function mark(id: string) {
    const res = await fetch("/api/v1/admin/reminders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "mark", id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.reminderId) return null;
    return data as { ok: true; reminderId: string };
  }

  async function sentNext() {
    const person = queue[index];
    if (!person || busy) return;
    const next = queue[index + 1];
    if (next) window.open(chatUrl(next), WHATSAPP_WINDOW);
    setBusy(true);
    const saved = await mark(person.id);
    setBusy(false);
    if (!saved) {
      setToast({ text: "That was not saved. Try again." });
      return;
    }
    setSent((count) => count + 1);
    setRows((list) => list.filter((row) => row.id !== person.id));
    setSelected((currentSet) => {
      const nextSet = new Set(currentSet);
      nextSet.delete(person.id);
      return nextSet;
    });
    setToast({ text: "Marked as reminded.", undoId: saved.reminderId });
    if (!next) {
      setPhase("done");
      return;
    }
    setIndex((value) => value + 1);
  }

  function skip() {
    const next = queue[index + 1];
    setSkipped((count) => count + 1);
    if (!next) {
      setPhase("done");
      return;
    }
    window.open(chatUrl(next), WHATSAPP_WINDOW);
    setIndex((value) => value + 1);
  }

  function stop() {
    setPhase("idle");
    setQueue([]);
  }

  async function undo(reminderId: string) {
    const res = await fetch("/api/v1/admin/reminders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "undo", id: reminderId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setToast({ text: data.message || "Could not undo." });
      return;
    }
    const fresh = await fetch("/api/v1/admin/reminders");
    const listed = await fresh.json().catch(() => null);
    if (listed?.customers) setRows(listed.customers);
    setToast({ text: "Undone. They are on the list again." });
  }

  function dismissTip() {
    window.localStorage.setItem("lookuvi-due-tip", "off");
    setShowTip(false);
  }

  return (
    <div className="mt-4 grid gap-4" data-ready={ready ? "yes" : "no"} data-due-board="yes">
      <p className="text-base">{dueVisitIntro(days)}</p>
      <p className="text-base">
        <a className="underline" href="/admin/settings#reminders">Change the message</a>
      </p>
      {showTip ? (
        <section className="card grid gap-3 p-4" data-reminder-tip="yes">
          <p className="text-lg font-semibold">How to send</p>
          <ol className="grid gap-1 text-base">
            <li>1. Tap Send on WhatsApp</li>
            <li>2. Press Send in WhatsApp</li>
            <li>3. Come back for the next</li>
          </ol>
          <button className="btn secondary w-fit" type="button" onClick={dismissTip}>Got it</button>
        </section>
      ) : null}
      {toast ? (
        <div className="card flex flex-wrap items-center gap-3 p-4" role="status" data-toast="yes">
          <p className="text-base">{toast.text}</p>
          {toast.undoId ? (
            <button className="btn secondary" type="button" onClick={() => void undo(toast.undoId || "")}>Undo</button>
          ) : null}
          <button className="btn secondary" type="button" onClick={() => setToast(null)}>Close</button>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <div className="hidden items-center justify-between gap-3 md:flex">
          <label className="flex min-h-12 items-center gap-3 text-base">
            <input className="h-6 w-6" type="checkbox" aria-label="Select all" checked={allSelected} onChange={selectAll} />
            Select all
          </label>
          <button className="btn btn-wa md:w-auto" type="button" disabled={selectedCount === 0} onClick={start}>
            Start sending ({selectedCount})
          </button>
        </div>
      ) : null}
      {rows.length === 0 && phase === "idle" ? (
        <p className="card p-4 text-base" data-due-empty="yes">Everyone has visited recently. Nothing to send today.</p>
      ) : null}
      <div className="grid gap-3">
        {rows.map((row) => (
          <article key={row.id} className="card grid gap-3 p-4" data-due-phone={row.phone}>
            <div className="flex items-start gap-3">
              <label className="mt-1 hidden h-12 w-12 shrink-0 items-center justify-center md:flex">
                <input
                  className="h-6 w-6"
                  type="checkbox"
                  aria-label={`Select ${row.name || row.phoneLabel}`}
                  checked={selected.has(row.id)}
                  onChange={() => toggle(row.id)}
                />
              </label>
              <div className="min-w-0">
                <h2 className="text-xl">{row.name || "No name yet"}</h2>
                <p className="text-base">{row.phoneLabel}</p>
                <p className="text-base">Last visit {row.lastVisitLabel}</p>
                <p className="text-base">{row.daysSince} days ago</p>
                <p className="text-base" data-due-points={row.points}>{row.points} {row.points === 1 ? "point" : "points"}</p>
              </div>
            </div>
            <a
              className="btn btn-wa w-full md:hidden"
              href={row.meUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                void (async () => {
                  const saved = await mark(row.id);
                  if (!saved) {
                    setToast({ text: "That was not saved. Try again." });
                    return;
                  }
                  setRows((list) => list.filter((item) => item.id !== row.id));
                  setToast({ text: "Marked as reminded.", undoId: saved.reminderId });
                })();
              }}
            >
              Send on WhatsApp
            </a>
          </article>
        ))}
      </div>
      {phase !== "idle" ? (
        <section className="send-panel hidden md:block" data-send-panel="yes" aria-live="polite">
          {phase === "done" || !current ? (
            <div className="grid gap-3">
              <h2 className="text-xl">All done</h2>
              <p className="text-base" data-send-done="yes">Sent {sent}. Skipped {skipped}.</p>
              <button className="btn w-fit" type="button" onClick={stop}>Close</button>
            </div>
          ) : (
            <div className="grid gap-3">
              <p className="text-base" data-send-progress="yes">Customer {index + 1} of {queue.length}</p>
              <h2 className="text-xl">{current.name || "No name yet"}</h2>
              <p className="whitespace-pre-wrap text-base" data-message-preview="yes">{current.message}</p>
              <p className="text-base">Press Enter in WhatsApp to send, then click Sent, next.</p>
              <label className="flex min-h-12 items-center gap-3 text-base">
                <input
                  className="h-6 w-6"
                  type="checkbox"
                  aria-label="Open the WhatsApp app on this computer"
                  checked={useApp}
                  onChange={(event) => {
                    setUseApp(event.target.checked);
                    window.localStorage.setItem("lookuvi-wa-app", event.target.checked ? "1" : "0");
                  }}
                />
                Open the WhatsApp app on this computer
              </label>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-wa md:w-auto" type="button" disabled={busy} onClick={() => void sentNext()}>Sent, next</button>
                <button className="btn secondary" type="button" disabled={busy} onClick={skip}>Skip</button>
                <button className="btn secondary" type="button" disabled={busy} onClick={stop}>Stop</button>
              </div>
            </div>
          )}
        </section>
      ) : null}
      {phase !== "idle" ? <div className="hidden h-64 md:block" aria-hidden="true" /> : null}
    </div>
  );
}
