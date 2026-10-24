"use client";

import { useState } from "react";
import { MODEL_PRICES } from "@/data/model-prices";
import type { GuestEngine } from "@/lib/ai/guest-hairstyle";
import type { PlatformAiSettings } from "@/lib/ai/settings-store";
import { formatAiInr } from "@/lib/display";

export function SuperAiForm({
  initial,
  salonCapInr,
}: {
  initial: PlatformAiSettings;
  salonCapInr: number;
}) {
  const [openaiKey, setOpenaiKey] = useState(initial.openaiKey);
  const [falKey, setFalKey] = useState(initial.falKey);
  const [openaiDraft, setOpenaiDraft] = useState("");
  const [falDraft, setFalDraft] = useState("");
  const [guestEngine, setGuestEngine] = useState<GuestEngine>(initial.guestEngine || "openai");
  const [allowByo, setAllowByo] = useState(initial.allowByo);
  const [tier, setTier] = useState(initial.tier);
  const [highEnabled, setHighEnabled] = useState(initial.highEnabled);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const capPct = initial.spend.capInr > 0 ? Math.min(100, (initial.spend.spentInr / initial.spend.capInr) * 100) : 0;
  const salonCapLabel = Number.isFinite(salonCapInr) ? formatAiInr(salonCapInr) : "Not set";

  function applyView(data: PlatformAiSettings) {
    setOpenaiKey(data.openaiKey);
    setFalKey(data.falKey);
    setAllowByo(data.allowByo);
    setHighEnabled(data.highEnabled);
    if (data.tier) setTier(data.tier);
    if (data.guestEngine === "fal" || data.guestEngine === "openai") setGuestEngine(data.guestEngine);
  }

  async function saveGuest(engine: GuestEngine) {
    const res = await fetch("/api/v1/super/ai", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guestEngineOnly: true, guestEngine: engine }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.message || "Could not switch the model.");
      return false;
    }
    applyView(data);
    setMessage(engine === "fal" ? "fal is in use." : "OpenAI is in use.");
    return true;
  }

  async function saveOpenAi() {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/v1/super/ai", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "openai", apiKey: openaiDraft, allowByo, tier, highEnabled }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(data.message || "Could not save the OpenAI key.");
      return;
    }
    applyView(data);
    setOpenaiDraft("");
    setMessage("OpenAI key saved.");
  }

  async function saveFal(enabled: boolean) {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/v1/super/ai", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ falOnly: true, falKey: falDraft, falEnabled: enabled, removeFalKey: false }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(data.message || "Could not save the fal key.");
      return false;
    }
    applyView(data);
    setFalDraft("");
    setMessage("fal key saved.");
    return true;
  }

  async function chooseEngine(engine: GuestEngine) {
    setBusy(true);
    setMessage("");
    if (engine === "fal") {
      const saved = await saveFal(true);
      if (!saved) return;
    }
    await saveGuest(engine);
    setBusy(false);
  }

  async function testKey(provider: "openai" | "fal", apiKey: string) {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/v1/super/ai/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, apiKey }),
    });
    const data = await res.json().catch(() => ({ message: "Could not reach the provider." }));
    setBusy(false);
    setMessage(data.message || (res.ok ? "Connected." : "The provider rejected that key."));
  }

  return (
    <div className="grid max-w-3xl gap-4">
      <section className="card grid gap-3 p-4">
        <h2 className="text-base font-semibold">Models</h2>
        <KeyRow
          title="OpenAI"
          saved={openaiKey.saved}
          hint={openaiKey.hint}
          inUse={guestEngine === "openai"}
          draft={openaiDraft}
          onDraft={setOpenaiDraft}
          ariaLabel="OpenAI key"
          busy={busy}
          onSave={() => void saveOpenAi()}
          onTest={() => void testKey("openai", openaiDraft)}
          onUse={() => void chooseEngine("openai")}
        />
        <KeyRow
          title="fal"
          saved={falKey.saved}
          hint={falKey.hint}
          inUse={guestEngine === "fal"}
          draft={falDraft}
          onDraft={setFalDraft}
          ariaLabel="fal key"
          busy={busy}
          onSave={() => void saveFal(guestEngine === "fal" || falKey.enabled)}
          onTest={() => void testKey("fal", falDraft)}
          onUse={() => void chooseEngine("fal")}
        />
        {message ? <p className="text-sm" role="status">{message}</p> : null}
      </section>

      <section className="card grid gap-2 p-4">
        <h2 className="text-base font-semibold">Models & price per image</h2>
        <ul className="text-sm">
          {MODEL_PRICES.map((row) => (
            <li key={row.id} className="flex justify-between gap-3 border-t border-line py-2">
              <span>{row.label} · {row.model} · {row.role === "primary" ? "In use by default" : "Fallback"}</span>
              <span>₹{row.inrPerImage}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card grid gap-2 p-4">
        <h2 className="text-base font-semibold">Spend cap</h2>
        <p className="text-sm">{formatAiInr(initial.spend.spentInr)} of {formatAiInr(initial.spend.capInr)}</p>
        <div className="h-2 overflow-hidden rounded-full bg-sand" aria-hidden>
          <div className="h-full bg-aubergine" style={{ width: `${capPct}%` }} />
        </div>
        {capPct >= 80 ? <p className="text-sm" role="status">Spend is at {Math.round(capPct)}% of the platform cap.</p> : null}
        <p className="text-sm">Per-salon cap {salonCapLabel}</p>
      </section>
    </div>
  );
}

function KeyRow({
  title,
  saved,
  hint,
  inUse,
  draft,
  onDraft,
  ariaLabel,
  busy,
  onSave,
  onTest,
  onUse,
}: {
  title: string;
  saved: boolean;
  hint: string;
  inUse: boolean;
  draft: string;
  onDraft: (value: string) => void;
  ariaLabel: string;
  busy: boolean;
  onSave: () => void;
  onTest: () => void;
  onUse: () => void;
}) {
  return (
    <div className="grid gap-2 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{title}</p>
        {saved ? <p className="text-xs text-good">Saved ✓ {hint}</p> : <p className="text-xs text-muted">Not saved</p>}
        {inUse ? <p className="text-xs font-semibold">In use</p> : <button className="btn secondary" type="button" disabled={busy} onClick={onUse}>Use</button>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field max-w-xs font-mono"
          type="password"
          autoComplete="off"
          spellCheck={false}
          aria-label={ariaLabel}
          placeholder={saved ? hint || "Key saved" : "Paste key"}
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
        />
        <button className="btn secondary" type="button" disabled={busy} onClick={onSave}>Save</button>
        <button className="btn secondary" type="button" disabled={busy} onClick={onTest}>Test</button>
      </div>
    </div>
  );
}
