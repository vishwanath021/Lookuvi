"use client";

import { useEffect, useState } from "react";
import { VISIT_CAP_MESSAGE } from "@/lib/visit-tries";

type Visit = { sessionId: string; code: string; used: number; allowance: number };

export function VisitUnlock({ show = true }: { show?: boolean }) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const res = await fetch("/api/v1/admin/visit-tries");
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    setVisits(Array.isArray(data.visits) ? data.visits : []);
  }

  useEffect(() => {
    if (!show) return;
    void load();
  }, [show]);

  async function unlock(value: string) {
    const res = await fetch("/api/v1/admin/visit-tries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: value }),
    });
    const data = await res.json().catch(() => ({}));
    setNote(res.ok ? "More tries unlocked." : data.message || "Could not unlock that visit.");
    if (res.ok) {
      setCode("");
      void load();
    }
  }

  if (!show) return null;

  return (
    <section className="card mt-6 grid gap-3 p-4" data-visit-unlock="yes">
      <h2 className="text-lg font-semibold">Recent visits</h2>
      {visits.length === 0 ? <p className="text-sm text-muted">No visit to unlock yet.</p> : (
        <ul className="grid gap-2">
          {visits.map((visit) => (
            <li key={visit.sessionId} className="flex items-center justify-between gap-2 text-sm">
              <span>{visit.code} · {visit.used} of {visit.allowance}</span>
              <button className="btn secondary" type="button" onClick={() => void unlock(visit.sessionId)}>Unlock</button>
            </li>
          ))}
        </ul>
      )}
      <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); void unlock(code); }}>
        <label className="min-w-0 flex-1 text-sm">Visit code
          <input className="field mt-1" aria-label="Visit code" value={code} onChange={(event) => setCode(event.target.value)} />
        </label>
        <button className="btn" type="submit">Unlock</button>
      </form>
      <p className="text-xs text-muted">Shown when a guest sees “{VISIT_CAP_MESSAGE}”.</p>
      {note ? <p className="text-sm" role="status">{note}</p> : null}
    </section>
  );
}
