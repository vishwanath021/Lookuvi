"use client";

import { useEffect, useState } from "react";
import { t } from "@/data/i18n";
import { formatToken } from "@/lib/queue/format-token";
import { displayedWait, restoreWaitSample, waitSample } from "@/lib/queue/wait-display";

function sampleKey(scope: string) {
  return `lookuvi-wait:${scope}`;
}

function readStoredSample(scope: string) {
  if (!scope || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(sampleKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { wait?: number; at?: number };
    if (typeof parsed.wait !== "number" || typeof parsed.at !== "number") return null;
    return { wait: parsed.wait, at: parsed.at };
  } catch {
    return null;
  }
}

function writeStoredSample(scope: string, sample: { wait: number; at: number }) {
  if (!scope || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(sampleKey(scope), JSON.stringify(sample));
  } catch {
    /* The in-memory sample still counts down on this screen. */
  }
}

/** Counts the server wait down once a minute. The sample survives leaving the ticket and coming back. */
export function useDisplayedWait(serverWait: number, scope = "") {
  const [sample, setSample] = useState(() => {
    const next = restoreWaitSample(readStoredSample(scope), serverWait, Date.now());
    writeStoredSample(scope, next);
    return next;
  });
  const [now, setNow] = useState(() => Date.now());
  const next = waitSample(sample, serverWait, Date.now());
  if (next !== sample && (next.wait !== sample.wait || next.at !== sample.at)) {
    writeStoredSample(scope, next);
    setSample(next);
  }

  useEffect(() => {
    let timer = 0;
    const arm = () => {
      const elapsed = Date.now() - sample.at;
      const into = elapsed % 60_000;
      const delay = into === 0 ? 60_000 : 60_000 - into;
      timer = window.setTimeout(() => {
        setNow(Date.now());
        arm();
      }, delay);
    };
    arm();
    return () => window.clearTimeout(timer);
  }, [sample.at]);

  return displayedWait(sample.wait, sample.at, now);
}

export function QueueWait({
  serverWait,
  ahead,
  token,
  lang,
  phrase,
  scope = "",
}: {
  serverWait: number;
  ahead: number;
  token?: number;
  lang: string;
  phrase?: "next" | "turn" | "join";
  /** Same id on the way back keeps the countdown, for example the ticket ref. */
  scope?: string;
}) {
  const minutes = useDisplayedWait(serverWait, scope);
  if (phrase === "join") {
    return (
      <div className="mt-6 text-center" data-queue-wait={String(minutes)} data-queue-join="yes">
        <p className="text-4xl font-bold leading-none">{t(lang, "queueJoin")}</p>
        <p className="mt-3 text-sm text-muted">{t(lang, "queueWaitingAbout", { ahead, min: minutes })}</p>
      </div>
    );
  }
  const zero = phrase === "turn" || minutes <= 0;
  const label = phrase === "turn" ? t(lang, "queueTurnNow") : t(lang, "queueYoureNext");

  return (
    <div className="mt-6 text-center" data-queue-wait={zero ? "0" : String(minutes)}>
      {zero ? (
        <p className="text-4xl font-bold leading-none text-[var(--good)]">{label}</p>
      ) : (
        <>
          <p className="text-6xl font-bold leading-none tracking-tight text-[var(--good)] tabular-nums">{t(lang, "queueWaitMin", { min: minutes })}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">{t(lang, "queueEstWait")}</p>
        </>
      )}
      {token == null ? null : <p className="nums mt-4 text-base font-normal" data-queue-token={token}>{t(lang, "queueToken", { token: formatToken(token) })}</p>}
      <p className={token == null ? "mt-4 text-sm text-muted" : "text-sm text-muted"}>{t(lang, "queueAheadShort", { ahead })}</p>
    </div>
  );
}
