"use client";

import { t } from "@/data/i18n";

/** Short stand-in for the empty photo frame while try-ons are locked. */
export function LockedPhotoNote({ lang }: { lang: string }) {
  return (
    <div className="rounded-2xl border border-line bg-sand px-4 py-5 text-center text-sm" data-locked-panel="yes" role="status">
      {t(lang, "atSalonLocked")}
    </div>
  );
}
