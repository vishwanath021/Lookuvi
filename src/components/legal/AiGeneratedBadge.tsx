"use client";

import { t } from "@/data/i18n";

/** Visible MeitY-style label for synthetically generated try-on results. */
export function AiGeneratedBadge({
  lang = "en",
  className = "",
  place = "corner",
}: {
  lang?: string;
  className?: string;
  /** Banner sits under the Before/After chips so the two labels do not share a corner. */
  place?: "corner" | "banner";
}) {
  const position = place === "banner"
    ? "left-1/2 top-auto bottom-16 z-20 -translate-x-1/2"
    : "left-2 top-2 z-20";
  return (
    <p
      className={`pointer-events-none absolute rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium tracking-wide text-white ${position} ${className}`.trim()}
      data-ai-generated="yes"
      data-ai-place={place}
    >
      {t(lang, "aiGeneratedLabel")}
    </p>
  );
}
