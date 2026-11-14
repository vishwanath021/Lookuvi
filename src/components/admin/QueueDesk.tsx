"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { t } from "@/data/i18n";
import { formatToken } from "@/lib/queue/format-token";
import { PhoneIcon, WhatsAppIcon } from "@/components/icons/ContactIcons";
import { Notice, RequiredMark } from "@/components/ui/Notice";
import { DESK_STALE_MESSAGE, deskFailure, type DeskPayload } from "@/lib/queue/desk-client";
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
  points?: number | null;
  lastVisitLabel?: string;
};

type Reward = { id: string; name: string; cost: number };

type Desk = {
  salon: string;
  state: {
    isOpen: boolean;
    units: number;
    unitLabel: string;
    avgMinutes: number;
    alertLeadMin: number;
    mode: string;
    scheduled?: boolean;
    hoursLabel?: string;
    closedToday?: boolean;
  };
  services: { id: string; name: string }[];
  serving: { unit: number; entry: Card | null }[];
  waiting: Card[];
  requests: Card[];
  confirmed: Card[];
  rewards?: Reward[];
};

const LABELS: Record<string, string> = { chair: "queueChair", station: "queueStation", room: "queueRoom" };

function tokenLabel(token: number) {
  return formatToken(token);
}

function minutesInChair(iso?: string | null) {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return mins;
}

