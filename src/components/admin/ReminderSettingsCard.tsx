"use client";

import { useState } from "react";
import { ReminderMethodChoice } from "@/components/admin/ReminderMethodChoice";
import { DEFAULT_REMINDER_TEMPLATE, MAX_REMINDER_TEMPLATE } from "@/lib/visit-reminders";

export function ReminderSettingsCard({
  initial,
}: {
  initial: { reminderDays: number; reminderTemplate: string; reminderMethod: string };
}) {
  const [days, setDays] = useState(initial.reminderDays);
  const [template, setTemplate] = useState(initial.reminderTemplate.trim() || DEFAULT_REMINDER_TEMPLATE);
  const [method, setMethod] = useState<"MANUAL" | "AUTO">(initial.reminderMethod === "AUTO" ? "AUTO" : "MANUAL");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/v1/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reminderDays: days, reminderTemplate: template, reminderMethod: method === "AUTO" ? "MANUAL" : method }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Saved." : data.message || "Could not save.");
    setBusy(false);
  }

  return (
    <form id="reminders" className="card grid gap-4 p-4" data-reminder-settings="yes" onSubmit={save}>
      <h2 className="font-serif text-2xl">Reminders</h2>
      <ReminderMethodChoice value={method} onChange={setMethod} />
      <label className="text-base">
        Days since their last visit
        <input
          className="field mt-1"
          type="number"
          min={28}
          max={42}
          required
          aria-label="Days since their last visit"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
        />
      </label>
      <p className="text-base">42 days is about 6 weeks. Anyone quiet for that long shows on Due for a visit.</p>
      <label className="text-base">
        Message
        <textarea
          className="field mt-1"
          rows={4}
          maxLength={MAX_REMINDER_TEMPLATE}
          aria-label="Reminder message"
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
        />
      </label>
      <p className="text-base">{template.length} / {MAX_REMINDER_TEMPLATE}. You can use {"{name}"}, {"{salon}"}, {"{points}"}, and {"{link}"}.</p>
      <p className="text-base">If they have points, Lookuvi adds a line: You have 3 points.</p>
      <button className="btn w-full sm:w-fit" type="submit" disabled={busy}>Save</button>
      {message ? <p className="text-base" role="status">{message}</p> : null}
    </form>
  );
}
