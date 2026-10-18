"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { guestSessionId } from "@/lib/guest-session";
import { DEFAULT_VISIT_TRY_LIMIT } from "@/lib/visit-tries";

export function useVisitTries(slug: string) {
  const [used, setUsed] = useState(0);
  const [allowance, setAllowance] = useState(DEFAULT_VISIT_TRY_LIMIT);
  const [code, setCode] = useState("");
  const atCap = useRef(false);
  atCap.current = used >= allowance;

  const apply = useCallback((next: { used?: number; allowance?: number }) => {
    if (typeof next.used === "number" && Number.isFinite(next.used)) setUsed(next.used);
    if (typeof next.allowance === "number" && Number.isFinite(next.allowance) && next.allowance > 0) setAllowance(next.allowance);
  }, []);

  useEffect(() => {
    let sessionId = "";
    try {
      sessionId = guestSessionId();
    } catch {
      return;
    }
    setCode(sessionId.slice(-8));
    let stop = false;
    const pull = async () => {
      const res = await fetch(`/api/v1/visit-tries?slug=${encodeURIComponent(slug)}&sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok || stop) return;
      const data = await res.json().catch(() => null);
      if (!data || stop) return;
      apply(data);
    };
    void pull();
    const timer = setInterval(() => {
      if (atCap.current) void pull();
    }, 8000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [slug, apply]);

  return {
    used,
    allowance,
    code,
    atLimit: used >= allowance,
    counter: true,
    applyHeaders(res: Response) {
      const usedHeader = res.headers.get("x-visit-used");
      const limitHeader = res.headers.get("x-visit-limit");
      apply({
        used: usedHeader == null ? undefined : Number(usedHeader),
        allowance: limitHeader == null ? undefined : Number(limitHeader),
      });
    },
    applyBody(data: { used?: number; allowance?: number }) {
      apply(data);
    },
  };
}