export function QueueDesk({ initial, lang, monthTries }: { initial: Desk; lang: string; monthTries?: number }) {
  const [desk, setDesk] = useState(initial);
  const [notice, setNotice] = useState("");
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsNote, setSettingsNote] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const [walkError, setWalkError] = useState("");
  const settingsDirty = useRef(false);
  const ticket = useRef(0);
  const refreshRef = useRef<() => void>(() => {});
  const staleFromPoll = useRef(false);
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
  const [sheetAt, setSheetAt] = useState<{ top: number; left: number } | null>(null);
  const [confirmNoShow, setConfirmNoShow] = useState<Card | null>(null);
  const [away, setAway] = useState<Card | null>(null);
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
  const hoursLabel = desk.state.hoursLabel || (desk.state.isOpen ? "Open" : "Closed");

  function claim() {
    ticket.current += 1;
    return ticket.current;
  }

  function current(id: number) {
    return id === ticket.current;
  }

  function openMore(card: Card, event: { currentTarget: HTMLElement }) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 320;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const top = Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 240));
    setSheetAt({ top, left });
    setSheet(card);
  }

  function closeMore() {
    setSheet(null);
    setSheetAt(null);
  }

  function applySettings(data: Desk) {
    settingsDirty.current = false;
    setUnits(String(data.state.units));
    setAvg(String(data.state.avgMinutes));
    setAlertMin(String(data.state.alertLeadMin));
    setMode(data.state.mode);
    setUnitLabel(data.state.unitLabel);
  }

  function applySnapshot(data: Desk, includeSettings = false) {
    if (staleFromPoll.current) setNotice("");
    staleFromPoll.current = false;
    setStale(false);
    setDesk(data);
    setSheet((open) => {
      if (!open) return open;
      const seated = (data.serving || []).map((seat) => seat.entry).filter(Boolean) as Card[];
      return [...data.waiting, ...seated, ...data.requests, ...data.confirmed].find((item) => item.id === open.id) || open;
    });
    if (includeSettings) applySettings(data);
  }

  function keepList(message: string, fromPoll: boolean) {
    staleFromPoll.current = fromPoll;
    setStale(true);
    setNotice(message);
  }

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const apply = () => setWide(media.matches);
    apply();
    setReady(true);
    media.addEventListener("change", apply);
    let alive = true;
    async function refresh() {
      const id = claim();
      try {
        const res = await fetch("/api/v1/admin/queue", { cache: "no-store", credentials: "same-origin" });
        const data = (await res.json().catch(() => ({}))) as DeskPayload;
        if (!alive || !current(id)) return;
        const failure = deskFailure(res.status, data);
        if (failure?.type === "login") {
          window.location.assign("/login");
          return;
        }
        if (failure) {
          keepList(failure.message, true);
          return;
        }
        applySnapshot(data as Desk);
      } catch {
        if (!alive || !current(id)) return;
        keepList(DESK_STALE_MESSAGE, true);
      }
    }
    refreshRef.current = () => {
      void refresh();
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, QUEUE_POLL_MS);
    return () => {
      alive = false;
      media.removeEventListener("change", apply);
      clearInterval(timer);
    };
  }, []);

  async function act(body: Record<string, unknown>, scope: "desk" | "settings" = "desk") {
    if (scope === "settings") setSettingsBusy(true);
    else setBusy(true);
    setNotice("");
    if (scope === "settings") setSettingsNote("");
    const id = claim();
    try {
      const res = await fetch("/api/v1/admin/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as DeskPayload & Desk;
      if (!current(id)) return;
      if (res.status === 401 || data?.error === "UNAUTHENTICATED") {
        window.location.assign("/login");
        return;
      }
      if (res.status === 403 || data?.error === "CSRF") {
        const failure = deskFailure(res.status, data);
        keepList(failure && failure.type !== "login" ? failure.message : DESK_STALE_MESSAGE, false);
        return;
      }
      if (!res.ok) {
        staleFromPoll.current = false;
        setStale(false);
        const message = data.message || "That did not work.";
        if (scope === "settings") setSettingsNote(message);
        else setNotice(message);
        return;
      }
      if (!data?.state) {
        keepList(DESK_STALE_MESSAGE, false);
        return;
      }
      applySnapshot(data, body.action === "settings");
      if (scope === "settings") setSettingsNote("Saved");
      return true;
    } catch {
      if (!current(id)) return;
      keepList(DESK_STALE_MESSAGE, false);
    } finally {
      if (scope === "settings") setSettingsBusy(false);
      else setBusy(false);
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
    <div className={wide ? "" : "pb-28"} data-ready={ready ? "yes" : "no"} data-queue-mode={desk.state.mode} data-queue-open={desk.state.isOpen ? "yes" : "no"} data-queue-wide={wide ? "yes" : "no"}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="font-serif text-3xl leading-none">Queue</h1>
        <button
          className={`relative h-11 w-16 shrink-0 rounded-full border border-line ${desk.state.isOpen ? "bg-[var(--brand)]" : "bg-sand"}`}
          type="button"
          role="switch"
          aria-checked={desk.state.isOpen}
          aria-label={desk.state.isOpen ? "Queue is open" : "Queue is closed"}
          disabled={busy || desk.state.closedToday}
          onClick={askClose}
        >
          <span className={`absolute top-1 h-9 w-9 rounded-full bg-white shadow ${desk.state.isOpen ? "left-6" : "left-1"}`} />
        </button>
        <span className="text-sm font-medium" data-hours-label={hoursLabel}>{hoursLabel}</span>
        <button className="btn secondary min-h-11" type="button" data-closed-today={desk.state.closedToday ? "yes" : "no"} disabled={busy} onClick={() => void act({ action: desk.state.closedToday ? "open-today" : "close-today" })}>
          {desk.state.closedToday ? "Undo closed today" : "Closed today"}
        </button>
        <p className={`text-sm text-muted ${wide ? "" : "w-full"}`} data-queue-summary="yes">{live ? summary : t(lang, "queueRequestMode")}</p>
        {live && wide ? (
          <div className="ml-auto">
            <button className="btn min-h-11" type="button" data-call-next="yes" disabled={busy || !canCall} onClick={() => void act({ action: "next" })}>
              {canCall && nextGuest ? `Call ${tokenLabel(nextGuest.token)} ${nextGuest.name}` : callReason}
            </button>
          </div>
        ) : null}
      </header>
      {typeof monthTries === "number" ? <p className="mt-1 text-xs text-muted">{monthTries.toLocaleString("en-IN")} try-ons this month</p> : null}
      {!desk.state.isOpen && !desk.state.scheduled && !desk.state.closedToday ? <p className="mt-2 text-sm text-muted">{t(lang, "queuePausedNote")}</p> : null}
      {notice ? (
        <div className="mt-3" data-queue-stale={stale ? "yes" : "no"}>
          <Notice tone={stale ? "warning" : "error"}>
            {notice}
            {stale ? (
              <>
                {" "}
                <button className="underline" type="button" onClick={() => refreshRef.current()}>Retry</button>
              </>
            ) : null}
          </Notice>
        </div>
      ) : null}

      {live ? (
        <div className="queue-floor mt-4">
          <section aria-label="Waiting" className="queue-waiting">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">{t(lang, "queueWaiting")}</h2>
            {desk.waiting.length === 0 ? <p className="mt-2 text-sm text-muted">{stale ? "Waiting list could not be loaded." : t(lang, "queueNobody")}</p> : null}
            {wide ? (
              <div className="mt-2 overflow-x-auto">
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
                          <td className="nums py-2 pr-2 text-base" data-queue-token={card.token}>{tokenLabel(card.token)}</td>
                          <td className="max-w-36 py-2 pr-2">
                            <p className="truncate">{card.name}</p>
                            {card.lastVisitLabel ? <p className="text-xs text-muted" data-last-visit={card.lastVisitLabel}>Last visit {card.lastVisitLabel}</p> : null}
                            {!card.phone ? <p className="text-xs text-muted">No phone</p> : null}
                          </td>
                          <td className="whitespace-nowrap py-2 pr-2">{t(lang, "queueMinShort", { min: card.waitMin })}</td>
                          <td className="py-2 pr-2"><StatusPills card={card} lang={lang} /></td>
                          <td className="py-2">
                            <div className="flex flex-wrap items-center gap-1">
                              <RowActions card={card} busy={busy} lang={lang} onArrive={() => void act({ action: "arrived", id: card.id })} onMore={(event) => openMore(card, event)} />
                              {card.wantsTries && card.arrived ? <TryChips compact busy={busy} onAdd={(extra) => addTries(card.id, extra)} onDismiss={() => void act({ action: "dismiss", id: card.id })} /> : null}
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-2 grid gap-2">
                {desk.waiting.map((card) => (
                  <WaitingRow key={card.id} card={card} busy={busy} lang={lang} onArrive={() => void act({ action: "arrived", id: card.id })} onAdd={(extra) => addTries(card.id, extra)} onDismiss={() => void act({ action: "dismiss", id: card.id })} onMore={(event) => openMore(card, event)} />
                ))}
              </div>
            )}
          </section>
          <section aria-label="Chairs" className="queue-chairs">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Chairs</h2>
            <div className="mt-2 grid gap-1.5">
              {desk.serving.map((seat) => (
                <article key={seat.unit} className="queue-chair" data-chair={seat.unit}>
                  <p className="min-w-0 text-sm">
                    <span className="font-medium">{place} {seat.unit}</span>
                    {seat.entry?.status === "CALLED" ? (
                      <>
                        {" · Waiting for "}
                        <span className="nums text-base" data-queue-token={seat.entry.token}>{tokenLabel(seat.entry.token)}</span>
                        {" "}
                        {seat.entry.name}
                      </>
                    ) : seat.entry ? (
                      <>
                        {" · "}
                        <span className="nums text-base" data-queue-token={seat.entry.token}>{tokenLabel(seat.entry.token)}</span>
                        {" "}
                        {seat.entry.name}
                      </>
                    ) : (
                      <> · Free</>
                    )}
                  </p>
                  {seat.entry?.status === "IN_SERVICE" && wide ? (
                    <p className="text-xs text-muted">{minutesInChair(seat.entry.startedAt) ?? 0} min in chair</p>
                  ) : null}
                  {seat.entry?.status === "CALLED" ? (
                    <>
                      <button className="btn min-h-11 px-3" type="button" disabled={busy} onClick={() => void act({ action: "start", id: seat.entry?.id })}>Seated</button>
                      <button className="btn ghost min-h-11 px-3" type="button" disabled={busy} onClick={() => setAway(seat.entry)}>Not here</button>
                    </>
                  ) : null}
                  {seat.entry?.status === "IN_SERVICE" ? (
                    <button className="btn min-h-11 px-3" type="button" disabled={busy} onClick={() => void act({ action: "done", id: seat.entry?.id })}>Finish</button>
                  ) : null}
                  {seat.entry ? (
                    <button className="btn secondary min-h-11 min-w-11 px-2" type="button" aria-label="More actions" onClick={(event) => { if (seat.entry) openMore(seat.entry, event); }}>⋯</button>
                  ) : null}
                </article>
              ))}
            </div>
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
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!walkName.trim()) {
            setWalkError("Enter the guest's name.");
            return;
          }
          setWalkError("");
          void act({ action: "walkin", name: walkName.trim(), phone: walkPhone }).then((ok) => {
            if (!ok) return;
            setWalkName("");
            setWalkPhone("");
          });
        }}
      >
        <h2 className="text-base font-semibold">{t(lang, "queueWalkIn")}</h2>
        <div className="flex flex-wrap gap-2">
          <label className="min-w-0 flex-1 text-sm">{t(lang, "queueWalkName")}<RequiredMark />
            <input className="field mt-1" aria-label={t(lang, "queueWalkName")} aria-invalid={Boolean(walkError)} value={walkName} maxLength={80} required onChange={(event) => { setWalkName(event.target.value); setWalkError(""); }} />
          </label>
          <label className="min-w-0 flex-1 text-sm">{t(lang, "queuePhoneOptional")}
            <input className="field mt-1" inputMode="tel" value={walkPhone} onChange={(event) => setWalkPhone(event.target.value)} />
          </label>
        </div>
        {walkError ? <Notice tone="error">{walkError}</Notice> : null}
        <button className="btn w-fit min-h-11" type="submit" disabled={busy}>{t(lang, "queueWalkIn")}</button>
      </form>

      {!live ? (
        <section className="mt-4">
          <h2 className="font-serif text-2xl">{t(lang, "queueRequests")}</h2>
          {desk.requests.length === 0 ? <p className="mt-2 text-sm text-muted">{stale ? "Waiting list could not be loaded." : t(lang, "queueNobody")}</p> : null}
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
                  <button className="btn secondary min-h-11" type="button" aria-label="More actions" onClick={(event) => openMore(card, event)}>⋯</button>
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
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const chairCount = /^\d+$/.test(units.trim()) ? Number(units) : NaN;
            const usual = /^\d+$/.test(avg.trim()) ? Number(avg) : NaN;
            const alert = /^\d+$/.test(alertMin.trim()) ? Number(alertMin) : NaN;
            if (!Number.isInteger(chairCount) || chairCount < 1 || chairCount > 30) {
              setInvalidField("units");
              setSettingsNote("Enter a whole number of places from 1 to 30.");
              return;
            }
            if (!Number.isInteger(usual) || usual < 5 || usual > 240) {
              setInvalidField("avg");
              setSettingsNote("Usual minutes must be a whole number from 5 to 240.");
              return;
            }
            if (mode === "LIVE" && (!Number.isInteger(alert) || alert < 0 || alert > 120)) {
              setInvalidField("alert");
              setSettingsNote("Alert minutes must be a whole number from 0 to 120.");
              return;
            }
            setInvalidField("");
            settingsDirty.current = false;
            void act({
              action: "settings",
              units: chairCount,
              avgMinutes: usual,
              alertLeadMin: Number.isInteger(alert) ? alert : 0,
              mode,
              unitLabel,
            }, "settings");
          }}
        >
          <label className="text-sm">{t(lang, "queueUnits", { unit: unitLabel === "station" ? "Stations" : unitLabel === "room" ? "Rooms" : "Chairs" })}
            <input className="field mt-1" inputMode="numeric" aria-invalid={invalidField === "units"} value={units} onChange={(event) => { settingsDirty.current = true; setUnits(event.target.value.replace(/[^\d]/g, "")); }} />
          </label>
          <p className="text-xs text-muted">You can add seats at any time. An empty seat can be removed. A seat with someone in it stays until you finish the visit or send them back to the line. People waiting are not removed.</p>
          <label className="text-sm">{t(lang, "queueAvg")}
            <input className="field mt-1" inputMode="numeric" aria-invalid={invalidField === "avg"} aria-label={t(lang, "queueAvg")} value={avg} onChange={(event) => { settingsDirty.current = true; setAvg(event.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "")); }} />
          </label>
          {invalidField === "avg" ? <Notice tone="error">{settingsNote}</Notice> : null}
          {mode === "LIVE" ? (
            <label className="text-sm">{t(lang, "queueAlert")}
              <input className="field mt-1" inputMode="numeric" aria-invalid={invalidField === "alert"} aria-label={t(lang, "queueAlert")} value={alertMin} onChange={(event) => { settingsDirty.current = true; setAlertMin(event.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "")); }} />
            </label>
          ) : null}
          {invalidField === "alert" ? <Notice tone="error">{settingsNote}</Notice> : null}
          <label className="text-sm">{t(lang, "queuePlace")}
            <select className="field mt-1" aria-label={t(lang, "queuePlace")} value={unitLabel} onChange={(event) => { settingsDirty.current = true; setUnitLabel(event.target.value); }}>
              <option value="chair">{t(lang, "queueChair")}</option>
              <option value="station">{t(lang, "queueStation")}</option>
              <option value="room">{t(lang, "queueRoom")}</option>
            </select>
          </label>
          <label className="text-sm">{t(lang, "queueHow")}
            <select className="field mt-1" aria-label={t(lang, "queueHow")} value={mode} onChange={(event) => { settingsDirty.current = true; setMode(event.target.value); }}>
              <option value="LIVE">{t(lang, "queueLive")}</option>
              <option value="REQUEST">{t(lang, "queueRequestMode")}</option>
            </select>
          </label>
          <button className="btn min-h-11 w-fit" type="submit" disabled={settingsBusy}>{settingsBusy ? "Saving…" : t(lang, "queueSave")}</button>
          {settingsNote && !invalidField ? <Notice tone={settingsNote === "Saved" ? "success" : "error"}>{settingsNote}</Notice> : null}
          {invalidField && invalidField !== "avg" && invalidField !== "alert" ? <Notice tone="error">{settingsNote}</Notice> : null}
        </form>
      </details>

      {confirmClose ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4 sm:place-items-center" role="dialog" aria-label="Close the queue">
          <div className="card w-full max-w-sm p-4">
            <p className="text-base">{desk.state.scheduled ? "Close early? New guests cannot join until the next session time, or until you open again. People already waiting stay in line." : "Close the queue? Guests cannot join until you open it again."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn min-h-11" type="button" onClick={() => { setConfirmClose(false); void act({ action: "pause" }); }}>Close queue</button>
              <button className="btn secondary min-h-11" type="button" onClick={() => setConfirmClose(false)}>Keep open</button>
            </div>
          </div>
        </div>
      ) : null}

      {away ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4 sm:place-items-center" role="dialog" aria-label="Not here">
          <div className="card w-full max-w-sm p-4">
            <p className="text-base">{away.name} is not at the chair.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn secondary min-h-11" type="button" onClick={() => { const id = away.id; setAway(null); void act({ action: "return", id }); }}>Back in line</button>
              <button className="btn danger min-h-11" type="button" onClick={() => { const id = away.id; setAway(null); void act({ action: "noshow", id }); }}>Mark no-show</button>
              <button className="btn ghost min-h-11" type="button" onClick={() => setAway(null)}>Cancel</button>
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
          at={sheetAt}
          rewards={desk.rewards || []}
          busy={busy}
          onClose={closeMore}
          onAdd={(extra) => addTries(sheet.id, extra)}
          onRedeem={(rewardId) => void act({ action: "redeem", id: sheet.id, rewardId })}
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
      <span className="whitespace-nowrap rounded-full bg-sand px-3 py-1.5 text-xs" data-try-line="yes">{t(lang, "queueTriesLine", { used: card.used ?? 0, left: card.remaining ?? 0 })}</span>
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
  onMore: (event: { currentTarget: HTMLElement }) => void;
}) {
  return (
    <article className="card px-3 py-2" data-queue-row={card.token}>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1">
          <span className="nums text-base" data-queue-token={card.token}>{tokenLabel(card.token)}</span>
          {" "}
          <span className="text-sm">{card.name}</span>
          {card.lastVisitLabel ? <span className="mt-0.5 block text-xs text-muted" data-last-visit={card.lastVisitLabel}>Last visit {card.lastVisitLabel}</span> : null}
          {!card.phone ? <span className="mt-0.5 block text-xs text-muted">No phone</span> : null}
        </p>
        {card.arrived ? (
          <span className="queue-arrived inline-flex items-center rounded-full bg-[#1c7c54] px-3 text-sm text-white" data-arrived="yes">Arrived ✓</span>
        ) : (
          <button className="btn queue-arrived px-3" type="button" data-arrived="yes" disabled={busy} onClick={onArrive}>Arrived</button>
        )}
        {card.whatsappUrl ? <a className="btn secondary queue-icon" href={card.whatsappUrl} target="_blank" rel="noreferrer" aria-label="WhatsApp"><WhatsAppIcon /></a> : null}
        {card.callUrl ? <a className="btn secondary queue-icon" href={card.callUrl} aria-label="Call"><PhoneIcon /></a> : null}
        <button className="btn secondary queue-icon" type="button" aria-label="More actions" onClick={(event) => onMore(event)}>⋯</button>
      </div>
      <p className="mt-1 text-xs text-muted">{t(lang, "queueMinShort", { min: card.waitMin })}{card.serviceName ? ` · ${card.serviceName}` : ""}</p>
      <div className="mt-1"><StatusPills card={card} lang={lang} /></div>
      {card.wantsTries && card.arrived ? <TryChips busy={busy} onAdd={onAdd} onDismiss={onDismiss} /> : null}
    </article>
  );
}

