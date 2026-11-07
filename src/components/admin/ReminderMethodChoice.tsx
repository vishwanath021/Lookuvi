"use client";

import { useId } from "react";

export function ReminderMethodChoice({
  value,
  onChange,
}: {
  value: "MANUAL" | "AUTO";
  onChange: (value: "MANUAL") => void;
}) {
  const labelId = useId();
  const manual = value !== "AUTO";
  return (
    <div className="grid gap-3">
      <h2 id={labelId} className="text-xl leading-snug">How do you want to send come-back reminders?</h2>
      <div className="grid gap-3" role="radiogroup" aria-labelledby={labelId}>
        <button
          type="button"
          role="radio"
          aria-checked={manual}
          className="choice-card"
          data-reminder-method="MANUAL"
          onClick={() => onChange("MANUAL")}
        >
          <span className="choice-radio" aria-hidden="true" />
          <span className="choice-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M8 10.5h12M8 14.5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <rect x="4" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M10 19.5l-2 4 5-4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-semibold">I&apos;ll send them myself (Free)</span>
            <span className="mt-1 block text-base leading-snug">Lookuvi gets the message ready, you tap Send in your WhatsApp.</span>
          </span>
        </button>
        <div
          role="radio"
          aria-checked="false"
          aria-disabled="true"
          tabIndex={0}
          className="choice-card is-disabled"
          data-reminder-method="AUTO"
        >
          <span className="choice-radio" aria-hidden="true" />
          <span className="choice-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="8" stroke="currentColor" strokeWidth="1.8" />
              <path d="M14 10v4.5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">Send automatically</span>
              <span className="choice-badge">Coming soon</span>
            </span>
            <span className="mt-1 block text-base leading-snug">Lookuvi sends them for you. Coming soon.</span>
            <span className="mt-1 block text-base leading-snug">Turns on after WhatsApp Business approval.</span>
          </span>
        </div>
      </div>
    </div>
  );
}
