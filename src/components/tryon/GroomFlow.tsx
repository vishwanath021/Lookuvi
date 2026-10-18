"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";
import { BeforeAfter } from "@/components/tryon/BeforeAfter";
import { ConsentSheet } from "@/components/tryon/ConsentSheet";
import { GeneratingLook } from "@/components/tryon/GeneratingLook";
import { LiveStudio } from "@/components/tryon/LiveStudio";
import { LargeFrame, LiveTray, SelectionSummary, StepCard, StepRail, TryBar, scrollToStep } from "@/components/tryon/LookStepper";
import { usePhotoConsent } from "@/components/tryon/usePhotoConsent";
import {
  GROOM_BEARDS,
  GROOM_GROOMING,
  GROOM_HAIR,
  GROOM_OWN_SLOTS,
  categoryPills,
  type GroomChoice,
  type GroomSlotId,
} from "@/data/groom";
import { captureShouldMirror, visiblePortraitCrop } from "@/lib/capture";
import { guestSessionId } from "@/lib/guest-session";
import type { SalonConfig } from "@/lib/salon";
import { tryNowReady } from "@/lib/try-now";
import { selectionKey, takePreview, tryButton, tryCounterLabel, VISIT_CAP_MESSAGE, type CachedLook } from "@/lib/visit-tries";
import { attachSelfie, readPhotoId, shotFromBlob } from "@/lib/visit-photo";
import { useVisitTries } from "@/components/tryon/useVisitTries";

type Shot = { blob: Blob; url: string; digest: string; serverId?: string };
type LookResult = CachedLook & { after: string; panel: Panel };
type Target = "face" | "own-face" | GroomSlotId;
type Panel = "looks" | "own";

function remember(current: Shot | undefined, next: Shot) {
  if (current && current.url.startsWith("blob:")) URL.revokeObjectURL(current.url);
  return next;
}

