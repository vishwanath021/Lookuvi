"use client";

import { useState } from "react";
import { ReminderMethodChoice } from "@/components/admin/ReminderMethodChoice";
import { WeekHoursEditor } from "@/components/admin/WeekHoursEditor";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/data/i18n";

export const ONBOARDING_STEPS = ["Brand", "Services", "WhatsApp", "Languages", "Hours", "Reminders", "Done"] as const;
export const ONBOARDING_SAVED = "Saved ✓";

export function OnboardingWizard({
  initial,
  hairstyleOnly = true,
}: {
  hairstyleOnly?: boolean;
  initial: {
    name: string;
    primaryColor: string;
    whatsapp: string;
    address: string;
    languages: string[];
    services: { key: string; name: string; priceInr: number }[];
    openTime?: string;
    closeTime?: string;
    weeklyHours?: string;
    reminderMethod?: string;
  };
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.primaryColor);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [address, setAddress] = useState(initial.address);
  const [languages, setLanguages] = useState<string[]>(initial.languages);
  const [openTime, setOpenTime] = useState(initial.openTime ?? "");
  const [closeTime, setCloseTime] = useState(initial.closeTime ?? "");
  const [weeklyHours, setWeeklyHours] = useState(initial.weeklyHours ?? "");
  const [reminderMethod, setReminderMethod] = useState<"MANUAL" | "AUTO">(initial.reminderMethod === "AUTO" ? "AUTO" : "MANUAL");
  const [message, setMessage] = useState("");
  const steps = ONBOARDING_STEPS;

  async function save(done = false) {
    const res = await fetch("/api/v1/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, primaryColor: color, whatsapp, address, languages, defaultLang: languages[0] || "en", onboardingDone: done, openTime, closeTime, weeklyHours, reminderMethod: reminderMethod === "AUTO" ? "MANUAL" : reminderMethod }),
    });
    const data = await res.json();
    if (!res.ok) setMessage(data.message || "Could not save");
    else setMessage(done ? "Salon page is ready." : ONBOARDING_SAVED);
  }

  return (
    <div className="card p-5">
      <p className="text-base">Step {step + 1} of {steps.length} · {steps[step]}</p>
      {step === 0 && (
        <div className="mt-3 space-y-3">
          <label className="block text-sm">Salon name<input className="field mt-1" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="block text-sm">Brand colour<input className="mt-1 h-10 w-full" type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
        </div>
      )}
      {step === 1 && (
        <ul className="mt-3 text-sm">
          {initial.services.map((service) => (
            <li key={service.key} className="flex justify-between border-b border-line py-1"><span>{service.name}</span><span>₹{service.priceInr}</span></li>
          ))}
          <li className="pt-2 text-muted">Guests see these names in the queue, plus No preference. <a className="underline" href="/admin/services">Edit services</a></li>
        </ul>
      )}
      {step === 2 && (
        <div className="mt-3 space-y-3">
          <label className="block text-sm">WhatsApp with country code<input className="field mt-1" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} /></label>
          <label className="block text-sm">Address<input className="field mt-1" value={address} onChange={(event) => setAddress(event.target.value)} /></label>
        </div>
      )}
      {step === 3 && (
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {LOCALES.map((code) => (
            <label key={code} className="flex items-center gap-2">
              <input type="checkbox" checked={languages.includes(code)} onChange={(event) => {
                setLanguages((current) => event.target.checked ? [...current, code] : current.filter((item) => item !== code));
              }} />
              {LOCALE_LABELS[code as Locale]}
            </label>
          ))}
        </div>
      )}
      {step === 4 && (
        <div className="mt-3" data-onboarding-step="hours">
          <WeekHoursEditor
            openTime={openTime}
            closeTime={closeTime}
            weeklyHours={weeklyHours}
            onChange={(next) => {
              setOpenTime(next.openTime);
              setCloseTime(next.closeTime);
              setWeeklyHours(next.weeklyHours);
            }}
          />
        </div>
      )}
      {step === 5 && (
        <div className="mt-3" data-onboarding-step="reminders">
          <ReminderMethodChoice value={reminderMethod} onChange={setReminderMethod} />
        </div>
      )}
      {step === 6 && <p className="mt-3 text-base">Open the try-on, print the QR, and paste the embed if your plan includes it. {hairstyleOnly ? "The try-on is hairstyle for now." : "Colour, style, brows, beard, and nails start on. Turn a tool off in Settings."} Booking stays on WhatsApp unless you require a phone login.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {step > 0 && <button className="btn secondary" type="button" onClick={() => setStep((value) => value - 1)}>Back</button>}
        {step < 5 && <button className="btn" type="button" onClick={() => { void save(false); setStep((value) => value + 1); }}>Next</button>}
        {step === 5 && <button className="btn" type="button" onClick={() => { void save(false); setStep(6); }}>Continue</button>}
        {step === 6 && <button className="btn" type="button" onClick={() => void save(true)}>Finish</button>}
        {message ? <p className="text-sm" role="status" data-onboarding-status="yes">{message}</p> : null}
      </div>
    </div>
  );
}
