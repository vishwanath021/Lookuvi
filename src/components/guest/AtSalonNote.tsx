"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { t } from "@/data/i18n";
import { guestDeviceId } from "@/lib/device-id";
import { guestSessionId } from "@/lib/guest-session";

type View = {
  ready: boolean;
  required: boolean;
  unlocked: boolean;
  remaining: number;
  staffAdded: number;
  askWait: boolean;
  note: string;
  ask: () => Promise<void>;
};

const IDLE: View = {
  ready: false,
  required: false,
  unlocked: true,
  remaining: 1,
  staffAdded: 0,
  askWait: false,
  note: "",
  ask: async () => undefined,
};

const Ctx = createContext<View>(IDLE);

function unlockedLine(lang: string, remaining: number) {
  if (remaining === 1) return t(lang, "atSalonUnlockedOne");
  return t(lang, "atSalonUnlockedMany", { count: remaining });
}

function staffLine(lang: string, count: number) {
  if (count === 1) return t(lang, "staffAddedOne");
  return t(lang, "staffAddedMany", { count });
}

export function AtSalonProvider({ slug, lang, children }: { slug: string; lang: string; children: ReactNode }) {
  const [view, setView] = useState<View>(IDLE);

  useEffect(() => {
    let stop = false;
    let sessionId = "";
    let deviceId = "";
    try {
      sessionId = guestSessionId();
      deviceId = guestDeviceId();
    } catch {
      return;
    }
    const pull = async () => {
      const res = await fetch(`/api/v1/at-salon?slug=${encodeURIComponent(slug)}&sessionId=${encodeURIComponent(sessionId)}&deviceId=${encodeURIComponent(deviceId)}`);
      if (!res.ok || stop) return;
      const data = await res.json().catch(() => null);
      if (!data || stop) return;
      setView((current) => ({
        ...current,
        ready: true,
        required: Boolean(data.required),
        unlocked: Boolean(data.unlocked),
        remaining: Number(data.remaining) || 0,
        staffAdded: Number(data.staffAdded) || 0,
        askWait: Boolean(data.askWait),
      }));
    };
    void pull();
    const timer = setInterval(() => void pull(), 4000);
    setView((current) => ({
      ...current,
      ask: async () => {
        const res = await fetch("/api/v1/at-salon", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "ask", slug, sessionId, deviceId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setView((current) => ({ ...current, note: data.message || t(lang, "askMoreWait") }));
          return;
        }
        setView((current) => ({
          ...current,
          note: t(lang, "askedMoreTries"),
          askWait: true,
          remaining: Number(data.remaining) || current.remaining,
          staffAdded: Number(data.staffAdded) || current.staffAdded,
        }));
      },
    }));
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [slug, lang]);

  return <Ctx.Provider value={view}>{children}</Ctx.Provider>;
}

export function useAtSalon() {
  return useContext(Ctx);
}

export function AtSalonNote({ lang }: { lang: string }) {
  const state = useAtSalon();
  if (!state.required || !state.ready) return null;
  const locked = !state.unlocked;
  if (locked && state.staffAdded <= 0 && !state.note) return null;
  return (
    <div className="mt-3 grid gap-2" data-at-salon={locked ? "locked" : state.remaining > 0 ? "unlocked" : "ask"}>
      {!locked && state.remaining > 0 ? <p className="text-sm" role="status">{unlockedLine(lang, state.remaining)}</p> : null}
      {state.staffAdded > 0 ? <p className="text-sm" role="status" data-staff-added="yes">{staffLine(lang, state.staffAdded)}</p> : null}
      {!locked && state.remaining <= 0 ? (
        <button className="btn w-full" type="button" data-ask-tries="yes" disabled={state.askWait} onClick={() => void state.ask()}>
          {t(lang, "askMoreTries")}
        </button>
      ) : null}
      {state.note ? <p className="text-sm text-muted" role="status">{state.note}</p> : null}
    </div>
  );
}
