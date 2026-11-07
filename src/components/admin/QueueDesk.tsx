"use client";

import { Fragment, useEffect, useState } from "react";
import { VisitUnlock } from "@/components/admin/VisitUnlock";
import { t } from "@/data/i18n";
import { QUEUE_POLL_MS } from "@/lib/queue/poll";

type Card = {
  id: string;
  token: number;
  name: string;
  phone: string;
  serviceName: string;
  status: string;
  waitMin: number;
  ahead: number;
  onTheWay: boolean;
  requestedDate: string;
  requestedSlot: string;
  whatsappUrl: string;
  callUrl: string;
  startedAt?: string | null;
  arrived?: boolean;
  wantsTries?: boolean;
  used?: number;
  remaining?: number;
};

type Desk = {
  salon: string;
  state: {
    isOpen: boolean;
    units: number;
    unitLabel: string;
    avgMinutes: number;
    alertLeadMin: number;
    mode: string;
  };
  services: { id: string; name: string }[];
  serving: { unit: number; entry: Card | null }[];
  waiting: Card[];
  requests: Card[];
  confirmed: Card[];
};

const LABELS: Record<string, string> = { chair: "queueChair", station: "queueStation", room: "queueRoom" };

function tokenLabel(token: number) {
  return `#${String(token).padStart(2, "0")}`;
}

function minutesInChair(iso?: string | null) {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return mins;
}

