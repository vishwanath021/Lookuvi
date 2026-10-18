"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { BeforeAfter } from "@/components/tryon/BeforeAfter";
import { ConsentSheet } from "@/components/tryon/ConsentSheet";
import { GeneratingLook } from "@/components/tryon/GeneratingLook";
import { LiveStudio } from "@/components/tryon/LiveStudio";
import { LargeFrame, LiveTray, MakeupSwatches, SelectionSummary, StepCard, StepRail, TryBar, scrollToStep } from "@/components/tryon/LookStepper";
import { usePhotoConsent } from "@/components/tryon/usePhotoConsent";
import { OWN_LOOK_SLOTS, type OwnLookSlotId } from "@/data/bridal-own";
import {
  BRIDAL_MAKEUP,
  bridalStylesFor,
  visibleStylePills,
  cardsForStyle,
  defaultBridalStyle,
  type BridalStyleId,
} from "@/data/bridal";
import { captureShouldMirror, visiblePortraitCrop } from "@/lib/capture";
import { guestSessionId } from "@/lib/guest-session";
import type { SalonConfig } from "@/lib/salon";
import { tryNowReady } from "@/lib/try-now";
import { selectionKey, takePreview, tryButton, tryCounterLabel, VISIT_CAP_MESSAGE, type CachedLook } from "@/lib/visit-tries";
import { attachSelfie, readPhotoId, shotFromBlob } from "@/lib/visit-photo";
import { useVisitTries } from "@/components/tryon/useVisitTries";
import { OWN_ITEM_EDGE, OWN_SELFIE_EDGE, payloadProblem, postPreview, shrinkPhoto } from "@/lib/own-upload";
import { dropOwnItem, loadOwnItems, saveOwnItem } from "@/lib/own-items-store";
import { WearTiles } from "@/components/tryon/WearTiles";

type Shot = { blob: Blob; url: string; digest: string; serverId?: string };
type LookResult = CachedLook & { after: string };
type Target = "face" | OwnLookSlotId;

function remember(current: Shot | undefined, next: Shot) {
  if (current && current.url.startsWith("blob:")) URL.revokeObjectURL(current.url);
  return next;
}

