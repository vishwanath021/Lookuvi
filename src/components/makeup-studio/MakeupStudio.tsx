"use client";

import { useEffect, useRef, useState } from "react";
import { ConsentSheet } from "@/components/tryon/ConsentSheet";
import { usePhotoConsent } from "@/components/tryon/usePhotoConsent";
import { useVisitTries } from "@/components/tryon/useVisitTries";
import { guestSessionId } from "@/lib/guest-session";
import { detectStudioFace, type StudioFace } from "@/lib/makeup-studio/detect";
import {
  applyPreset,
  EYE_LOOKS,
  FINISH_LOOKS,
  LIP_SHADES,
  matchingPreset,
  PRESET_LIST,
  type EyeStyle,
  type Finish,
  type LipId,
  type LookParams,
  type Quality,
} from "@/lib/makeup-studio/core";
import { DEFAULT_LOOK } from "@/lib/makeup-studio/core/presets";
import { renderMakeup } from "@/lib/makeup-studio/render/render";
import type { SalonConfig } from "@/lib/salon";
import { tryCounterLabel, VISIT_CAP_MESSAGE } from "@/lib/visit-tries";

type Photo = { canvas: HTMLCanvasElement; url: string };

const EYES = Object.values(EYE_LOOKS);
const FINISHES = Object.values(FINISH_LOOKS);
const LIPS = Object.values(LIP_SHADES);
const QUALITIES: { id: Quality; name: string }[] = [
  { id: "fast", name: "Fast" },
  { id: "balanced", name: "Balanced" },
  { id: "high", name: "High" },
];

function chipClass(on: boolean) {
  return `min-h-11 rounded-full border px-3 text-sm ${on ? "border-[var(--brand)] bg-[var(--selected)]" : "border-line bg-white"}`;
}

async function orientedCanvas(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const edge = 1800;
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("canvas");
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("blob");
  return { canvas, url: URL.createObjectURL(blob) };
}

async function uploadBlob(canvas: HTMLCanvasElement) {
  const edge = 1280;
  const scale = Math.min(1, edge / Math.max(canvas.width, canvas.height));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(canvas.width * scale));
  out.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  let quality = 0.86;
  let blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/jpeg", quality));
  while (blob && blob.size > 1_800_000 && quality > 0.5) {
    quality -= 0.12;
    blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/jpeg", quality));
  }
  if (!blob) throw new Error("blob");
  return blob;
}

