"use client";

import { useEffect, useState } from "react";
import { Notice } from "@/components/ui/Notice";
import {
  DAY_LABELS,
  WEEK_HOURS_INVALID,
  compileSessions,
  effectiveWeek,
  emptyWeek,
  formatClock,
  hoursAfterClosedToggle,
  isUniform,
  serializeWeek,
  sessionSpanWarning,
  suggestedWeek,
  SUGGESTED_CLOSE,
  SUGGESTED_OPEN,
  pairFromWeek,
  type Session,
  type Weekday,
  type WeekSchedule,
} from "@/lib/queue/schedule";

export function WeekHoursEditor({
  openTime,
  closeTime,
  weeklyHours,
  onChange,
}: {
  openTime: string;
  closeTime: string;
  weeklyHours: string;
  onChange: (next: { openTime: string; closeTime: string; weeklyHours: string }) => void;
}) {
  const stored = loadWeek(weeklyHours, openTime, closeTime);
  const unsaved = stored.kind === "fallback";
  const week = unsaved ? suggestedWeek() : stored.week;
  const [sameOpen, setSameOpen] = useState(unsaved ? SUGGESTED_OPEN : openTime);
  const [sameClose, setSameClose] = useState(unsaved ? SUGGESTED_CLOSE : closeTime);
  const [sameOpen2, setSameOpen2] = useState("");
  const [sameClose2, setSameClose2] = useState("");
  const [error, setError] = useState("");

  function pushWeek(next: WeekSchedule) {
    const pair = pairFromWeek(next);
    onChange({
      openTime: pair?.open ?? "",
      closeTime: pair?.close ?? "",
      weeklyHours: serializeWeek(next),
    });
  }

  function applySame(open: string, close: string, open2: string, close2: string, force: boolean) {
    const compiled = compileSessions(open, close, open2, close2);
    if (!compiled.ok) {
      if (force) setError(compiled.message || WEEK_HOURS_INVALID);
      return;
    }
    if (!compiled.sessions.length) {
      setError("");
      onChange({ openTime: "", closeTime: "", weeklyHours: "" });
      return;
    }
    if (!force && !unsaved && !isUniform(week)) return;
    setError("");
    const next = emptyWeek();
    for (const day of DAY_LABELS) next[day.id] = compiled.sessions.map((session) => ({ ...session }));
    const pair = compiled.sessions.length === 1 ? compiled.sessions[0] : null;
    onChange({
      openTime: pair?.open ?? "",
      closeTime: pair?.close ?? "",
      weeklyHours: serializeWeek(next),
    });
  }

  function onSame(patch: { open?: string; close?: string; open2?: string; close2?: string }) {
    const open = patch.open ?? sameOpen;
    const close = patch.close ?? sameClose;
    const open2 = patch.open2 ?? sameOpen2;
    const close2 = patch.close2 ?? sameClose2;
    if (patch.open !== undefined) setSameOpen(patch.open);
    if (patch.close !== undefined) setSameClose(patch.close);
    if (patch.open2 !== undefined) setSameOpen2(patch.open2);
    if (patch.close2 !== undefined) setSameClose2(patch.close2);
    applySame(open, close, open2, close2, false);
  }

  return (
    <fieldset className="hours-editor grid gap-3 text-sm" data-hours-editor="yes">
      <legend className="font-medium">Opening hours</legend>
      <p className="text-xs text-muted">India time. Two sessions a day at most. Clear hours keeps the desk switch, with 06:00–22:00 for time requests.</p>
      <div className="hours-pair">
        <label>Opens
          <input className="field mt-1" type="time" aria-label="Opens" value={sameOpen} onChange={(event) => onSame({ open: event.target.value })} />
        </label>
        <label>Closes
          <input className="field mt-1" type="time" aria-label="Closes" value={sameClose} onChange={(event) => onSame({ close: event.target.value })} />
        </label>
        <label>Second opens
          <input className="field mt-1" type="time" aria-label="Second opens" value={sameOpen2} onChange={(event) => onSame({ open2: event.target.value })} />
        </label>
        <label>Second closes
          <input className="field mt-1" type="time" aria-label="Second closes" value={sameClose2} onChange={(event) => onSame({ close2: event.target.value })} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn secondary min-h-11 w-fit" type="button" onClick={() => applySame(sameOpen, sameClose, sameOpen2, sameClose2, true)}>Same every day</button>
        <button
          className="btn secondary min-h-11 w-fit"
          type="button"
          onClick={() => {
            setSameOpen(SUGGESTED_OPEN);
            setSameClose(SUGGESTED_CLOSE);
            setSameOpen2("");
            setSameClose2("");
            setError("");
            onChange({ openTime: "", closeTime: "", weeklyHours: "" });
          }}
        >
          Clear hours
        </button>
      </div>
      {unsaved ? <p className="text-sm font-medium" data-hours-suggested="yes">Suggested — not saved yet. Every day {SUGGESTED_OPEN}–{SUGGESTED_CLOSE}. The live queue still uses the desk switch until you save.</p> : null}
      <div className="hours-scroll grid gap-2">
        <div className="hours-head" aria-hidden="true">
          <span>Day</span>
          <span>Opens</span>
          <span>Closes</span>
          <span>Opens again</span>
          <span>Closes</span>
          <span>Closed</span>
        </div>
        {DAY_LABELS.map((day) => (
          <DayRow key={day.id} name={day.name} day={day.id} sessions={week[day.id]} onCommit={pushWeek} week={week} />
        ))}
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </fieldset>
  );
}