function RowActions({ card, busy, lang, onArrive, onMore }: {
  card: Card;
  busy: boolean;
  lang: string;
  onArrive: () => void;
  onMore: (event: { currentTarget: HTMLElement }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {card.arrived ? (
        <span className="queue-arrived inline-flex items-center rounded-full bg-[#1c7c54] px-3 text-sm text-white" data-arrived="yes">Arrived ✓</span>
      ) : (
        <button className="btn queue-arrived px-3" type="button" data-arrived="yes" disabled={busy} onClick={onArrive}>{t(lang, "queueArrived")}</button>
      )}
      {card.whatsappUrl ? <a className="btn secondary queue-icon" href={card.whatsappUrl} target="_blank" rel="noreferrer" aria-label="WhatsApp"><WhatsAppIcon /></a> : null}
      {card.callUrl ? <a className="btn secondary queue-icon" href={card.callUrl} aria-label="Call"><PhoneIcon /></a> : null}
      <button className="btn secondary queue-icon" type="button" aria-label="More actions" onClick={(event) => onMore(event)}>⋯</button>
    </div>
  );
}

function TryChips({ busy, onAdd, onDismiss, compact = false }: { busy: boolean; onAdd: (extra: number) => void; onDismiss: () => void; compact?: boolean }) {
  return (
    <div className={compact ? "flex flex-wrap items-center gap-1" : "mt-2 flex flex-wrap gap-1"} data-try-box="yes">
      {[1, 2, 3].map((extra) => (
        <button key={extra} className={`btn min-h-11 ${compact ? "px-2" : "px-3"}`} type="button" disabled={busy} onClick={() => onAdd(extra)}>
          {extra === 1 ? "+1 try" : `+${extra} tries`}
        </button>
      ))}
      <button className={`btn secondary min-h-11 ${compact ? "px-2" : "px-3"}`} type="button" disabled={busy} onClick={onDismiss}>Dismiss</button>
    </div>
  );
}

function ActionSheet({ card, at, rewards, busy, onClose, onAdd, onRedeem, onNoShow }: {
  card: Card;
  at: { top: number; left: number } | null;
  rewards: Reward[];
  busy: boolean;
  onClose: () => void;
  onAdd: (extra: number) => void;
  onRedeem: (rewardId: string) => void;
  onNoShow: () => void;
}) {
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [pick, setPick] = useState<Reward | null>(null);
  const points = typeof card.points === "number" ? card.points : null;
  return (
    <div className="fixed inset-0 z-40" role="presentation" onClick={onClose}>
      <div
        className="fixed z-50 max-h-[min(32rem,calc(100dvh-1rem))] w-80 overflow-y-auto rounded-2xl border border-line bg-white p-4 shadow-lift"
        style={at ? { top: at.top, left: at.left } : { top: "4.5rem", right: "1rem" }}
        role="dialog"
        aria-label="More actions"
        data-action-menu="float"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-base font-semibold">{tokenLabel(card.token)} {card.name}</p>
        {points !== null ? <p className="mt-1 text-sm" data-points={points}>Points: {points}</p> : null}
        <div className="mt-3 grid gap-2">
          {points !== null && rewards.length ? (
            pick ? (
              <div className="grid gap-2 rounded-xl border border-line p-3">
                <p>Redeem {pick.name} for {pick.cost} points?</p>
                <button className="btn min-h-11" type="button" disabled={busy || pick.cost > points} onClick={() => onRedeem(pick.id)}>Confirm redeem</button>
                <button className="btn secondary min-h-11" type="button" onClick={() => setPick(null)}>Back</button>
              </div>
            ) : (
              <button className="btn secondary min-h-11" type="button" onClick={() => setPick(rewards[0] || null)}>Redeem</button>
            )
          ) : null}
          {pick ? rewards.map((reward) => (
            <button key={reward.id} className="btn secondary min-h-11" type="button" disabled={reward.cost > points!} aria-pressed={pick.id === reward.id} onClick={() => setPick(reward)}>{reward.name} · {reward.cost}</button>
          )) : null}
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((extra) => (
              <button key={extra} className="btn min-h-11" type="button" disabled={busy} onClick={() => onAdd(extra)}>{extra === 1 ? "+1 try" : `+${extra} tries`}</button>
            ))}
          </div>
          <form
            className="grid gap-1"
            noValidate
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
            <label className="text-sm" htmlFor={`custom-tries-${card.id}`}>Custom tries</label>
            <div className="flex items-center gap-2">
              <input id={`custom-tries-${card.id}`} className="field min-w-0 flex-1" inputMode="numeric" placeholder="1–9" aria-label="Custom tries" aria-invalid={Boolean(note)} value={custom} onChange={(event) => setCustom(event.target.value.replace(/[^\d]/g, ""))} />
              <button className="btn secondary h-12 shrink-0" type="submit" disabled={busy}>Add</button>
            </div>
          </form>
          {note ? <Notice tone="error">{note}</Notice> : null}
          <button className="btn danger min-h-11" type="button" onClick={onNoShow}>No-show</button>
          <button className="btn secondary min-h-11" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
