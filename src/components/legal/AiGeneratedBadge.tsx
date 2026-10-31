"use client";

import { t } from "@/data/i18n";

/** Visible MeitY-style label for synthetically generated try-on results. */
export function AiGeneratedBadge({ lang = "en", className = "" }: { lang?: string; className?: string }) {
  return (
    <p
      className={`pointer-events-none absolute left-2 top-2 z-20 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium tracking-wide text-white ${className}`.trim()}
      data-ai-generated="yes"
    >
      {t(lang, "aiGeneratedLabel")}
    </p>
  );
}