function loadWeek(weeklyHours: string, openTime: string, closeTime: string) {
  return effectiveWeek({ weeklyHours, openTime, closeTime });
}

function DayRow({
  name,
  day,
  sessions,
  week,
  onCommit,
}: {
  name: string;
  day: Weekday;
  sessions: Session[];
  week: WeekSchedule;
  onCommit: (next: WeekSchedule) => void;
}) {
  const open0 = sessions[0]?.open ?? "";
  const close0 = sessions[0]?.close ?? "";
  const open1 = sessions[1]?.open ?? "";
  const close1 = sessions[1]?.close ?? "";
  const [open, setOpen] = useState(open0);
  const [close, setClose] = useState(close0);
  const [open2, setOpen2] = useState(open1);
  const [close2, setClose2] = useState(close1);
  const [closedOn, setClosedOn] = useState(sessions.length === 0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open0 && !close0 && !open1 && !close1) {
      setClosedOn(true);
      return;
    }
    setClosedOn(false);
    setOpen(open0);
    setClose(close0);
    setOpen2(open1);
    setClose2(close1);
  }, [open0, close0, open1, close1]);

  function commit(nextOpen: string, nextClose: string, nextOpen2: string, nextClose2: string) {
    const compiled = compileSessions(nextOpen, nextClose, nextOpen2, nextClose2);
    if (!compiled.ok) {
      setError(compiled.message || WEEK_HOURS_INVALID);
      return;
    }
    setError("");
    onCommit({ ...week, [day]: compiled.sessions });
  }

  function setClosed(next: boolean) {
    const kept = hoursAfterClosedToggle({ open, close, open2, close2 }, next);
    setClosedOn(next);
    setOpen(kept.open);
    setClose(kept.close);
    setOpen2(kept.open2);
    setClose2(kept.close2);
    setError(next ? "" : sessionSpanWarning(kept.open, kept.close));
    onCommit({ ...week, [day]: kept.sessions });
  }

  const spanWarning = closedOn ? "" : sessionSpanWarning(open, close);

  return (
    <div className="hours-day">
      <p className="hours-day-name font-medium">{name}</p>
      <label className="hours-field">
        <span className="hours-field-label">Opens</span>
        <input className="field" type="time" aria-label={`${name} opens`} value={open} disabled={closedOn} onChange={(event) => { setOpen(event.target.value); commit(event.target.value, close, open2, close2); }} />
        {open ? <span className="text-xs text-muted">{formatClock(open)}</span> : null}
      </label>
      <label className="hours-field">
        <span className="hours-field-label">Closes</span>
        <input className="field" type="time" aria-label={`${name} closes`} value={close} disabled={closedOn} onChange={(event) => { setClose(event.target.value); commit(open, event.target.value, open2, close2); }} />
        {close ? <span className="text-xs text-muted">{formatClock(close)}</span> : null}
      </label>
      <label className="hours-field">
        <span className="hours-field-label">Opens again</span>
        <input className="field" type="time" aria-label={`${name} second opens`} value={open2} disabled={closedOn} onChange={(event) => { setOpen2(event.target.value); commit(open, close, event.target.value, close2); }} />
        {open2 ? <span className="text-xs text-muted">{formatClock(open2)}</span> : null}
      </label>
      <label className="hours-field">
        <span className="hours-field-label">Closes</span>
        <input className="field" type="time" aria-label={`${name} second closes`} value={close2} disabled={closedOn} onChange={(event) => { setClose2(event.target.value); commit(open, close, open2, event.target.value); }} />
        {close2 ? <span className="text-xs text-muted">{formatClock(close2)}</span> : null}
      </label>
      <div className="hours-closed">
        <span className="hours-closed-label text-sm">Closed</span>
        <button
          className={`relative h-11 w-16 shrink-0 rounded-full border border-line ${closedOn ? "bg-[var(--brand)]" : "bg-sand"}`}
          type="button"
          role="switch"
          aria-label={`${name} closed`}
          aria-checked={closedOn}
          onClick={() => setClosed(!closedOn)}
        >
          <span className={`absolute top-1 h-9 w-9 rounded-full bg-white shadow ${closedOn ? "left-6" : "left-1"}`} />
        </button>
      </div>
      {spanWarning ? <Notice tone="warning">{spanWarning}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}