export function GroomFlow({ config }: { config: SalonConfig }) {
  const [panel, setPanel] = useState<Panel>("looks");
  const [hairId, setHairId] = useState(GROOM_HAIR[0]?.id || "");
  const [beardId, setBeardId] = useState("");
  const [groomingId, setGroomingId] = useState(GROOM_GROOMING[1]?.id || GROOM_GROOMING[0]?.id || "");
  const [face, setFace] = useState<Shot | null>(null);
  const [ownFace, setOwnFace] = useState<Shot | null>(null);
  const [items, setItems] = useState<Partial<Record<GroomSlotId, Shot>>>({});
  const [live, setLive] = useState<Target | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState("");
  const [result, setResult] = useState<LookResult | null>(null);
  const [served, setServed] = useState({ looks: "", own: "" });
  const looksCache = useRef(new Map<string, LookResult>());
  const ownCache = useRef(new Map<string, LookResult>());
  const visit = useVisitTries(config.slug);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileTarget = useRef<Target>("face");
  const boxes = useRef<Record<string, HTMLDivElement | null>>({});
  const consent = usePhotoConsent(config.slug, config.defaultLang || "en");
  const hairPills = categoryPills([] as { id: string; label: string }[]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

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
      const facing = target === "face" || target === "own-face" ? "user" : "environment";
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

  async function fileToShot(file: File) {
    const blob = file.slice(0, file.size, file.type || "image/jpeg");
    return shotFromBlob(blob);
  }

  function openFile(target: Target) {
    consent.gate(() => {
      fileTarget.current = target;
      fileRef.current?.click();
    });
  }

  function storeShot(target: Target, shot: Shot) {
    if (target === "face") {
      setFace((current) => remember(current || undefined, shot));
    } else if (target === "own-face") {
      setOwnFace((current) => remember(current || undefined, shot));
    } else {
      setItems((current) => ({ ...current, [target]: remember(current[target], shot) }));
    }
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
    const facing = live === "face" || live === "own-face" ? "user" : "environment";
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

  function itemKey() {
    return GROOM_OWN_SLOTS.map((slot) => `${slot.id}:${items[slot.id]?.digest || ""}`).join(",");
  }

  function previewKey(kind: Panel, shot: Shot) {
    return kind === "own"
      ? selectionKey(shot.digest, { items: itemKey() })
      : selectionKey(shot.digest, { hair: hairId, beard: beardId, grooming: groomingId });
  }

  function showSaved(kind: Panel, key: string, saved: LookResult) {
    setReveal(saved.after);
    setResult(saved);
    setServed((current) => ({ ...current, [kind]: key }));
  }

  async function generate(kind: Panel) {
    const shot = kind === "own" ? ownFace : face;
    if (busy || !shot) return;
    const key = previewKey(kind, shot);
    const cache = kind === "own" ? ownCache.current : looksCache.current;
    const cached = cache.get(key);
    if (cached) {
      showSaved(kind, key, cached);
      return;
    }
    stopLive();
    setBusy(true);
    setError("");
    scrollToStep(kind === "own" ? "groom-own-photo" : "groom-photo");
    try {
      const outcome = await takePreview({
        cache,
        key,
        used: visit.used,
        allowance: visit.allowance,
        generate: async () => {
          const body = new FormData();
          attachSelfie(body, shot, "selfie.jpg");
          body.set("slug", config.slug);
          body.set("sessionId", guestSessionId());
          const consentId = (await consent.persist()) || consent.consentId();
          if (consentId) body.set("consentId", consentId);
          body.set("requestId", crypto.randomUUID());
          if (kind === "looks") {
            if (hairId) body.set("hair", hairId);
            if (beardId) body.set("beard", beardId);
            if (groomingId) body.set("grooming", groomingId);
          } else {
            for (const slot of GROOM_OWN_SLOTS) {
              const item = items[slot.id];
              if (item) body.set(slot.id, item.blob, `${slot.id}.jpg`);
            }
          }
          const res = await fetch("/api/v1/groom", { method: "POST", body });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.error === "VISIT_CAP") visit.applyBody(data);
            throw new Error(data.message || "That preview did not finish.");
          }
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("json")) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || "That preview did not finish.");
          }
          visit.applyHeaders(res);
          const photoId = readPhotoId(res);
          if (photoId) {
            const mark = (current: Shot | null) => current && current.digest === shot.digest ? { ...current, serverId: photoId } : current;
            if (kind === "own") setOwnFace(mark);
            else setFace(mark);
          }
          const out = URL.createObjectURL(await res.blob());
          const name = kind === "own" ? "Your own look" : GROOM_HAIR.find((item) => item.id === hairId)?.name || "Groom look";
          return { url: out, name, before: shot.url, after: out, panel: kind };
        },
      });
      if ("blocked" in outcome && outcome.blocked) {
        setError(VISIT_CAP_MESSAGE);
        return;
      }
      if (outcome.result) showSaved(kind, key, outcome.result);
    } catch (error) {
      setError(error instanceof Error ? error.message : "That preview did not finish.");
    } finally {
      setBusy(false);
    }
  }

  function chipRow(id: string, title: string, hint: string, group: string, choices: GroomChoice[], value: string, onChange: (id: string) => void) {
    return (
      <StepCard id={id} title={title} hint={hint}>
        {hairPills.length > 1 ? (
          <div className="flex flex-wrap gap-2" data-pills="category" role="group" aria-label={`${group} category`} />
        ) : null}
        <div className="flex flex-wrap gap-2" role="group" aria-label={group}>
          {choices.map((item) => (
            <button key={item.id} className="chip" type="button" aria-pressed={value === item.id} onClick={() => onChange(value === item.id ? "" : item.id)}>{item.name}</button>
          ))}
        </div>
      </StepCard>
    );
  }

  const shotFor = (target: Target) => {
    if (target === "face") return face;
    if (target === "own-face") return ownFace;
    return items[target];
  };
  const looksKey = face ? selectionKey(face.digest, { hair: hairId, beard: beardId, grooming: groomingId }) : "";
  const ownKey = ownFace ? selectionKey(ownFace.digest, { items: itemKey() }) : "";
  const looksButton = tryButton({
    ready: tryNowReady(Boolean(face), true),
    sameAsResult: Boolean(result?.panel === "looks" && looksKey && looksKey === served.looks),
    atLimit: visit.atLimit,
    cached: Boolean(looksKey && looksCache.current.has(looksKey)),
  });
  const ownButton = tryButton({
    ready: tryNowReady(Boolean(ownFace), true),
    sameAsResult: Boolean(result?.panel === "own" && ownKey && ownKey === served.own),
    atLimit: visit.atLimit,
    cached: Boolean(ownKey && ownCache.current.has(ownKey)),
  });
  const counter = tryCounterLabel(visit.used, visit.allowance);
  const capNote = (text: string) => text ? `${text}${visit.code ? `. Code ${visit.code}` : ""}` : "";

  useEffect(() => {
    if (panel !== "looks" || !looksKey) return;
    const saved = looksCache.current.get(looksKey);
    if (!saved) return;
    setReveal(saved.after);
    setResult(saved);
    setServed((current) => current.looks === looksKey ? current : { ...current, looks: looksKey });
  }, [panel, looksKey]);

  useEffect(() => {
    if (panel !== "own" || !ownKey) return;
    const saved = ownCache.current.get(ownKey);
    if (!saved) return;
    setReveal(saved.after);
    setResult(saved);
    setServed((current) => current.own === ownKey ? current : { ...current, own: ownKey });
  }, [panel, ownKey]);

  return (
    <div data-groom="flow" className="grid gap-4">
      <ConsentSheet open={consent.open} onAgree={() => void consent.agree()} onClose={consent.close} />
      <h2 className="page-title">Groom</h2>
      <p className="text-sm text-muted">Wedding hair, a neat beard, and natural skin. Or dress him in his own clothes.</p>
      <div className="seg" role="tablist" aria-label="Groom">
        <button className="seg-btn" type="button" role="tab" aria-selected={panel === "looks"} onClick={() => setPanel("looks")}>Looks</button>
        <button className="seg-btn" type="button" role="tab" aria-selected={panel === "own"} onClick={() => setPanel("own")}>Your own look</button>
      </div>

      <div className={panel === "looks" ? "grid gap-4" : "hidden"} data-panel="looks">
          <StepRail
            label="Groom steps"
            current="groom-hair"
            steps={[
              { id: "groom-hair", label: "Hair", icon: "hair" },
              { id: "groom-beard", label: "Beard", icon: "beard" },
              { id: "groom-grooming", label: "Grooming", icon: "groom" },
              { id: "groom-photo", label: "Photo", icon: "photo" },
            ]}
          />
          {chipRow("groom-hair", "Hair", "Optional. Tap again to keep his hair.", "Hair", GROOM_HAIR, hairId, setHairId)}
          {chipRow("groom-beard", "Beard", "Optional. Tap again to keep his beard.", "Beard", GROOM_BEARDS, beardId, setBeardId)}
          {chipRow("groom-grooming", "Grooming", "Facial glow, or leave the skin natural.", "Grooming", GROOM_GROOMING, groomingId, setGroomingId)}
          <section id="groom-photo" className="step-card grid gap-3" data-step="photo">
            <h3 className="text-base font-semibold leading-tight">Photo</h3>
            <SelectionSummary rows={[
              { id: "groom-hair", label: "Hair", value: GROOM_HAIR.find((item) => item.id === hairId)?.name || "Keep his hair" },
              { id: "groom-beard", label: "Beard", value: GROOM_BEARDS.find((item) => item.id === beardId)?.name || "Keep his beard" },
              { id: "groom-grooming", label: "Grooming", value: GROOM_GROOMING.find((item) => item.id === groomingId)?.name || "Natural skin" },
            ]} />
            {result?.panel === "looks" && !busy && panel === "looks" ? <h3 className="text-center font-serif text-2xl">{result.name}</h3> : null}
            <PhotoStep
              title=""
              target="face"
              shot={face}
              live={live}
              reveal={panel === "looks" ? reveal : ""}
              busy={busy && panel === "looks"}
              camReady={camReady}
              zoom={zoom}
              videoRef={videoRef}
              boxRef={(node) => { boxes.current.face = node; }}
              onZoom={setZoom}
              onLive={() => beginLive("face")}
              onUpload={() => openFile("face")}
              onClose={stopLive}
              onShutter={captureLive}
              large
              preview={result?.panel === "looks" && !busy && panel === "looks" ? <BeforeAfter className="relative h-full w-full touch-none overflow-hidden bg-[#F3F0F8]" before={result.before} after={result.after} beforeLabel="Before" afterLabel="After" afterClassName="gen-reveal" /> : null}
            />
            <TryBar
              label={looksButton.label}
              enabled={looksButton.enabled}
              busy={busy}
              counter={counter}
              note={capNote(looksButton.note)}
              onClick={() => void generate("looks")}
            />
          </section>
        </div>
      <div data-own="flow" className={panel === "own" ? "grid gap-4" : "hidden"}>
          <StepRail
            label="Own look steps"
            current="groom-clothes"
            steps={[
              { id: "groom-clothes", label: "Clothes", icon: "clothes" },
              { id: "groom-own-photo", label: "Photo", icon: "photo" },
            ]}
          />
          <StepCard id="groom-clothes" title="Clothes" hint="Optional. Take a close-up of each piece on its own. These photos are deleted after the preview and are never published.">
            <p className="text-sm text-muted">Take a close-up of each piece on its own.</p>
            <div className="grid gap-4">
              {GROOM_OWN_SLOTS.map((slot) => (
                <div key={slot.id} data-item={slot.id}>
                  <p className="mb-2 text-sm font-medium">{slot.label}</p>
                  <p className="mb-2 text-sm text-muted">Close-up of the piece, on its own.</p>
                  <PhotoStep
                    title=""
                    target={slot.id}
                    shot={items[slot.id]}
                    live={live}
                    reveal=""
                    busy={false}
                    camReady={camReady}
                    zoom={zoom}
                    videoRef={videoRef}
                    boxRef={(node) => { boxes.current[slot.id] = node; }}
                    onZoom={setZoom}
                    onLive={() => beginLive(slot.id)}
                    onUpload={() => openFile(slot.id)}
                    onClose={stopLive}
                    onShutter={captureLive}
                  />
                </div>
              ))}
            </div>
          </StepCard>
          <section id="groom-own-photo" className="step-card grid gap-3" data-step="own-photo">
            <h3 className="text-base font-semibold leading-tight">Photo</h3>
            <SelectionSummary rows={[
              { id: "groom-clothes", label: "Clothes", value: GROOM_OWN_SLOTS.filter((slot) => items[slot.id]).map((slot) => slot.label).join(", ") || "No extra pieces" },
              { id: "groom-own-photo", label: "Photo", value: ownFace ? "Selfie added" : "Add a selfie" },
            ]} />
            {result?.panel === "own" && !busy && panel === "own" ? <h3 className="text-center font-serif text-2xl">{result.name}</h3> : null}
            <PhotoStep
              title=""
              target="own-face"
              shot={ownFace}
              live={live}
              reveal={panel === "own" ? reveal : ""}
              busy={busy && panel === "own"}
              camReady={camReady}
              zoom={zoom}
              videoRef={videoRef}
              boxRef={(node) => { boxes.current["own-face"] = node; }}
              onZoom={setZoom}
              onLive={() => beginLive("own-face")}
              onUpload={() => openFile("own-face")}
              onClose={stopLive}
              onShutter={captureLive}
              large
              preview={result?.panel === "own" && !busy && panel === "own" ? <BeforeAfter className="relative h-full w-full touch-none overflow-hidden bg-[#F3F0F8]" before={result.before} after={result.after} beforeLabel="Before" afterLabel="After" afterClassName="gen-reveal" /> : null}
            />
            <TryBar
              label={ownButton.label}
              enabled={ownButton.enabled}
              busy={busy}
              counter={counter}
              note={capNote(ownButton.note)}
              onClick={() => void generate("own")}
            />
          </section>
        </div>

      {camError ? <p className="text-sm" role="alert">{camError}</p> : null}
      {error ? <p className="text-sm" role="status">{error}</p> : null}
      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        accept="image/*"
        data-photo="groom"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const target = fileTarget.current;
          void fileToShot(file).then((shot) => storeShot(target, shot));
        }}
      />
      <span className="sr-only" data-shot={shotFor(live || "face") ? "yes" : "no"} />
    </div>
  );
}

