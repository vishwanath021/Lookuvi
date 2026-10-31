"use client";

import { useState } from "react";
import { CONSENT_SHEET } from "@/data/consent-copy";
import { t } from "@/data/i18n";

export function ConsentSheet({
  open,
  lang = "en",
  onAgree,
  onClose,
}: {
  open: boolean;
  lang?: string;
  onAgree: (ageGate: boolean) => void;
  onClose: () => void;
}) {
  const [ageOk, setAgeOk] = useState(false);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-end bg-black/55 p-3 sm:place-items-center">
      <div role="dialog" aria-modal="true" aria-labelledby="consent-title" aria-describedby="consent-copy" className="w-full max-w-md rounded-2xl bg-white p-5 text-ink shadow-xl">
        <div className="flex justify-end">
          <button className="cam-round" type="button" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <h2 id="consent-title" className="font-serif text-2xl">{t(lang, "consentTitle")}</h2>
        <p id="consent-copy" className="mt-3 text-base leading-relaxed">
          {CONSENT_SHEET}{" "}
          <a className="underline" href="/privacy">{t(lang, "consentDetails")}</a>
          {" · "}
          <a className="underline" href="/privacy">{t(lang, "consentWithdrawLink")}</a>
        </p>
        <p className="mt-2 text-sm text-muted">{t(lang, "consentPurpose")}</p>
        <label className="mt-4 flex items-start gap-2 text-sm leading-snug">
          <input
            className="mt-1"
            type="checkbox"
            checked={ageOk}
            onChange={(event) => setAgeOk(event.target.checked)}
            data-testid="consent-age"
          />
          <span>{t(lang, "consentAge")}</span>
        </label>
        <button
          className="btn sheen mt-5 w-full"
          type="button"
          autoFocus
          disabled={!ageOk}
          data-testid="consent-agree"
          onClick={() => {
            if (!ageOk) return;
            onAgree(true);
            setAgeOk(false);
          }}
        >
          {t(lang, "consentAccept")}
        </button>
        <button className="btn secondary mt-2 w-full" type="button" onClick={onClose}>
          {t(lang, "consentDecline")}
        </button>
      </div>
    </div>
  );
}
