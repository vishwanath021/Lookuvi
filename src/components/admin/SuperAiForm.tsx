"use client";

import { useEffect, useState } from "react";
import { GUEST_FAL_MODEL, GUEST_MODEL_OPTIONS, GUEST_OPENAI_MODEL, type GuestModelId } from "@/lib/ai/guest-models";
import type { GuestPriceRow } from "@/lib/ai/guest-prices";
import type { GuestEngine } from "@/lib/ai/guest-hairstyle";
import type { PlatformAiSettings } from "@/lib/ai/settings-store";
import { formatAiInr } from "@/lib/display";

export function SuperAiForm({
  initial,
  salonCapInr,
  prices,
}: {
  initial: PlatformAiSettings;
  salonCapInr: number;
  prices: GuestPriceRow[];
}) {
  const [openaiKey, setOpenaiKey] = useState(initial.openaiKey);
  const [falKey, setFalKey] = useState(initial.falKey);
  const [openaiDraft, setOpenaiDraft] = useState("");
  const [falDraft, setFalDraft] = useState("");
  const [guestEngine, setGuestEngine] = useState<GuestEngine>(initial.guestEngine || "openai");
  const [guestModel, setGuestModel] = useState<GuestModelId>(initial.guestModel || GUEST_OPENAI_MODEL);
  const [allowByo, setAllowByo] = useState(initial.allowByo);
  const [tier, setTier] = useState(initial.tier);
  const [highEnabled, setHighEnabled] = useState(initial.highEnabled);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [spend, setSpend] = useState(initial.spend);
  const [spendPending, setSpendPending] = useState(Boolean(initial.spend.pending));
  const capPct = spend.capInr > 0 ? Math.min(100, (spend.spentInr / spend.capInr) * 100) : 0;
  const salonCapLabel = Number.isFinite(salonCapInr) ? formatAiInr(salonCapInr) : "Not set";

  function applyView(data: PlatformAiSettings) {
    setOpenaiKey(data.openaiKey);
    setFalKey(data.falKey);
    setAllowByo(data.allowByo);
    setHighEnabled(data.highEnabled);
    if (data.tier) setTier(data.tier);
    if (data.guestEngine === "fal" || data.guestEngine === "openai") setGuestEngine(data.guestEngine);
    if (data.guestModel) setGuestModel(data.guestModel);
    if (data.spend && !data.spend.pending) {
      setSpend(data.spend);
      setSpendPending(false);
    }
  }

  useEffect(() => {
    if (!initial.spend.pending) return;
    let cancel = false;
    void fetch("/api/v1/super/ai/spend")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PlatformAiSettings["spend"] | null) => {
        if (cancel || !data || typeof data.spentInr !== "number") return;
        setSpend(data);
        setSpendPending(false);
      })
      .catch(() => {
        if (!cancel) setSpendPending(false);
      });
    return () => {
      cancel = true;
    };
  }, [initial.spend.pending]);

  async function saveModel(model: GuestModelId) {
    const res = await fetch("/api/v1/super/ai", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guestModelOnly: true, guestModel: model }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.message || "Could not switch the model.");
      return false;
    }
    applyView(data);
    setMessage(model === GUEST_OPENAI_MODEL ? "OpenAI gpt-image-2.5-sunburst is in use." : `${model} is in use.`);
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
    await saveModel(engine === "fal" ? GUEST_FAL_MODEL : GUEST_OPENAI_MODEL);
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
        <label className="block text-sm">Guest hairstyle model
          <select
            className="field mt-1"
            aria-label="Guest hairstyle model"
            value={guestModel}
            disabled={busy}
            onChange={(event) => {
              const model = event.target.value as GuestModelId;
              setGuestModel(model);
              setBusy(true);
              setMessage("");
              void saveModel(model).finally(() => setBusy(false));
            }}
          >
            {GUEST_MODEL_OPTIONS.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted">Sunburst is the default. A fal model uses the fal key above. Nothing else changes until you pick a different model.</p>
        {message ? <p className="text-sm" role="status">{message}</p> : null}
      </section>

      <section className="card grid gap-2 p-4" data-prices="guest">
        <h2 className="text-base font-semibold">Models & price per image</h2>
        <ul className="text-sm">
          {prices.map((row) => (
            <li key={row.id} className="flex justify-between gap-3 border-t border-line py-2">
              <span>{row.label}<span className="block text-xs text-muted">{row.detail}</span></span>
              <span>{formatAiInr(row.inr)}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">Estimates use the FX_INR_PER_USD setting, with no 8% buffer. Not an invoice. A live medium 1024×1360 sunburst bill was about $0.032.</p>
      </section>

      <section className="card grid gap-2 p-4">
        <h2 className="text-base font-semibold">Spend cap</h2>
        <p className="text-sm">{spendPending ? "Loading spend…" : `${formatAiInr(spend.spentInr)} of ${formatAiInr(spend.capInr)}`}</p>
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