function PhotoStep({
  title,
  target,
  shot,
  live,
  reveal,
  busy,
  camReady,
  zoom,
  videoRef,
  boxRef,
  onZoom,
  onLive,
  onUpload,
  onClose,
  onShutter,
  large = false,
  preview = null,
}: {
  title: string;
  target: Target;
  shot?: Shot | null;
  live: Target | null;
  reveal: string;
  busy: boolean;
  camReady: boolean;
  zoom: number;
  videoRef: RefObject<HTMLVideoElement | null>;
  boxRef: (node: HTMLDivElement | null) => void;
  onZoom: (zoom: number) => void;
  onLive: () => void;
  onUpload: () => void;
  onClose: () => void;
  onShutter: () => void;
  large?: boolean;
  preview?: ReactNode;
}) {
  const open = live === target;
  const faceTarget = target === "face" || target === "own-face";
  const loading: ReactNode = busy ? <GeneratingLook tool={target === "face" ? "groom" : "groom-own"} blur={false} /> : null;
  const frame = open ? (
    <LiveStudio
      videoRef={videoRef}
      ready={camReady}
      facing={faceTarget ? "user" : "environment"}
      guide={faceTarget ? "face" : "hand"}
      zoom={zoom}
      onZoom={onZoom}
      onBack={onClose}
      onClose={onClose}
      onShutter={onShutter}
      onRetake={onLive}
      chrome={large ? "clean" : "overlay"}
    />
  ) : preview ? preview : (
    <>
      {shot ? <img src={shot.url} alt={title || "Your selfie"} className={large ? "absolute inset-0 h-full w-full object-cover" : "h-full w-full object-cover"} /> : null}
      {reveal ? <img src={reveal} alt="" className="gen-reveal absolute inset-0 h-full w-full object-cover" /> : null}
      {loading}
      {!shot && !busy && !reveal ? <p className={large ? "absolute inset-0 grid place-items-center px-6 text-center text-sm" : undefined}>{faceTarget ? "Face the light. No sunglasses." : "A clear photo of the piece."}</p> : null}
    </>
  );
  return (
    <div data-photo-cluster="yes">
      {title ? <p className="mb-2 text-sm font-medium">{title}</p> : null}
      {large ? <LargeFrame boxRef={boxRef} name={target}>{frame}</LargeFrame> : (
        <div ref={boxRef} data-photo-box={target} className={open ? "relative mx-auto aspect-[3/4] max-h-[280px] w-full max-w-sm overflow-hidden rounded-2xl bg-black" : "photo-slot mx-auto w-full max-w-sm"}>{frame}</div>
      )}
      {open && large ? <LiveTray ready={camReady} onShutter={() => void onShutter()} /> : null}
      {busy || open ? null : (
        <div className="grid w-full max-w-[28rem] gap-2" data-photo-actions="yes">
          <button className="btn sheen" type="button" onClick={onLive}>{faceTarget ? "Take selfie" : "Take photo"}</button>
          <button className="btn secondary" type="button" onClick={onUpload}>{faceTarget ? "Upload" : "Use photo"}</button>
        </div>
      )}
    </div>
  );
}