export function BridalOwnLook({ config }: { config: SalonConfig }) {
  const [face, setFace] = useState<Shot | null>(null);
  const [items, setItems] = useState<Partial<Record<OwnLookSlotId, Shot>>>({});
  const [makeupStyle, setMakeupStyle] = useState<BridalStyleId>(defaultBridalStyle(BRIDAL_MAKEUP));
  const [makeupId, setMakeupId] = useState("makeup-soft-rose");
  const [live, setLive] = useState<Target | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState("");
  const [result, setResult] = useState<LookResult | null>(null);
  const [servedKey, setServedKey] = useState("");
  const cache = useRef(new Map<string, LookResult>());
  const visit = useVisitTries(config.slug);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileTarget = useRef<Target>("face");
  const boxes = useRef<Record<string, HTMLDivElement | null>>({});
  const consent = usePhotoConsent(config.slug, config.defaultLang || "en");
  const makeupCards = cardsForStyle(BRIDAL_MAKEUP, makeupStyle);
  const chosen = BRIDAL_MAKEUP.find((item) => item.id === makeupId) || makeupCards[0];

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Android can reload the page when the camera app opens. Bring back the pieces this tab added.
  useEffect(() => {
    let live = true;
    void loadOwnItems(`bridal:${config.slug}`).then(async (saved) => {
      const restored: Partial<Record<OwnLookSlotId, Shot>> = {};
      for (const slot of OWN_LOOK_SLOTS) {
        const blob = saved[slot.id];
        if (blob) restored[slot.id] = await shotFromBlob(blob);
      }
      if (!live || Object.keys(restored).length === 0) return;
      setItems((current) => ({ ...restored, ...current }));
    }).catch(() => undefined);
    return () => { live = false; };
  }, [config.slug]);

  function stopLive() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    setLive(null);
    setCamReady(false);
  }

  function beginLive(target: Target) {
    consent.gate(() => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const devices = navigator.mediaDevices;
      if (!devices?.getUserMedia) {
        setCamError("The camera is not available. You can use a photo instead.");
        return;
      }
      const facing = target === "face" ? "user" : "environment";
      const pending = devices.getUserMedia({ video: { facingMode: facing === "user" ? "user" : { ideal: "environment" } } });
      flushSync(() => {
        setCamError("");
        setCamReady(false);
        setZoom(1);
        setLive(target);
      });
      boxes.current[target]?.scrollIntoView({ block: "center" });
      void pending.then(async (stream) => {
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        streamRef.current = stream;
        await video.play();
        setCamReady(true);
      }).catch(() => {
        stopLive();
        setCamError("Camera permission was denied. Allow the camera for this site, or use a photo.");
      });
    });
  }

  async function fileToShot(file: File, edge: number) {
    const raw = file.slice(0, file.size, file.type || "image/jpeg");
    return shotFromBlob(await shrinkPhoto(raw, edge));
  }

  function addFile(target: Target, file: File) {
    setError("");
    void fileToShot(file, target === "face" ? OWN_SELFIE_EDGE : OWN_ITEM_EDGE)
      .then((shot) => storeShot(target, shot))
      .catch(() => setError("That photo could not be read. Please pick a JPEG or PNG photo."));
  }

  function openFile(target: Target) {
    consent.gate(() => {
      fileTarget.current = target;
      fileRef.current?.click();
    });
  }

  function removeItem(id: OwnLookSlotId) {
    setItems((current) => {
      const shot = current[id];
      if (shot && shot.url.startsWith("blob:")) URL.revokeObjectURL(shot.url);
      const next = { ...current };
      delete next[id];
      return next;
    });
    void dropOwnItem(`bridal:${config.slug}`, id);
    setResult(null);
    setReveal("");
  }

  function storeShot(target: Target, shot: Shot) {
    if (target === "face") {
      setFace((current) => remember(current || undefined, shot));
      setResult(null);
      setReveal("");
      return;
    }
    setItems((current) => ({ ...current, [target]: remember(current[target], shot) }));
    void saveOwnItem(`bridal:${config.slug}`, target, shot.blob);
    setResult(null);
    setReveal("");
  }

  async function captureLive() {
    const video = videoRef.current;
    if (!video || !live) return;
    const srcW = video.videoWidth || 720;
    const srcH = video.videoHeight || 960;
    const crop = visiblePortraitCrop(srcW, srcH);
    const scale = Math.min(1, 1024 / Math.max(crop.sw, crop.sh));
    const width = Math.max(2, Math.round(crop.sw * scale));
    const height = Math.max(2, Math.round(crop.sh * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const facing = live === "face" ? "user" : "environment";
    if (captureShouldMirror(facing)) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return;
    const target = live;
    stopLive();
    storeShot(target, await shotFromBlob(blob));
  }

  function currentKey(shot: Shot) {
    const pieces = OWN_LOOK_SLOTS.map((slot) => `${slot.id}:${items[slot.id]?.digest || ""}`).join(",");
    return selectionKey(shot.digest, { makeup: makeupId, items: pieces });
  }

  function showSaved(key: string, saved: LookResult) {
    setReveal(saved.after);
    setResult(saved);
    setServedKey(key);
  }

  async function generate() {
    if (busy || !face || !chosen) return;
    const problem = payloadProblem([
      ...(face.serverId ? [] : [{ label: "selfie", size: face.blob.size }]),
      ...OWN_LOOK_SLOTS.flatMap((slot) => {
        const shot = items[slot.id];
        return shot ? [{ label: slot.label, size: shot.blob.size }] : [];
      }),
    ]);
    if (problem) {
      setError(problem);
      return;
    }
    const key = currentKey(face);
    const cached = cache.current.get(key);
    if (cached) {
      showSaved(key, cached);
      return;
    }
    stopLive();
    setBusy(true);
    setError("");
    scrollToStep("own-photo");
    try {
      const outcome = await takePreview({
        cache: cache.current,
        key,
        used: visit.used,
        allowance: visit.allowance,
        generate: async () => {
          const body = new FormData();
          attachSelfie(body, face, "selfie.jpg");
          body.set("slug", config.slug);
          body.set("sessionId", guestSessionId());
          const consentId = (await consent.persist()) || consent.consentId();
          if (consentId) body.set("consentId", consentId);
          body.set("requestId", crypto.randomUUID());
          body.set("makeup", chosen.id);
          for (const slot of OWN_LOOK_SLOTS) {
            const shot = items[slot.id];
            if (shot) body.set(slot.id, shot.blob, `${slot.id}.jpg`);
          }
          const res = await postPreview("/api/v1/bridal/own", body).catch((failure) => {
            if (failure?.data?.error === "VISIT_CAP") visit.applyBody(failure.data);
            throw failure;
          });
          visit.applyHeaders(res);
          const photoId = readPhotoId(res);
          if (photoId) setFace((current) => current && current.digest === face.digest ? { ...current, serverId: photoId } : current);
          const out = URL.createObjectURL(await res.blob());
          return { url: out, name: chosen.name, before: face.url, after: out };
        },
      });
      if ("blocked" in outcome && outcome.blocked) {
        setError(VISIT_CAP_MESSAGE);
        return;
      }
      if (outcome.result) showSaved(key, outcome.result);
    } catch (error) {
      setError(error instanceof Error ? error.message : "That preview did not finish.");
    } finally {
      setBusy(false);
    }
  }

  function chooseMakeupStyle(next: BridalStyleId) {
    setMakeupStyle(next);
    const shown = cardsForStyle(BRIDAL_MAKEUP, next);
    if (!shown.some((card) => card.id === makeupId) && shown[0]) setMakeupId(shown[0].id);
  }

  const itemNames = OWN_LOOK_SLOTS.filter((slot) => items[slot.id]).map((slot) => slot.label).join(", ") || "No extra pieces";
  const ownKey = face ? currentKey(face) : "";
  const ownButton = tryButton({
    ready: tryNowReady(Boolean(face), Boolean(chosen)),
    sameAsResult: Boolean(result && ownKey && ownKey === servedKey),
    atLimit: visit.atLimit,
    cached: Boolean(ownKey && cache.current.has(ownKey)),
  });
  const counter = tryCounterLabel(visit.used, visit.allowance);
  const capNote = ownButton.note ? `${ownButton.note}${visit.code ? `. Code ${visit.code}` : ""}` : "";

  useEffect(() => {
    if (!ownKey) return;
    const saved = cache.current.get(ownKey);
    if (!saved) return;
    setReveal(saved.after);
    setResult(saved);
    setServedKey((current) => current === ownKey ? current : ownKey);
  }, [ownKey]);

  return (
    <div data-own="flow" className="grid gap-4">
      <ConsentSheet open={consent.open} onAgree={() => void consent.agree()} onClose={consent.close} />
      <StepRail
        label="Your own look"
        current="own-makeup"
        steps={[
          { id: "own-makeup", label: "Makeup", icon: "makeup" },
          { id: "own-items", label: "Pieces", icon: "clothes" },
          { id: "own-photo", label: "Photo", icon: "photo" },
        ]}
      />
      <StepCard id="own-makeup" title="Makeup">
        {visibleStylePills(bridalStylesFor(BRIDAL_MAKEUP)).length > 0 ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Makeup style">
            {visibleStylePills(bridalStylesFor(BRIDAL_MAKEUP)).map((item) => (
              <button key={item.id} className="chip" type="button" aria-pressed={makeupStyle === item.id} onClick={() => chooseMakeupStyle(item.id)}>{item.label}</button>
            ))}
          </div>
        ) : null}
        <MakeupSwatches items={makeupCards} value={makeupId} onChange={setMakeupId} />
      </StepCard>
      <StepCard id="own-items" title="Add what you'll wear" hint="All optional. Close-up, one item per photo">
        <WearTiles
          slots={OWN_LOOK_SLOTS}
          shots={items}
          arm={consent.gate}
          onFile={(id, file) => addFile(id as OwnLookSlotId, file)}
          onRemove={(id) => removeItem(id as OwnLookSlotId)}
        />
      </StepCard>
      <section id="own-photo" className="step-card grid gap-3" data-step="selfie">
        <h3 className="text-base font-semibold leading-tight">Photo</h3>
        <SelectionSummary rows={[
          { id: "own-makeup", label: "Makeup", value: chosen?.name || "Makeup" },
          { id: "own-items", label: "Pieces", value: itemNames },
        ]} />
        {result && !busy ? <h3 className="text-center font-serif text-2xl">{result.name}</h3> : null}
        <PhotoBox
          large
          boxRef={(node) => { boxes.current.face = node; }}
          name="face"
          alt="Your selfie"
          shot={face}
          live={live === "face"}
          reveal={reveal}
          onLive={() => beginLive("face")}
          onUpload={() => openFile("face")}
          camera={live === "face" ? (
            <LiveStudio
              videoRef={videoRef}
              ready={camReady}
              facing="user"
              guide="face"
              zoom={zoom}
              onZoom={setZoom}
              onBack={stopLive}
              onClose={stopLive}
              onShutter={captureLive}
              onRetake={() => beginLive("face")}
              chrome="clean"
            />
          ) : null}
          loading={busy ? <GeneratingLook tool="bridal-own" blur={false} /> : null}
          liveLabel="Live makeup"
          trayReady={camReady}
          onShutter={() => void captureLive()}
          preview={result && !busy ? <BeforeAfter className="relative h-full w-full touch-none overflow-hidden bg-[#F3F0F8]" before={result.before} after={result.after} beforeLabel="Before" afterLabel="After" afterClassName="gen-reveal" /> : null}
        />
        <TryBar
          label={ownButton.label}
          enabled={ownButton.enabled}
          busy={busy}
          counter={counter}
          note={capNote}
          onClick={() => void generate()}
        />
        {camError ? <p className="text-sm" role="alert">{camError}</p> : null}
        {error && !busy ? <p className="rounded-lg border border-[#e9b4b4] bg-[#fdf1f1] p-2 text-sm text-[#7a1f1f]" role="alert" data-own-error="yes">{error}</p> : null}
      </section>
      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        accept="image/*"
        data-photo="own"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          addFile(fileTarget.current, file);
        }}
      />
    </div>
  );
}

