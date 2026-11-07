"use client";

import { useEffect, useState } from "react";
import { GENERATION_EXPECTED_MS, generationFrame } from "@/lib/generation-stage";

export function GeneratingLook({ tool, expectedMs = GENERATION_EXPECTED_MS, blur = true }: { tool: string; expectedMs?: number; blur?: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 200);
    return () => window.clearInterval(timer);
  }, []);
  const frame = generationFrame(tool, elapsed, expectedMs);
  return (
    <div className="gen-veil" data-generating="yes" data-stage={frame.label} data-blur={blur ? "yes" : "no"} role="status">
      {blur ? <div className="gen-blur" /> : null}
      <div className="gen-mesh" aria-hidden="true" />
      <div className="gen-caption">
        <p className="gen-stage">{frame.label}</p>
        <div
          className="gen-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={frame.pct}
          aria-valuetext={frame.label}
          aria-label={frame.label}
        >
          <span style={{ width: `${frame.pct}%` }} />
        </div>
      </div>
    </div>
  );
}
