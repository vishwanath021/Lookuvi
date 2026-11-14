"use client";

import { useState } from "react";
import { t } from "@/data/i18n";
import { showLockedBrowse } from "@/lib/at-salon-browse";
import { useAtSalon } from "@/components/guest/AtSalonNote";

/** Only an explicit salon flag locks the try. A missing flag stays open until the at-salon response arrives. */
export function salonLockRequested(flag: boolean | undefined) {
  return flag === true;
}

export function useUnlockSheet(tryOnsAtSalon: boolean | undefined) {
  const atSalon = useAtSalon();
  const [open, setOpen] = useState(false);
  const locked = showLockedBrowse(salonLockRequested(tryOnsAtSalon), atSalon);
  return {
    locked,
    open,
    /** True when the try must stop. Opens the unlock sheet and does not spend a credit. */
    stop() {
      if (!locked) return false;
      setOpen(true);
      return true;
    },
    show() {
      setOpen(true);
    },
    close() {
      setOpen(false);
    },
    fromRefusal(data: { error?: string } | null | undefined) {
      if (data?.error !== "NOT_AT_SALON") return false;
      setOpen(true);
      return true;
    },
  };
}

export function AtSalonSheet({
  open,
  lang,
  joinHref,
  onClose,
  onSave,
  saveLabel,
}: {
  open: boolean;
  lang: string;
  joinHref?: string;
  onClose: () => void;
  onSave?: () => void;
  saveLabel?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid items-end bg-black/40 p-3 sm:place-items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="card grid w-full max-w-sm gap-3 overflow-hidden p-4" role="dialog" aria-label={t(lang, "atSalonDesireTitle")} data-unlock-sheet="yes">
        <img src="/samples/portrait.jpg" alt="" className="h-40 w-full rounded-xl object-cover object-top" />
        <h2 className="font-serif text-2xl leading-tight">{t(lang, "atSalonDesireTitle")}</h2>
        <p className="text-sm leading-6 text-muted">{t(lang, "atSalonDesireBody")}</p>
        {onSave && saveLabel ? (
          <button className="btn min-h-11" type="button" onClick={onSave}>{saveLabel}</button>
        ) : null}
        {joinHref ? (
          <a className="btn secondary min-h-11 text-center" href={joinHref}>{t(lang, "atSalonJoin")}</a>
        ) : (
          <button className="btn secondary min-h-11" type="button" onClick={onClose}>{t(lang, "atSalonGotIt")}</button>
        )}
      </div>
    </div>
  );
}