function PhotoBox({
  boxRef,
  name,
  alt,
  shot,
  live,
  reveal,
  onLive,
  onUpload,
  camera,
  loading,
  liveLabel,
  large = false,
  preview = null,
  trayReady = false,
  onShutter,
}: {
  boxRef: (node: HTMLDivElement | null) => void;
  name: string;
  alt: string;
  shot?: Shot | null;
  live: boolean;
  reveal: string;
  onLive: () => void;
  onUpload: () => void;
  camera: ReactNode;
  loading?: ReactNode;
  liveLabel: string;
  large?: boolean;
  preview?: ReactNode;
  trayReady?: boolean;
  onShutter?: () => void;
}) {
  const body = live ? camera : preview ? preview : (
    <>
      {shot ? <img src={shot.url} alt={alt} className={large ? "absolute inset-0 h-full w-full object-cover" : "h-full w-full object-cover"} /> : null}
      {reveal ? <img src={reveal} alt="" className="gen-reveal absolute inset-0 h-full w-full object-cover" /> : null}
      {loading}
      {!shot && !loading && !reveal ? <p className={large ? "absolute inset-0 grid place-items-center px-6 text-center text-sm" : undefined}>{large ? "Face the light. No sunglasses." : "A clear photo of the piece."}</p> : null}
    </>
  );
  return (
    <div data-photo-cluster={large ? "yes" : undefined}>
      {large ? <LargeFrame boxRef={boxRef} name={name}>{body}</LargeFrame> : (
        <div ref={boxRef} data-photo-box={name} className={live ? "relative mx-auto aspect-[3/4] max-h-[280px] w-full max-w-sm overflow-hidden rounded-2xl bg-black" : "photo-slot mx-auto w-full max-w-sm"}>{body}</div>
      )}
      {live && large && onShutter ? <LiveTray ready={trayReady} onShutter={onShutter} /> : null}
      {loading || live ? null : (
        <div className="mt-2 grid w-full max-w-[28rem] gap-2" data-photo-actions="yes">
          <button className="btn sheen" type="button" onClick={onLive}>{liveLabel}</button>
          <button className="btn secondary" type="button" onClick={onUpload}>{large ? "Upload" : "Use photo"}</button>
        </div>
      )}
    </div>
  );
}