export function QueueDesk({ initial, lang, showVisits = false, monthTries }: { initial: Desk; lang: string; showVisits?: boolean; monthTries?: number }) {
  const [desk, setDesk] = useState(initial);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [walkName, setWalkName] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  const [units, setUnits] = useState(String(initial.state.units));
  const [avg, setAvg] = useState(String(initial.state.avgMinutes));
  const [alertMin, setAlertMin] = useState(String(initial.state.alertLeadMin));
  const [mode, setMode] = useState(initial.state.mode);
  const [unitLabel, setUnitLabel] = useState(initial.state.unitLabel);
  const [confirmClose, setConfirmClose] = useState(false);
  const [sheet, setSheet] = useState<Card | null>(null);
  const [confirmNoShow, setConfirmNoShow] = useState<Card | null>(null);
  const [wide, setWide] = useState(false);
  const live = desk.state.mode === "LIVE";
  const place = t(lang, LABELS[desk.state.unitLabel] || "queueChair");
  const nextGuest = desk.waiting[0];
  const freeSeat = desk.serving.find((seat) => !seat.entry);
  const canCall = Boolean(nextGuest && freeSeat);
  const callReason = !nextGuest ? "No one waiting" : "All chairs busy";
  const callText = canCall && nextGuest && freeSeat
    ? `Call ${tokenLabel(nextGuest.token)} ${nextGuest.name} to ${place} ${freeSeat.unit}`
    : callReason;
  const lineWait = desk.waiting.length ? desk.waiting[desk.waiting.length - 1].waitMin : 0;
  const summary = `${desk.waiting.length} waiting · ~${lineWait} min`;

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const apply = () => setWide(media.matches);
    apply();
    setReady(true);
    media.addEventListener("change", apply);
    const timer = setInterval(() => {
      void fetch("/api/v1/admin/queue")
        .then((res) => res.json())
        .then((data) => {
          if (data?.state) setDesk(data);
        })
        .catch(() => undefined);
    }, QUEUE_POLL_MS);
    return () => {
      media.removeEventListener("change", apply);
      clearInterval(timer);
    };
  }, []);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setNotice("");
    const res = await fetch("/api/v1/admin/queue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setNotice(data.message || "That did not work.");
      return;
    }
    if (data?.state) {
      setDesk(data);
      setUnits(String(data.state.units));
      setAvg(String(data.state.avgMinutes));
      setAlertMin(String(data.state.alertLeadMin));
      setMode(data.state.mode);
      setUnitLabel(data.state.unitLabel);
    }
  }

  function addTries(id: string, extra: number) {
    setSheet(null);
    void act({ action: "tries", id, extra });
  }

  function askClose() {
    if (desk.state.isOpen) setConfirmClose(true);
    else void act({ action: "open" });
  }

  return (
    <div className={wide ? "overflow-x-hidden" : "overflow-x-hidden pb-28"} data-ready={ready ? "yes" : "no"} data-queue-mode={desk.state.mode} data-queue-open={desk.state.isOpen ? "yes" : "no"} data-queue-wide={wide ? "yes" : "no"}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="font-serif text-3xl leading-none">Queue</h1>
        <button
          className={`relative h-11 w-16 shrink-0 rounded-full border border-line ${desk.state.isOpen ? "bg-[var(--brand)]" : "bg-sand"}`}
          type="button"
          role="switch"
          aria-checked={desk.state.isOpen}
          aria-label={desk.state.isOpen ? "Queue is open" : "Queue is closed"}
          disabled={busy}
          onClick={askClose}
        >
          <span className={`absolute top-1 h-9 w-9 rounded-full bg-white shadow ${desk.state.isOpen ? "left-6" : "left-1"}`} />
        </button>
        <span className="text-sm font-medium">{desk.state.isOpen ? "Open" : "Closed"}</span>
        <p className={`text-sm text-muted ${wide ? "" : "w-full"}`} data-queue-summary="yes">{live ? summary : t(lang, "queueRequestMode")}</p>
        {live && wide ? (
          <div className="ml-auto">
            <button className="btn min-h-11" type="button" data-call-next="yes" disabled={busy || !canCall} onClick={() => void act({ action: "next" })}>
              {canCall ? "Call next" : callReason}
            </button>
          </div>
        ) : null}
      </header>
      {typeof monthTries === "number" ? <p className="mt-1 text-xs text-muted">{monthTries.toLocaleString("en-IN")} try-ons this month</p> : null}
      {!desk.state.isOpen ? <p className="mt-2 text-sm text-muted">{t(lang, "queuePausedNote")}</p> : null}
      {notice ? <p className="mt-3 text-sm" role="status">{notice}</p> : null}

      {live ? (
        <div className={wide ? "mt-4 grid grid-cols-[260px_minmax(0,1fr)] items-start gap-6" : "mt-4"}>
          <section aria-label="Chairs">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Chairs</h2>
            <div className={wide ? "mt-2 grid gap-2" : "mt-2 flex flex-wrap gap-2"}>
              {desk.serving.map((seat) => (
                <article key={seat.unit} className={wide ? "card flex w-full flex-col items-start gap-2 p-3" : "card inline-flex w-fit max-w-full flex-wrap items-center gap-2 px-3 py-2"} data-chair={seat.unit}>
                  <p className="min-w-0 text-sm">
                    <span className="font-medium">{place} {seat.unit}</span>
                    {seat.entry ? (
                      <>
                        {" · "}
                        <span className="text-base font-semibold" data-queue-token={seat.entry.token}>{tokenLabel(seat.entry.token)}</span>
                        {" "}
                        {seat.entry.name}
                      </>
                    ) : (
                      <> · Free</>
                    )}
                  </p>
                  {seat.entry && wide ? (
                    <p className="text-xs text-muted">
                      {seat.entry.status === "IN_SERVICE"
                        ? `${minutesInChair(seat.entry.startedAt) ?? 0} min in chair`
                        : "Called"}
                    </p>
                  ) : null}
                  {seat.entry?.status === "CALLED" ? (
                    <button className="btn min-h-11 px-3" type="button" disabled={busy} onClick={() => void act({ action: "start", id: seat.entry?.id })}>{t(lang, "queueStart")}</button>
                  ) : null}
                  {seat.entry ? (
                    <button className="btn min-h-11 px-3" type="button" disabled={busy} onClick={() => void act({ action: "done", id: seat.entry?.id })}>{t(lang, "queueDone")}</button>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className={wide ? "" : "mt-4"} aria-label="Waiting">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">{t(lang, "queueWaiting")}</h2>
            {desk.waiting.length === 0 ? <p className="mt-2 text-sm text-muted">{t(lang, "queueNobody")}</p> : null}
            {wide ? (
              <div className="mt-2 overflow-x-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-[0.12em] text-muted">
                      <th className="py-2 pr-2 font-medium">Token</th>
                      <th className="py-2 pr-2 font-medium">Name</th>
                      <th className="py-2 pr-2 font-medium">Wait</th>
                      <th className="py-2 pr-2 font-medium">Status</th>
                      <th className="py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {desk.waiting.map((card) => (
                      <Fragment key={card.id}>
                        <tr className="border-t border-line align-middle" data-queue-row={card.token}>
                          <td className="py-2 pr-2 text-base font-semibold" data-queue-token={card.token}>{tokenLabel(card.token)}</td>
                          <td className="max-w-36 truncate py-2 pr-2">{card.name}</td>
                          <td className="whitespace-nowrap py-2 pr-2">{t(lang, "queueMinShort", { min: card.waitMin })}</td>
                          <td className="py-2 pr-2"><StatusPills card={card} lang={lang} /></td>
                          <td className="py-2">
                            <RowActions card={card} busy={busy} lang={lang} onArrive={() => void act({ action: "arrived", id: card.id })} onMore={() => setSheet(card)} />
                          </td>
                        </tr>
                        {card.wantsTries ? (
                          <tr>
                            <td className="pb-2" colSpan={5}>
                              <TryChips busy={busy} onAdd={(extra) => addTries(card.id, extra)} onDismiss={() => void act({ action: "dismiss", id: card.id })} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-2 grid gap-2">
                {desk.waiting.map((card) => (
                  <WaitingRow key={card.id} card={card} busy={busy} lang={lang} onArrive={() => void act({ action: "arrived", id: card.id })} onAdd={(extra) => addTries(card.id, extra)} onDismiss={() => void act({ action: "dismiss", id: card.id })} onMore={() => setSheet(card)} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {live && !wide ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[var(--bg)] p-3">
          <button className="btn w-full min-h-11 whitespace-normal px-3 text-center" type="button" data-call-next="yes" disabled={busy || !canCall} onClick={() => void act({ action: "next" })}>
            {callText}
          </button>
        </div>
      ) : null}

      <form
        className="card mt-4 grid gap-2 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void act({ action: "walkin", name: walkName, phone: walkPhone }).then(() => {
            setWalkName("");
            setWalkPhone("");
          });
        }}
      >
        <h2 className="text-base font-semibold">{t(lang, "queueWalkIn")}</h2>
        <div className="flex flex-wrap gap-2">
          <label className="min-w-0 flex-1 text-sm">{t(lang, "queueWalkName")}
            <input className="field mt-1" value={walkName} maxLength={80} onChange={(event) => setWalkName(event.target.value)} />
          </label>
          <label className="min-w-0 flex-1 text-sm">{t(lang, "queuePhoneOptional")}
            <input className="field mt-1" inputMode="tel" value={walkPhone} onChange={(event) => setWalkPhone(event.target.value)} />
          </label>
        </div>
        <button className="btn w-fit min-h-11" type="submit" disabled={busy}>{t(lang, "queueWalkIn")}</button>
      </form>

      {!live ? (
        <section className="mt-4">
          <h2 className="font-serif text-2xl">{t(lang, "queueRequests")}</h2>
          {desk.requests.length === 0 ? <p className="mt-2 text-sm text-muted">{t(lang, "queueNobody")}</p> : null}
          <div className="mt-3 grid gap-2">
            {desk.requests.map((card) => (
              <article key={card.id} className="card flex flex-wrap items-center gap-2 p-3">
                <p className="min-w-0 flex-1 text-sm">{card.name} · {card.requestedDate} · {card.requestedSlot}</p>
                <button className="btn min-h-11" type="button" disabled={busy} onClick={() => void act({ action: "confirm", id: card.id })}>{t(lang, "queueConfirm")}</button>
                <button className="btn secondary min-h-11" type="button" disabled={busy} onClick={() => void act({ action: "decline", id: card.id })}>{t(lang, "queueDecline")}</button>
              </article>
            ))}
          </div>
          {desk.confirmed.length > 0 ? (
            <div className="mt-4 grid gap-2">
              <h2 className="font-serif text-2xl">{t(lang, "queueConfirmed")}</h2>
              {desk.confirmed.map((card) => (
                <article key={card.id} className="card flex flex-wrap items-center gap-2 p-3">
                  <p className="min-w-0 flex-1 text-sm">{card.name} · {card.requestedDate} · {card.requestedSlot}</p>
                  <button className="btn min-h-11" type="button" disabled={busy} onClick={() => void act({ action: "done", id: card.id })}>Mark visited</button>
                  <button className="btn secondary min-h-11" type="button" aria-label="More actions" onClick={() => setSheet(card)}>⋯</button>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <details className="card mt-4 p-4">
        <summary className="cursor-pointer text-lg">{t(lang, "queueSettings")}</summary>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void act({
              action: "settings",
              units: Number(units),
              avgMinutes: Number(avg),
              alertLeadMin: Number(alertMin),
              mode,
              unitLabel,
            });
          }}
        >
          <label className="text-sm">{t(lang, "queueUnits", { unit: unitLabel === "station" ? "Stations" : unitLabel === "room" ? "Rooms" : "Chairs" })}
            <input className="field mt-1" type="number" min={1} max={30} value={units} onChange={(event) => setUnits(event.target.value)} />
          </label>
          <label className="text-sm">{t(lang, "queueAvg")}
            <input className="field mt-1" type="number" min={5} max={240} value={avg} onChange={(event) => setAvg(event.target.value)} />
          </label>
          {mode === "LIVE" ? (
            <label className="text-sm">{t(lang, "queueAlert")}
              <input className="field mt-1" type="number" min={0} max={120} value={alertMin} onChange={(event) => setAlertMin(event.target.value)} />
            </label>
          ) : null}
          <label className="text-sm">{t(lang, "queuePlace")}
            <select className="field mt-1" aria-label={t(lang, "queuePlace")} value={unitLabel} onChange={(event) => setUnitLabel(event.target.value)}>
              <option value="chair">{t(lang, "queueChair")}</option>
              <option value="station">{t(lang, "queueStation")}</option>
              <option value="room">{t(lang, "queueRoom")}</option>
            </select>
          </label>
          <label className="text-sm">{t(lang, "queueHow")}
            <select className="field mt-1" aria-label={t(lang, "queueHow")} value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="LIVE">{t(lang, "queueLive")}</option>
              <option value="REQUEST">{t(lang, "queueRequestMode")}</option>
            </select>
          </label>
          <button className="btn min-h-11 w-fit" type="submit" disabled={busy}>{t(lang, "queueSave")}</button>
        </form>
      </details>
      <VisitUnlock show={showVisits} />

      {confirmClose ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4 sm:place-items-center" role="dialog" aria-label="Close the queue">
          <div className="card w-full max-w-sm p-4">
            <p className="text-base">Close the queue? Guests cannot join until you open it again.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn min-h-11" type="button" onClick={() => { setConfirmClose(false); void act({ action: "pause" }); }}>Close queue</button>
              <button className="btn secondary min-h-11" type="button" onClick={() => setConfirmClose(false)}>Keep open</button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmNoShow ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4 sm:place-items-center" role="dialog" aria-label="No-show">
          <div className="card w-full max-w-sm p-4">
            <p className="text-base">Mark {confirmNoShow.name} as a no-show?</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn danger min-h-11" type="button" onClick={() => { const id = confirmNoShow.id; setConfirmNoShow(null); setSheet(null); void act({ action: "noshow", id }); }}>Mark no-show</button>
              <button className="btn secondary min-h-11" type="button" onClick={() => setConfirmNoShow(null)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {sheet ? (
        <ActionSheet
          card={sheet}
          busy={busy}
          onClose={() => setSheet(null)}
          onAdd={(extra) => addTries(sheet.id, extra)}
          onNoShow={() => setConfirmNoShow(sheet)}
        />
      ) : null}
    </div>
  );
}

function StatusPills({ card, lang }: { card: Card; lang: string }) {
  return (
    <span className="flex flex-wrap gap-1">
      {card.wantsTries ? <span className="rounded-full bg-[#f8efdc] px-2 py-1 text-xs" data-wants-tries="yes">{t(lang, "queueWantsTries")}</span> : null}
      {card.onTheWay ? <span className="rounded-full bg-sand px-2 py-1 text-xs">{t(lang, "queueOnTheWayBadge")}</span> : null}
      <span className="rounded-full bg-sand px-2 py-1 text-xs" data-try-line="yes">{t(lang, "queueTriesLine", { used: card.used ?? 0, left: card.remaining ?? 0 })}</span>
    </span>
  );
}

function WaitingRow({ card, busy, lang, onArrive, onAdd, onDismiss, onMore }: {
  card: Card;
  busy: boolean;
  lang: string;
  onArrive: () => void;
  onAdd: (extra: number) => void;
  onDismiss: () => void;
  onMore: () => void;
}) {
  return (
    <article className="card px-3 py-2" data-queue-row={card.token}>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1">
          <span className="text-base font-semibold" data-queue-token={card.token}>{tokenLabel(card.token)}</span>
          {" "}
          <span className="text-sm">{card.name}</span>
        </p>
        {card.arrived ? (
          <span className="inline-flex min-h-11 items-center rounded-full bg-[#1c7c54] px-3 text-sm text-white" data-arrived="yes">Arrived ✓</span>
        ) : (
          <button className="btn min-h-11 px-3" type="button" data-arrived="yes" disabled={busy} onClick={onArrive}>Arrived</button>
        )}
        <button className="btn secondary min-h-11 min-w-11 px-0" type="button" aria-label="More actions" onClick={onMore}>⋯</button>
      </div>
      <p className="mt-1 text-xs text-muted">{t(lang, "queueMinShort", { min: card.waitMin })}{card.serviceName ? ` · ${card.serviceName}` : ""}</p>
      <div className="mt-1"><StatusPills card={card} lang={lang} /></div>
      {card.wantsTries ? <TryChips busy={busy} onAdd={onAdd} onDismiss={onDismiss} /> : null}
    </article>
  );
}

function RowActions({ card, busy, lang, onArrive, onMore }: {
  card: Card;
  busy: boolean;
  lang: string;
  onArrive: () => void;
  onMore: () => void;
}) {
  return (
    <div className="flex flex-nowrap items-center gap-1">
      {card.arrived ? (
        <span className="inline-flex min-h-11 items-center rounded-full bg-[#1c7c54] px-3 text-sm text-white" data-arrived="yes">Arrived ✓</span>
      ) : (
        <button className="btn min-h-11 px-3" type="button" data-arrived="yes" disabled={busy} onClick={onArrive}>{t(lang, "queueArrived")}</button>
      )}
      {card.whatsappUrl ? <a className="btn secondary inline-flex min-h-11 min-w-11 items-center justify-center px-2" href={card.whatsappUrl} target="_blank" rel="noreferrer" aria-label="WhatsApp">WA</a> : null}
      {card.callUrl ? <a className="btn secondary inline-flex min-h-11 min-w-11 items-center justify-center px-2" href={card.callUrl} aria-label="Call">Call</a> : null}
      <button className="btn secondary min-h-11 min-w-11 px-0" type="button" aria-label="More actions" onClick={onMore}>⋯</button>
    </div>
  );
}

function TryChips({ busy, onAdd, onDismiss }: { busy: boolean; onAdd: (extra: number) => void; onDismiss: () => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1" data-try-box="yes">
      {[1, 2, 3].map((extra) => (
        <button key={extra} className="btn min-h-11 px-3" type="button" disabled={busy} onClick={() => onAdd(extra)}>
          {extra === 1 ? "+1 try" : `+${extra} tries`}
        </button>
      ))}
      <button className="btn secondary min-h-11 px-3" type="button" disabled={busy} onClick={onDismiss}>Dismiss</button>
    </div>
  );
}

function ActionSheet({ card, busy, onClose, onAdd, onNoShow }: {
  card: Card;
  busy: boolean;
  onClose: () => void;
  onAdd: (extra: number) => void;
  onNoShow: () => void;
}) {
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-40 bg-black/40" role="presentation" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white p-4" role="dialog" aria-label="More actions" onClick={(event) => event.stopPropagation()}>
        <p className="text-base font-semibold">{tokenLabel(card.token)} {card.name}</p>
        <div className="mt-3 grid gap-2">
          {card.whatsappUrl ? <a className="btn secondary min-h-11" href={card.whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a> : null}
          {card.callUrl ? <a className="btn secondary min-h-11" href={card.callUrl}>Call</a> : null}
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((extra) => (
              <button key={extra} className="btn min-h-11" type="button" disabled={busy} onClick={() => onAdd(extra)}>{extra === 1 ? "+1 try" : `+${extra} tries`}</button>
            ))}
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const amount = Number(custom);
              if (!Number.isInteger(amount) || amount < 1 || amount > 9) {
                setNote("Use a whole number from 1 to 9.");
                return;
              }
              setNote("");
              onAdd(amount);
            }}
          >
            <label className="text-sm">
              Custom tries
              <input className="field narrow mt-1" type="number" min={1} max={9} step={1} inputMode="numeric" placeholder="1–9" aria-label="Custom tries" value={custom} onChange={(event) => setCustom(event.target.value)} />
            </label>
            <button className="btn secondary min-h-11" type="submit" disabled={busy}>Add</button>
          </form>
          {note ? <p className="text-sm" role="status">{note}</p> : null}
          <button className="btn danger min-h-11" type="button" onClick={onNoShow}>No-show</button>
          <button className="btn secondary min-h-11" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