export function MakeupStudio({ config }: { config: SalonConfig }) {
  const consent = usePhotoConsent(config.slug, config.defaultLang || "en");
  const visit = useVisitTries(config.slug);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoRef = useRef<Photo | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [face, setFace] = useState<StudioFace | null>(null);
  const [params, setParams] = useState<LookParams>(DEFAULT_LOOK);
  const [status, setStatus] = useState<"empty" | "reading" | "ready" | "noface" | "error">("empty");
  const [note, setNote] = useState("");
  const [engine, setEngine] = useState("");
  const [renderId, setRenderId] = useState(0);
  const [before, setBefore] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [aiUrl, setAiUrl] = useState("");
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoId, setPhotoId] = useState("");
  const preset = matchingPreset(params);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!photo || !face || !canvas || aiUrl) return;
    let live = true;
    const frame = requestAnimationFrame(() => {
      if (!live) return;
      try {
        const used = renderMakeup({
          canvas,
          image: photo.canvas,
          landmarks: face.landmarks,
          params,
          skinMask: face.skinMask,
          skinMaskWidth: face.maskWidth,
          skinMaskHeight: face.maskHeight,
        });
        setEngine(used);
        setRenderId((current) => current + 1);
        setStatus("ready");
      } catch {
        setStatus("error");
        setNote("Could not draw that look.");
      }
    });
    return () => {
      live = false;
      cancelAnimationFrame(frame);
    };
  }, [photo, face, params, aiUrl]);

  useEffect(() => () => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
  }, []);

  function patch(next: Partial<LookParams>) {
    setAiUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    setDemo(false);
    setParams((current) => ({ ...current, ...next }));
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setNote("");
    setStatus("reading");
    setFace(null);
    setAiUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    setBefore(0);
    try {
      const next = await orientedCanvas(file);
      if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
      photoRef.current = next;
      setPhoto(next);
      setPhotoId("");
      const found = await detectStudioFace(next.canvas);
      if (!found) {
        setFace(null);
        setStatus("noface");
        setNote("No face in that photo.");
        return;
      }
      setFace(found);
    } catch {
      setStatus("error");
      setNote("Use a JPEG, PNG, or WebP photo.");
    }
  }

  function splitFrom(event: { clientX: number; currentTarget: Element }) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const x = (event.clientX - rect.left) / rect.width;
    setBefore(Math.min(1, Math.max(0, x)));
  }

  async function runPhotoreal() {
    const current = photoRef.current;
    if (!current || !face || busy) return;
    if (visit.atLimit) {
      setNote(VISIT_CAP_MESSAGE);
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const consentId = (await consent.persist()) || consent.consentId();
      const body = new FormData();
      body.set("slug", config.slug);
      body.set("sessionId", guestSessionId());
      body.set("look", JSON.stringify(params));
      body.set("requestId", crypto.randomUUID());
      if (consentId) body.set("consentId", consentId);
      if (photoId) body.set("photoId", photoId);
      else body.set("photo", new File([await uploadBlob(current.canvas)], "portrait.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/v1/makeup-studio/render", { method: "POST", body });
      visit.applyHeaders(res);
      const type = res.headers.get("content-type") || "";
      if (!res.ok || !type.includes("image")) {
        const data = await res.json().catch(() => ({}));
        setNote(data.message || "Could not render.");
        return;
      }
      const nextId = res.headers.get("x-photo-id") || "";
      if (nextId) setPhotoId(nextId);
      const blob = await res.blob();
      setAiUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setDemo((res.headers.get("x-demo-reason") || "") !== "");
      setBefore(0);
    } catch {
      setNote("Could not render.");
    } finally {
      setBusy(false);
    }
  }

  const counter = tryCounterLabel(visit.used, visit.allowance);
  const controls = (
    <div className="grid gap-3">
      <div className="flex gap-2 overflow-x-auto md:hidden">
        {PRESET_LIST.map((item) => (
          <button key={item.id} type="button" className={`${chipClass(preset === item.id)} shrink-0`} aria-pressed={preset === item.id} aria-label={`Look: ${item.name}`} data-preset={item.id} onClick={() => patch(applyPreset(item.id))}>
            {item.name}
          </button>
        ))}
      </div>
      <Slider label="Foundation" value={params.foundation} onChange={(foundation) => patch({ foundation })} />
      <Slider label="Blush" value={params.blush} onChange={(blush) => patch({ blush })} />
      <Slider label="Intensity" value={params.intensity} onChange={(intensity) => patch({ intensity })} />
      <div className="flex flex-wrap gap-2" role="list" aria-label="Lip colour">
        {LIPS.map((lip) => (
          <button key={lip.id} type="button" className={`h-11 w-11 rounded-full border-2 ${params.lip === lip.id ? "border-[var(--brand)]" : "border-white"}`} style={{ background: lip.hex }} aria-label={`Lip ${lip.name}`} aria-pressed={params.lip === lip.id} onClick={() => patch({ lip: lip.id as LipId })} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chipClass(params.gloss)} aria-pressed={params.gloss} onClick={() => patch({ gloss: !params.gloss })}>Gloss</button>
        {EYES.map((eye) => (
          <button key={eye.id} type="button" className={chipClass(params.eyes === eye.id)} aria-pressed={params.eyes === eye.id} aria-label={`Eyes ${eye.name}`} onClick={() => patch({ eyes: eye.id as EyeStyle })}>{eye.name}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {FINISHES.map((finish) => (
          <button key={finish.id} type="button" className={chipClass(params.finish === finish.id)} aria-pressed={params.finish === finish.id} aria-label={`Finish ${finish.name}`} onClick={() => patch({ finish: finish.id as Finish })}>{finish.name}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {QUALITIES.map((quality) => (
          <button key={quality.id} type="button" className={chipClass(params.quality === quality.id)} aria-pressed={params.quality === quality.id} aria-label={`Quality ${quality.name}`} onClick={() => patch({ quality: quality.id })}>{quality.name}</button>
        ))}
      </div>
    </div>
  );

  const looks = (
    <div className="hidden gap-2 md:grid">
      {PRESET_LIST.map((item) => (
        <button key={item.id} type="button" className={`card px-3 py-2 text-left ${preset === item.id ? "ring-2 ring-[var(--brand)]" : ""}`} aria-pressed={preset === item.id} aria-label={`Look: ${item.name}`} data-preset={item.id} onClick={() => patch(applyPreset(item.id))}>
          <span className="block font-medium">{item.name}</span>
          <span className="block text-xs text-muted">{item.line}</span>
        </button>
      ))}
    </div>
  );

  const actions = (
    <div className="grid gap-2">
      <button className="btn w-full" type="button" disabled={!face || busy || visit.atLimit} onClick={() => consent.gate(() => { void runPhotoreal(); })}>
        {busy ? "Working…" : `Photoreal · ${counter}`}
      </button>
      <div className="flex gap-2">
        <button className="btn secondary flex-1" type="button" onClick={() => uploadRef.current?.click()}>Upload</button>
        <button className="btn secondary flex-1" type="button" onClick={() => cameraRef.current?.click()}>Take photo</button>
      </div>
      {visit.atLimit ? <p className="text-sm text-muted">{VISIT_CAP_MESSAGE}</p> : null}
      {demo ? <p className="text-xs text-muted">Sample</p> : null}
      {note ? <p className="text-sm" role="status" data-makeup-note style={{ color: "var(--bad)" }}>{note}</p> : null}
    </div>
  );

  return (
    <section data-makeup-studio="on" data-makeup-status={status} className="relative">
      <input ref={uploadRef} data-makeup-upload className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void onFile(event.target.files?.[0])} />
      <input ref={cameraRef} data-makeup-camera className="sr-only" type="file" accept="image/*" capture="user" onChange={(event) => void onFile(event.target.files?.[0])} />
      <ConsentSheet open={consent.open} onAgree={() => void consent.agree()} onClose={consent.close} />
      <div className="md:grid md:grid-cols-[240px_minmax(0,1fr)_240px] md:items-start md:gap-4">
        <div className="max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:max-h-[52dvh] max-md:overflow-y-auto max-md:rounded-t-2xl max-md:border max-md:border-line max-md:bg-white max-md:p-3 max-md:shadow-[0_-8px_24px_rgba(62,48,75,0.12)] md:contents">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-[var(--line)] md:hidden" />
          <div className="md:sticky md:top-4 md:col-start-1 md:max-h-[calc(100dvh-2rem)] md:overflow-y-auto md:pr-1">
            {controls}
            <div className="mt-3 md:hidden">{actions}</div>
          </div>
          <div className="md:sticky md:top-4 md:col-start-3 md:row-start-1 md:max-h-[calc(100dvh-2rem)] md:overflow-y-auto">
            {looks}
          </div>
        </div>
        <div className="md:col-start-2 md:row-start-1 max-md:mb-[54dvh]">
          {!photo ? (
            <div className="card grid min-h-64 place-items-center gap-3 p-6 text-center">
              <p className="font-serif text-2xl">Makeup</p>
              <div className="flex w-full max-w-xs gap-2">
                <button className="btn secondary flex-1" type="button" onClick={() => uploadRef.current?.click()}>Upload</button>
                <button className="btn flex-1" type="button" onClick={() => cameraRef.current?.click()}>Take photo</button>
              </div>
            </div>
          ) : (
            <div
              className="relative touch-none"
              onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest("button")) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragging(true);
                splitFrom(event);
              }}
              onPointerMove={(event) => {
                if (!dragging) return;
                splitFrom(event);
              }}
              onPointerUp={() => setDragging(false)}
              onPointerCancel={() => setDragging(false)}
            >
              {aiUrl ? (
                <img src={aiUrl} alt="" data-makeup-result={demo ? "sample" : "photo"} className="block w-full rounded-[14px]" />
              ) : (
                <canvas ref={canvasRef} data-makeup-canvas data-render-engine={engine} data-render-id={renderId} className="block w-full rounded-[14px] bg-[var(--selected)]" />
              )}
              <img src={photo.url} alt="" className="pointer-events-none absolute inset-0 h-full w-full rounded-[14px]" style={{ clipPath: `inset(0 ${(1 - before) * 100}% 0 0)`, objectFit: "fill" }} />
              <div
                role="slider"
                tabIndex={0}
                aria-label="Before and after"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(before * 100)}
                className="absolute inset-y-0 w-11 -translate-x-1/2 cursor-ew-resize"
                style={{ left: `${before * 100}%` }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") setBefore((value) => Math.max(0, value - 0.05));
                  if (event.key === "ArrowRight") setBefore((value) => Math.min(1, value + 0.05));
                }}
              >
                <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow" />
                <span className="absolute top-1/2 left-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[var(--aubergine)]" />
              </div>
              <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/55 px-2 py-1 text-xs text-white">Before</span>
              <span className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-black/55 px-2 py-1 text-xs text-white">After</span>
            </div>
          )}
          {status === "reading" ? <p className="mt-2 text-sm text-muted">Reading the photo…</p> : null}
          <div className="mt-3 hidden md:block">{actions}</div>
        </div>
      </div>
    </section>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-sm">
      <span>{label}</span>
      <span className="tabular-nums text-muted">{value}</span>
      <input className="col-span-2 h-11 w-full accent-[var(--brand)]" type="range" min={0} max={100} value={value} aria-label={label} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
