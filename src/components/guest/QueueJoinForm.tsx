"use client";

import { useEffect, useState } from "react";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { t } from "@/data/i18n";
import { QueueWait } from "@/components/guest/QueueWait";
import { QUEUE_POLL_MS } from "@/lib/queue/poll";
import { guestDeviceId } from "@/lib/device-id";
import { guestSessionId } from "@/lib/guest-session";
import { kolkataDayKey } from "@/lib/queue/day";
import { parseVisitMemory, rememberVisit, serializeVisitMemory, visitMemoryKey, type VisitMemory } from "@/lib/queue/visit-memory";

type Board = {
  name: string;
  slug: string;
  open: boolean;
  mode: string;
  waitMin: number;
  ahead: number;
  tryOn: boolean;
  lang: string;
  hoursOpen?: string;
  hoursClose?: string;
  hoursClosed?: boolean;
  hoursMessage?: string;
  todayHours?: string;
  nextOpen?: string;
  services: { id: string; name: string; minutes: number }[];
};

export function QueueJoinForm({ initial }: { initial: Board }) {
  const lang = initial.lang || "en";
  const [board, setBoard] = useState(initial);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [heldPath, setHeldPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [visits, setVisits] = useState<VisitMemory[]>([]);
  const [endedRefs, setEndedRefs] = useState<Set<string>>(new Set());
  const [returnToken, setReturnToken] = useState("");
  const request = board.mode === "REQUEST";
  const hoursClosed = !request && Boolean(board.hoursClosed);

  useEffect(() => {
    setReady(true);
    const token = new URLSearchParams(window.location.search).get("r") || "";
    if (/^[A-Za-z0-9_-]{16,80}$/.test(token)) setReturnToken(token);
    try {
      setVisits(parseVisitMemory(localStorage.getItem(visitMemoryKey(board.slug))));
    } catch {
      setVisits([]);
    }
  }, [board.slug]);

  useEffect(() => {
    const today = kolkataDayKey();
    const stale = visits.filter((visit) => visit.dayKey && visit.dayKey < today).map((visit) => visit.ref);
    if (stale.length) setEndedRefs((current) => new Set([...current, ...stale]));
    const live = visits.filter((visit) => !visit.dayKey || visit.dayKey >= today);
    let stop = false;
    void Promise.all(live.map(async (visit) => {
      const res = await fetch(`/api/v1/queue/status?slug=${encodeURIComponent(board.slug)}&ref=${encodeURIComponent(visit.ref)}`);
      const data = await res.json().catch(() => null);
      const status = data && typeof data.status === "string" ? data.status : "";
      if (stop || !status) return "";
      if (status === "EXPIRED" || status === "CANCELLED" || status === "DONE" || status === "NO_SHOW") return visit.ref;
      return "";
    })).then((refs) => {
      if (stop) return;
      const gone = refs.filter(Boolean);
      if (gone.length) setEndedRefs((current) => new Set([...current, ...gone]));
    }).catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [board.slug, visits]);

  useEffect(() => {
    const timer = setInterval(() => {
      void fetch(`/api/v1/queue?slug=${encodeURIComponent(board.slug)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && typeof data.open === "boolean") {
            setBoard(data);
          }
        })
        .catch(() => undefined);
    }, QUEUE_POLL_MS);
    return () => clearInterval(timer);
  }, [board.slug]);

  async function join(nextName: string, nextPhone: string, agreed: boolean) {
    setBusy(true);
    setMessage("");
    setHeldPath("");
    const res = await fetch("/api/v1/queue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: board.slug,
        name: nextName,
        phone: nextPhone,
        serviceId: serviceId || undefined,
        consent: agreed,
        requestedDate: request ? date : undefined,
        requestedSlot: request ? slot : undefined,
        deviceId: guestDeviceId(),
        sessionId: guestSessionId(),
        returnToken: returnToken || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(data.message || "That did not work. Try again.");
      return;
    }
    if (data.existing) {
      setMessage(data.message || "This number already has a token. Open it or cancel before joining as someone else.");
      setHeldPath(typeof data.statusPath === "string" ? data.statusPath : "");
      return;
    }
    const next = rememberVisit(visits, {
      name: nextName,
      phone: nextPhone,
      ref: data.ref,
      dayKey: typeof data.dayKey === "string" ? data.dayKey : kolkataDayKey(),
    });
    localStorage.setItem(visitMemoryKey(board.slug), serializeVisitMemory(next));
    window.location.href = data.statusPath;
  }

  return (
    <div>
      <div data-queue-open={board.open ? "yes" : "no"} data-queue-mode={board.mode}>
        {request ? <p className="mt-2 text-sm">{t(lang, "queueRequestNote")}</p> : hoursClosed ? (
          <p className="mt-2 text-sm" role="status">{board.hoursMessage}</p>
        ) : board.open ? (
          <QueueWait serverWait={board.waitMin} ahead={board.ahead} lang={lang} phrase="join" />
        ) : <p className="mt-2 text-sm">{t(lang, "queueClosed")}</p>}
      </div>
      {board.todayHours ? <p className="mt-2 text-sm" data-today-hours={board.todayHours}>{t(lang, "queueTodayLine", { hours: board.todayHours })}</p> : null}
      {board.nextOpen ? <p className="text-sm" data-next-open={board.nextOpen}>{t(lang, "queueOpensAt", { when: board.nextOpen })}</p> : null}
      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">{board.open ? t(lang, "queueOpenNow") : t(lang, "queueClosedNow")}</p>
      {visits.some((visit) => !endedRefs.has(visit.ref)) ? (
        <div className="card mt-4 grid gap-3 p-4" data-queue-visits={visits.filter((visit) => !endedRefs.has(visit.ref)).length}>
          {visits.filter((visit) => !endedRefs.has(visit.ref)).map((visit) => (
            <div key={visit.ref} className="grid gap-2 border-b border-line pb-3 last:border-b-0 last:pb-0">
              <p>{t(lang, "queueWelcome", { name: visit.name || visit.phone })}</p>
              <a className="btn secondary" href={`/s/${board.slug}/q/${visit.ref}`}>{t(lang, "queueSeePlace")}</a>
              <button className="btn" type="button" disabled={busy || hoursClosed || (!board.open && !request)} onClick={() => void join(visit.name, visit.phone, true)}>{t(lang, "queueRejoin")}</button>
            </div>
          ))}
        </div>
      ) : null}
      <form
        className="card mt-4 grid gap-3 p-4"
        data-ready={ready ? "yes" : "no"}
        onSubmit={(event) => {
          event.preventDefault();
          void join(name, phone, consent);
        }}
      >
        <label className="text-sm">{t(lang, "queueName")}
          <input className="field mt-1" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} autoComplete="name" />
        </label>
        <label className="text-sm">{t(lang, "queuePhone")}
          <input className="field mt-1" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required />
        </label>
        <label className="text-sm">{t(lang, "queueService")}
          <select className="field mt-1" value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
            <option value="">{t(lang, "queueNoService")}</option>
            {board.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
        </label>
        {request ? (
          <>
            <label className="text-sm">{t(lang, "queueDate")}
              <input className="field mt-1" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </label>
            <label className="text-sm">{t(lang, "queueTime")}
              <input className="field mt-1" type="time" min={board.hoursOpen || "06:00"} max={board.hoursClose || "22:00"} value={slot} onChange={(event) => setSlot(event.target.value)} required />
            </label>
          </>
        ) : null}
        <label className="flex min-h-11 items-start gap-2 text-sm" htmlFor="queue-updates">
          <input id="queue-updates" className="mt-1" type="checkbox" checked={consent} aria-label={t(lang, "queueConsent")} onChange={(event) => setConsent(event.target.checked)} required />
          <span>{t(lang, "queueConsent")}<span className="mt-1 block text-muted">This salon may send one WhatsApp reminder after your visit. Reply STOP to opt out.</span></span>
        </label>
        <button className="btn w-full text-lg" type="submit" disabled={busy || hoursClosed || (!board.open && !request)}>{busy ? "…" : request ? t(lang, "queueRequest") : t(lang, "queueJoin")}</button>
        {message ? <p className="text-sm" role="status">{message}</p> : null}
        {heldPath ? <a className="btn secondary" href={heldPath}>Open that token</a> : null}
      </form>
      <LegalFooter />
      {board.tryOn ? <p className="mt-4"><a className="btn secondary" href={`/s/${board.slug}`}>{t(lang, "queueTryLook")}</a></p> : null}
    </div>
  );
}
