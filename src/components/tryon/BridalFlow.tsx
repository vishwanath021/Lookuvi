"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { BeforeAfter } from "@/components/tryon/BeforeAfter";
import { alignGeneratedPhoto } from "@/lib/face/align-client";
import { BridalOwnLook } from "@/components/tryon/BridalOwnLook";
import { BridalLookCard } from "@/components/tryon/BridalLookCard";
import { ConsentSheet } from "@/components/tryon/ConsentSheet";
import { GeneratingLook } from "@/components/tryon/GeneratingLook";
import { LiveStudio } from "@/components/tryon/LiveStudio";
import { LookResultActions, PhotoActions, ResultZoom } from "@/components/tryon/LookResultActions";
import { CropPhotoButton } from "@/components/tryon/PhotoCrop";
import { LargeFrame, LiveTray, MakeupSwatches, SelectionSummary, StepCard, StepRail, TryBar, scrollToStep } from "@/components/tryon/LookStepper";
import { SavedMarks } from "@/components/tryon/SavedMarks";
import { useVisitTries } from "@/components/tryon/useVisitTries";
import { MakeupStage } from "@/components/tryon/MakeupStage";
import { usePhotoConsent } from "@/components/tryon/usePhotoConsent";
import { captureShouldMirror, visiblePortraitCrop } from "@/lib/capture";
import {
  BRIDAL_EVENTS,
  BRIDAL_FINISHES,
  BRIDAL_HAIR,
  BRIDAL_LOOKS,
  BRIDAL_LIPS,
  BRIDAL_MAKEUP,
  MEHENDI_CARDS,
  MEHENDI_STYLES,
  bridalEventById,
  bridalStylesFor,
  visibleStylePills,
  cardsForStyle,
  defaultBridalStyle,
  looksForEvent,
  type BridalEventId,
  type BridalStyleId,
} from "@/data/bridal";
import { AtSalonNote, useAtSalon } from "@/components/guest/AtSalonNote";
import { LockedPhotoNote } from "@/components/guest/LockedPhotoNote";
import { showLockedBrowse } from "@/lib/at-salon-browse";
import { guestDeviceId } from "@/lib/device-id";
import { guestSessionId } from "@/lib/guest-session";
import { postGuestGenerate } from "@/lib/guest-preview";
import type { SalonConfig } from "@/lib/salon";
import { tryNowReady } from "@/lib/try-now";
import { rememberGenerated, readGenerated } from "@/lib/generated-session";
import { selectionKey, takePreview, tryButton, tryCounterLabel, VISIT_CAP_MESSAGE, type CachedLook } from "@/lib/visit-tries";
import { isPastKolkataDay, kolkataDayKey, PAST_DATE_MESSAGE } from "@/lib/queue/day";
import { attachSelfie, readPhotoId, shotFromBlob } from "@/lib/visit-photo";
import { BRIDAL_TRIAL_SENT } from "@/lib/whatsapp";

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.5 8s2.4-3.5 6.5-3.5S14.5 8 14.5 8 12.1 11.5 8 11.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
    </svg>
  );
}

function LashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 10.5c2-3 4-4.2 6-4.2s4 1.2 6 4.2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M4 9.2 3.2 6.4M8 8.2V5.2M12 9.2l.8-2.8" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function BlushIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="5" cy="8.5" r="2.2" fill="currentColor" opacity="0.9" />
      <circle cx="11" cy="8.5" r="2.2" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

function BrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 9.5c1.6-2.4 3.2-3.2 4.6-2.4 1.2.7 2.2.2 3.4-1.4C11.2 4.2 12.6 4 14 5.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

type SavedLook = {
  id: string;
  lookId: string;
  name: string;
  eventId: string;
  before: string;
  after: string;
  share: string;
  kind: "look" | "mehendi";
};

type Shot = { blob: Blob; url: string; digest: string; serverId?: string };
type LookResult = CachedLook & { after: string; share: string; lookId: string; kind: "look" | "mehendi" };

const lookCaches = new Map<string, Map<string, LookResult>>();

function sharedLookCache(slug: string, kind: string) {
  const id = `${slug}:${kind}`;
  let map = lookCaches.get(id);
  if (!map) {
    map = new Map();
    lookCaches.set(id, map);
  }
  return map;
}

function generatedKey(slug: string) {
  return `lookuvi-generated:${slug}`;
}

function resultFromStored(slug: string): LookResult | null {
  const saved = readGenerated(generatedKey(slug))[0];
  if (!saved) return null;
  const kind = saved.kind === "mehendi" ? "mehendi" : "look";
  return {
    url: saved.after,
    name: saved.name,
    before: saved.before,
    after: saved.after,
    share: saved.share || "",
    lookId: saved.lookId || "",
    kind,
  };
}

const MAX_SAVED = 6;

export function compareControl(open: boolean) {
  return {
    label: open ? "Hide compare" : "Compare",
    className: open ? "btn sheen" : "btn secondary",
    pressed: open,
  };
}

function storageKey(slug: string) {
  return `lookuvi-bridal-${slug}`;
}

function readSaved(slug: string): SavedLook[] {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    const parsed = raw ? JSON.parse(raw) as SavedLook[] : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_SAVED) : [];
  } catch {
    return [];
  }
}

function writeSaved(slug: string, looks: SavedLook[]) {
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(looks.slice(0, MAX_SAVED)));
  } catch {
    // The phone may refuse a large photo. The looks still stay on this screen.
  }
}

async function blobUrlToData(url: string) {
  const blob = await fetch(url).then((res) => res.blob());
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(blob);
  });
}

export function BridalFlow({ config }: { config: SalonConfig }) {
  const atSalon = useAtSalon();
  const locked = showLockedBrowse(Boolean(config.tryOnsAtSalon), atSalon);
  const [eventId, setEventId] = useState<BridalEventId>("wedding");
  const [panel, setPanel] = useState<"looks" | "own" | "mehendi" | "saved">("looks");
  const [lookStyle, setLookStyle] = useState<BridalStyleId>(defaultBridalStyle(BRIDAL_LOOKS));
  const [makeupStyle, setMakeupStyle] = useState<BridalStyleId>(defaultBridalStyle(BRIDAL_MAKEUP));
  const [hairStyle, setHairStyle] = useState<BridalStyleId>(defaultBridalStyle(BRIDAL_HAIR));
  const [mehendiCategory, setMehendiCategory] = useState<BridalStyleId>(defaultBridalStyle(MEHENDI_CARDS));
  const [lookId, setLookId] = useState(looksForEvent("wedding")[0]?.id || "");
  const [makeupId, setMakeupId] = useState("makeup-soft-rose");
  const [hairId, setHairId] = useState("");
  const [finishId, setFinishId] = useState("hd");
  const [lipId, setLipId] = useState("red");
  const [face, setFace] = useState<Shot | null>(null);
  const [hand, setHand] = useState<Shot | null>(null);
  const [mehendiCardId, setMehendiCardId] = useState("mehendi-bridal");
  const [mehendiStyle, setMehendiStyle] = useState("bridal");
  const [coverage, setCoverage] = useState("full");
  const [mehendiShade, setMehendiShade] = useState("maroon");
  const [density, setDensity] = useState("heavy");
  const [busy, setBusy] = useState(false);
  const [busyKind, setBusyKind] = useState<null | "look" | "mehendi">(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<LookResult | null>(() => resultFromStored(config.slug));
  const [saved, setSaved] = useState<SavedLook[]>([]);
  const [gone, setGone] = useState<SavedLook[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [bookNote, setBookNote] = useState("");
  const resultRef = useRef<HTMLElement>(null);
  const bridalFile = useRef<HTMLInputElement>(null);
  const mehendiFile = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceBox = useRef<HTMLDivElement>(null);
  const handBox = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const consent = usePhotoConsent(config.slug, config.defaultLang || "en");
  const [kajal, setKajal] = useState(true);
  const [lashes, setLashes] = useState(true);
  const [blushOn, setBlushOn] = useState(true);
  const [browOn, setBrowOn] = useState(true);
  const [live, setLive] = useState<null | "face" | "hand">(null);
  const [camReady, setCamReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [camError, setCamError] = useState("");
  const [liveLook, setLiveLook] = useState(false);
  const [activeStep, setActiveStep] = useState("bridal-event");
  const picksRef = useRef<HTMLDivElement>(null);
  const [served, setServed] = useState({ look: "", mehendi: "" });
  const lookCache = useRef(sharedLookCache(config.slug, "look"));
  const mehendiCache = useRef(sharedLookCache(config.slug, "mehendi"));
  const visit = useVisitTries(config.slug);
  const eventLooks = looksForEvent(eventId);
  const looks = cardsForStyle(eventLooks, lookStyle);
  const makeupCards = cardsForStyle(BRIDAL_MAKEUP, makeupStyle);
  const hairCards = cardsForStyle(BRIDAL_HAIR, hairStyle);
  const mehendiCards = cardsForStyle(MEHENDI_CARDS, mehendiCategory);
  const chosen = looks.find((look) => look.id === lookId) || looks[0];

  useEffect(() => {
    setSaved(readSaved(config.slug));
  }, [config.slug]);

  useEffect(() => {
    if (!result || busy) return;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    let cancel = false;
    void (async () => {
      const after = result.after.startsWith("data:") ? result.after : await blobUrlToData(result.after).catch(() => "");
      const before = result.before.startsWith("data:") ? result.before : await blobUrlToData(result.before).catch(() => "");
      if (cancel || !after.startsWith("data:")) return;
      rememberGenerated(generatedKey(config.slug), {
        id: `${result.kind}:${result.lookId}:${result.name}`,
        name: result.name,
        before,
        after,
        kind: result.kind,
        lookId: result.lookId,
        share: result.share,
      });
    })();
    return () => {
      cancel = true;
    };
  }, [result, busy, config.slug]);

  async function fileToShot(file: File) {
    const blob = file.slice(0, file.size, file.type || "image/jpeg");
    return shotFromBlob(blob);
  }

  function showSaved(kind: "look" | "mehendi", key: string, saved: LookResult) {
    setResult(saved);
    setServed((current) => ({ ...current, [kind]: key }));
  }

  async function generate(kind: "look" | "mehendi", shot: Shot, overrides?: { finishId?: string; lipId?: string; makeupId?: string; hairId?: string }) {
    if (busy) return;
    if (atSalon.required && !atSalon.unlocked) return;
    const finish = overrides?.finishId || finishId;
    const lip = overrides?.lipId || lipId;
    const makeup = overrides?.makeupId ?? makeupId;
    const hair = overrides?.hairId ?? hairId;
    const key = kind === "mehendi"
      ? selectionKey(shot.digest, { card: mehendiCardId, style: mehendiStyle, coverage, shade: mehendiShade, density })
      : selectionKey(shot.digest, {
        event: eventId,
        look: chosen?.id || "",
        hair,
        makeup,
        finish,
        lip,
        kajal: kajal ? "1" : "0",
        lashes: lashes ? "1" : "0",
        blush: blushOn ? "1" : "0",
        brow: browOn ? "1" : "0",
      });
    const cache = kind === "mehendi" ? mehendiCache.current : lookCache.current;
    const cached = cache.get(key);
    if (cached) {
      showSaved(kind, key, cached);
      return;
    }
    setBusy(true);
    setBusyKind(kind);
    setError("");
    (kind === "mehendi" ? handBox : faceBox).current?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const outcome = await takePreview({
        cache,
        key,
        used: visit.used,
        allowance: visit.allowance,
        generate: async () => {
          const body = new FormData();
          attachSelfie(body, shot, kind === "mehendi" ? "hand.jpg" : "selfie.jpg");
          body.set("slug", config.slug);
          body.set("sessionId", guestSessionId());
          body.set("deviceId", guestDeviceId());
          const consentId = (await consent.persist()) || consent.consentId();
          if (consentId) body.set("consentId", consentId);
          const requestId = crypto.randomUUID();
          body.set("requestId", requestId);
          body.set("tool", kind === "mehendi" ? "mehendi" : "bridal");
          if (kind === "mehendi") {
            body.set("styleId", mehendiStyle);
            body.set("mehendiCard", mehendiCardId);
            body.set("mehendiStyle", mehendiStyle);
            body.set("coverage", coverage);
            body.set("mehendiShade", mehendiShade);
            body.set("density", density);
          } else if (chosen) {
            body.set("styleId", chosen.id);
            body.set("finish", finish);
            body.set("lip", lip);
            if (makeup) body.set("makeup", makeup);
            if (hair) body.set("hair", hair);
            body.set("kajal", kajal ? "1" : "0");
            body.set("lashes", lashes ? "1" : "0");
            body.set("blush", blushOn ? "1" : "0");
            body.set("browTint", browOn ? "1" : "0");
          }
          const res = await postGuestGenerate({ slug: config.slug, body, requestId });
          const data = res.ok ? null : await res.json().catch(() => ({}));
          if (!res.ok) {
            if (data?.error === "VISIT_CAP") visit.applyBody(data);
            throw new Error(data?.message || "That preview did not finish.");
          }
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("json")) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload.message || "That preview did not finish.");
          }
          visit.applyHeaders(res);
          const photoId = readPhotoId(res);
          if (photoId) {
            const mark = (current: Shot | null) => current && current.digest === shot.digest ? { ...current, serverId: photoId } : current;
            if (kind === "mehendi") setHand(mark);
            else setFace(mark);
          }
          const raw = await res.blob();
          const reason = res.headers.get("x-demo-reason") || "";
          const sample = reason === "no-key" || reason === "spend-cap" || reason === "failover" || reason === "placement";
          // Same as the everyday tab: warp the provider image onto the selfie frame so the
          // before/after slider lines up eye to eye and the face sits centred in the frame.
          const aligned = kind === "look" && !sample
            ? (await alignGeneratedPhoto(shot.blob, raw, false).catch(() => null))?.blob || raw
            : raw;
          const out = URL.createObjectURL(aligned);
          const styleName = kind === "mehendi"
            ? `Mehendi · ${MEHENDI_STYLES.find((item) => item.id === mehendiStyle)?.label || "Bridal"}`
            : chosen?.name || "Bridal look";
          return {
            url: out,
            name: styleName,
            before: shot.url,
            after: out,
            share: res.headers.get("x-look-share") || "",
            lookId: kind === "mehendi" ? mehendiStyle : chosen?.id || "",
            kind,
          };
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
      setBusyKind(null);
    }
  }

  function currentSaved() {
    if (!result) return undefined;
    return saved.find((item) => item.lookId === result.lookId && item.kind === result.kind);
  }

  async function saveCurrent() {
    if (!result) return;
    const existing = currentSaved();
    if (existing) {
      const next = saved.filter((item) => item.id !== existing.id);
      setSaved(next);
      writeSaved(config.slug, next);
      setGone((current) => [existing, ...current.filter((item) => item.id !== existing.id)]);
      return;
    }
    const after = result.after.startsWith("data:") ? result.after : await blobUrlToData(result.after).catch(() => result.after);
    const before = result.before.startsWith("data:") ? result.before : await blobUrlToData(result.before).catch(() => result.before);
    const next: SavedLook = {
      id: crypto.randomUUID(),
      lookId: result.lookId,
      name: result.name,
      eventId,
      before,
      after,
      share: result.share,
      kind: result.kind,
    };
    const trimmed = [next, ...saved.filter((item) => item.lookId !== next.lookId || item.kind !== next.kind)].slice(0, MAX_SAVED);
    setSaved(trimmed);
    writeSaved(config.slug, trimmed);
    setGone((current) => current.filter((item) => item.lookId !== next.lookId || item.kind !== next.kind));
    setPanel("saved");
  }

  function restoreLook(look: SavedLook) {
    const trimmed = [look, ...saved.filter((item) => item.id !== look.id)].slice(0, MAX_SAVED);
    setSaved(trimmed);
    writeSaved(config.slug, trimmed);
    setGone((current) => current.filter((item) => item.id !== look.id));
  }

  function removeLook(look: SavedLook) {
    const next = saved.filter((item) => item.id !== look.id);
    setSaved(next);
    writeSaved(config.slug, next);
    setGone((current) => [look, ...current.filter((item) => item.id !== look.id)]);
  }

  function toggleCompare(id: string) {
    setCompare((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) return [current[1], id];
      return [...current, id];
    });
  }

  function share(look: SavedLook) {
    const text = look.share
      ? `Look at this bridal look: ${look.name}. ${look.share}`
      : `Look at this bridal look: ${look.name}.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function replaceShot(kind: "face" | "hand", blob: Blob) {
    const shot = await shotFromBlob(blob);
    const drop = (current: Shot | null) => {
      if (current?.url.startsWith("blob:")) URL.revokeObjectURL(current.url);
      return shot;
    };
    if (kind === "face") {
      setFace(drop);
      setResult((current) => (current?.kind === "look" ? null : current));
      return;
    }
    setHand(drop);
    setResult((current) => (current?.kind === "mehendi" ? null : current));
  }

  async function book() {
    setBookNote("");
    if (isPastKolkataDay(eventDate)) {
      setBookNote(PAST_DATE_MESSAGE);
      return;
    }
    const picked = saved.filter((item) => item.kind === "look");
    const lookIds = picked.length ? [...new Set(picked.map((item) => item.lookId))] : result?.kind === "look" ? [result.lookId] : chosen ? [chosen.id] : [];
    const lookUrls = picked.map((item) => item.share).filter(Boolean);
    if (result?.share && !lookUrls.includes(result.share)) lookUrls.push(result.share);
    const res = await fetch("/api/v1/bridal/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: config.slug,
        sessionId: guestSessionId(),
        name,
        eventId,
        eventDate,
        lookIds: lookIds.slice(0, 6),
        lookUrls: lookUrls.slice(0, 6),
        lang: config.defaultLang || "en",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.whatsappUrl) {
      setBookNote(data.message || "This salon has not added a WhatsApp number yet.");
      return;
    }
    window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
    setBookNote(BRIDAL_TRIAL_SENT);
  }

  const compared = compare.map((id) => saved.find((item) => item.id === id)).filter((item) => item !== undefined);
  const event = bridalEventById(eventId);

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

  function beginLive(kind: "face" | "hand", makeup = false) {
    setLiveLook(kind === "face" && makeup);
    consent.gate(() => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const devices = navigator.mediaDevices;
      if (!devices?.getUserMedia) {
        setCamError("The camera is not available. You can use a photo instead.");
        return;
      }
      const pending = devices.getUserMedia({
        video: { facingMode: kind === "hand" ? { ideal: "environment" } : "user" },
      });
      flushSync(() => {
        setCamError("");
        setCamReady(false);
        setZoom(1);
        setLive(kind);
      });
      (kind === "hand" ? handBox : faceBox).current?.scrollIntoView({ block: "center" });
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
        setCamError("Camera permission was denied. Allow the camera for this site from the address bar, then press Live capture again.");
      });
    });
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
    if (captureShouldMirror(live === "hand" ? "environment" : "user")) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return;
    const shot = await shotFromBlob(blob);
    const kind = live;
    stopLive();
    if (kind === "hand") {
      setHand(shot);
      setResult((current) => (current?.kind === "mehendi" ? null : current));
    } else {
      setFace(shot);
      setResult((current) => (current?.kind === "look" ? null : current));
    }
  }

  function pickMakeup(id: string) {
    setActiveStep("bridal-makeup");
    const card = BRIDAL_MAKEUP.find((item) => item.id === id);
    if (!card) return;
    setMakeupId(card.id);
    setLipId(card.lipId);
    setFinishId(card.finishId);
  }

  function pickHair(id: string) {
    setActiveStep("bridal-hair");
    setHairId(hairId === id ? "" : id);
  }

  function pickMehendi(id: string) {
    const card = MEHENDI_CARDS.find((item) => item.id === id);
    if (!card) return;
    setMehendiCardId(card.id);
    setMehendiStyle(card.styleId);
    setCoverage(card.coverageId);
    setMehendiShade(card.shadeId);
    setDensity(card.densityId);
  }

  function chooseLookStyle(next: BridalStyleId) {
    setActiveStep("bridal-look");
    setLookStyle(next);
    const shown = cardsForStyle(looksForEvent(eventId), next);
    if (!shown.some((look) => look.id === lookId)) setLookId(shown[0]?.id || "");
  }

  function chooseMakeupStyle(next: BridalStyleId) {
    setActiveStep("bridal-makeup");
    setMakeupStyle(next);
    const shown = cardsForStyle(BRIDAL_MAKEUP, next);
    if (!shown.some((card) => card.id === makeupId) && shown[0]) pickMakeup(shown[0].id);
  }

  function chooseHairStyle(next: BridalStyleId) {
    setActiveStep("bridal-hair");
    setHairStyle(next);
    const shown = cardsForStyle(BRIDAL_HAIR, next);
    if (hairId && !shown.some((card) => card.id === hairId)) pickHair(hairId);
  }

  function chooseMehendiCategory(next: BridalStyleId) {
    setMehendiCategory(next);
    const shown = cardsForStyle(MEHENDI_CARDS, next);
    if (!shown.some((card) => card.id === mehendiCardId) && shown[0]) pickMehendi(shown[0].id);
  }

  const lipHex = BRIDAL_LIPS.find((item) => item.id === lipId)?.hex || "#9B2335";
  const makeupName = BRIDAL_MAKEUP.find((item) => item.id === makeupId)?.name || "Makeup";
  const hairName = BRIDAL_HAIR.find((item) => item.id === hairId)?.name || "The look’s own hair";
  const lookReady = tryNowReady(Boolean(face), Boolean(chosen));
  const mehendiReady = tryNowReady(Boolean(hand), Boolean(mehendiCardId));
  const lookKey = face ? selectionKey(face.digest, {
    event: eventId,
    look: chosen?.id || "",
    hair: hairId,
    makeup: makeupId,
    finish: finishId,
    lip: lipId,
    kajal: kajal ? "1" : "0",
    lashes: lashes ? "1" : "0",
    blush: blushOn ? "1" : "0",
    brow: browOn ? "1" : "0",
  }) : "";
  const mehendiKey = hand ? selectionKey(hand.digest, {
    card: mehendiCardId,
    style: mehendiStyle,
    coverage,
    shade: mehendiShade,
    density,
  }) : "";
  const lookButton = tryButton({
    ready: lookReady,
    sameAsResult: Boolean(result?.kind === "look" && lookKey && lookKey === served.look),
    atLimit: visit.atLimit,
    cached: Boolean(lookKey && lookCache.current.has(lookKey)),
  });
  const mehendiButton = tryButton({
    ready: mehendiReady,
    sameAsResult: Boolean(result?.kind === "mehendi" && mehendiKey && mehendiKey === served.mehendi),
    atLimit: visit.atLimit,
    cached: Boolean(mehendiKey && mehendiCache.current.has(mehendiKey)),
  });
  const counter = tryCounterLabel(visit.used, visit.allowance);
  const capNote = (text: string) => text;

  useEffect(() => {
    if (panel !== "looks" || !lookKey) return;
    const saved = lookCache.current.get(lookKey);
    if (!saved) return;
    setResult(saved);
    setServed((current) => current.look === lookKey ? current : { ...current, look: lookKey });
  }, [panel, lookKey]);

  useEffect(() => {
    if (panel !== "mehendi" || !mehendiKey) return;
    const saved = mehendiCache.current.get(mehendiKey);
    if (!saved) return;
    setResult(saved);
    setServed((current) => current.mehendi === mehendiKey ? current : { ...current, mehendi: mehendiKey });
  }, [panel, mehendiKey]);

  useEffect(() => {
    if (panel !== "looks") return;
    const ids = ["bridal-event", "bridal-look", "bridal-hair", "bridal-makeup", "bridal-selfie"];
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    const root = desktop ? picksRef.current : null;
    const nodes = ids.map((id) => document.getElementById(id)).filter((node): node is HTMLElement => Boolean(node));
    if (!nodes.length) return;
    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
      const best = ids.reduce((lead, id) => ((ratios.get(id) || 0) > (ratios.get(lead) || 0) ? id : lead), ids[0]);
      if ((ratios.get(best) || 0) > 0) setActiveStep(best);
    }, { root, rootMargin: "-12% 0px -50% 0px", threshold: [0.2, 0.45, 0.75] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [panel]);

  return (
    <div data-bridal="flow" data-busy={busy ? "yes" : "no"}>
      <ConsentSheet open={consent.open} lang={config.defaultLang || "en"} onAgree={(ageGate) => void consent.agree(ageGate)} onClose={consent.close} />
      <div className="seg mt-4" role="tablist" aria-label="Bridal">
        {(["looks", "own", "mehendi", "saved"] as const).map((item) => (
          <button key={item} className="seg-btn" type="button" role="tab" aria-selected={panel === item} onClick={() => setPanel(item)}>
            {item === "looks" ? "Looks" : item === "own" ? "Your own look" : item === "mehendi" ? "Mehendi" : "My looks"}
          </button>
        ))}
      </div>

      {/* Stay mounted so the pieces she added survive a tab switch. */}
      <div className="mt-4" hidden={panel !== "own"} data-own-panel={panel === "own" ? "open" : "closed"}><BridalOwnLook config={config} /></div>

      {panel === "looks" && (
        <div className="try-desk mt-4">
          <div className="try-picks grid gap-4" ref={picksRef}>
          <StepRail
            id="bridal-steps"
            label="Bridal steps"
            current={activeStep}
            onPick={setActiveStep}
            steps={[
              { id: "bridal-event", label: "Event", icon: "event" },
              { id: "bridal-look", label: "Look", icon: "look" },
              { id: "bridal-hair", label: "Hair", icon: "hair" },
              { id: "bridal-makeup", label: "Makeup", icon: "makeup" },
              { id: "bridal-selfie", label: "Photo", icon: "photo" },
            ]}
          />
          {busy ? <p className="rounded-xl border border-line bg-sand px-3 py-2 text-sm" role="status" data-busy-note="yes">Your look is being created. Please wait — choices unlock when it is ready.</p> : null}
          <fieldset disabled={busy} aria-busy={busy} className={`contents ${busy ? "picks-locked" : ""}`} data-picks-locked={busy ? "yes" : "no"}>
          <StepCard id="bridal-event" title="Event">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Event">
              {BRIDAL_EVENTS.map((item) => (
                <button key={item.id} className="chip" type="button" aria-pressed={eventId === item.id} onClick={() => { setActiveStep("bridal-event"); setEventId(item.id); setLookId(cardsForStyle(looksForEvent(item.id), lookStyle)[0]?.id || ""); }}>{item.label}</button>
              ))}
            </div>
          </StepCard>
          <PhotoGrid step="look" label="Look" group="Bridal looks" styles={bridalStylesFor(eventLooks)} style={lookStyle} onStyle={chooseLookStyle} items={looks} value={chosen?.id || ""} onChange={(id) => { setActiveStep("bridal-look"); setLookId(id); }} />
          <PhotoGrid step="hair" label="Hair" hint="Optional. Tap again to leave the look’s own hair." group="Hair" styles={bridalStylesFor(BRIDAL_HAIR)} style={hairStyle} onStyle={chooseHairStyle} items={hairCards} value={hairId} onChange={pickHair} />
          <StepCard id="bridal-makeup" title="Makeup" hint="Lip, cheek, and eye colour.">
            {visibleStylePills(bridalStylesFor(BRIDAL_MAKEUP)).length > 0 ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Makeup style">
                {visibleStylePills(bridalStylesFor(BRIDAL_MAKEUP)).map((item) => (
                  <button key={item.id} className="chip" type="button" aria-pressed={makeupStyle === item.id} onClick={() => chooseMakeupStyle(item.id)}>{item.label}</button>
                ))}
              </div>
            ) : null}
            <MakeupSwatches items={makeupCards} value={makeupId} onChange={pickMakeup} />
            <OptionRow label="Makeup finish" options={BRIDAL_FINISHES.map((item) => ({ id: item.id, label: item.label }))} value={finishId} onChange={(id) => { setFinishId(id); }} />
            <div>
              <p className="mb-2 text-sm font-medium">Lip colour</p>
              <div className="live-row" role="group" aria-label="Lip colour">
                {BRIDAL_LIPS.map((lip) => (
                  <button key={lip.id} type="button" aria-pressed={lipId === lip.id} aria-label={lip.name} className="live-dot" style={{ background: lip.hex }} onClick={() => { setLipId(lip.id); }} />
                ))}
              </div>
            </div>
          </StepCard>
          </fieldset>
          </div>
          <section id="bridal-selfie" ref={resultRef} className="try-preview step-card grid gap-3" data-step="selfie" data-photo-cluster="yes">
            <h3 className="text-base font-semibold leading-tight">Photo</h3>
            <SelectionSummary rows={[
              { id: "bridal-event", label: "Event", value: event?.label || "Wedding" },
              { id: "bridal-look", label: "Look", value: chosen?.name || "A look" },
              { id: "bridal-hair", label: "Hair", value: hairName },
              { id: "bridal-makeup", label: "Makeup", value: makeupName },
            ]} />
            {result?.kind === "look" && !busy ? <h3 className="text-center font-serif text-2xl">{result.name}</h3> : null}
            {locked && !face && live !== "face" ? <LockedPhotoNote lang={config.defaultLang || "en"} /> : <LargeFrame boxRef={faceBox} name="face">
              {live === "face" ? (
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
                  onRetake={() => beginLive("face", liveLook)}
                  chrome="clean"
                  makeup={liveLook ? <MakeupStage video={camReady ? videoRef.current : null} lip={lipHex} kajal={kajal} lashes={lashes} blush={blushOn} brow={browOn} /> : null}
                />
              ) : result?.kind === "look" && !busy ? (
                <>
                  <BeforeAfter className="relative h-full w-full touch-none overflow-hidden bg-[#F3F0F8]" before={result.before} after={result.after} beforeLabel="Before" afterLabel="After" afterClassName="gen-reveal" />
                  <ResultZoom src={result.after} />
                </>
              ) : (
                <>
                  {face ? <img src={face.url} alt="Your selfie" className="absolute inset-0 h-full w-full object-cover" /> : null}
                  {busyKind === "look" ? <GeneratingLook tool="bridal" /> : null}
                  {!face && !busyKind ? <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm">Face the light. No sunglasses.</p> : null}
                </>
              )}
            </LargeFrame>}
            {live === "face" ? (
              <LiveTray ready={camReady} onShutter={() => void captureLive()}>
                {liveLook ? (
                  <div className="live-row" role="group" aria-label="Live makeup">
                    <button className="live-pill" type="button" aria-pressed={kajal} aria-label="Kajal" onClick={() => setKajal((value) => !value)}><EyeIcon /></button>
                    <button className="live-pill" type="button" aria-pressed={lashes} aria-label="Lashes" onClick={() => setLashes((value) => !value)}><LashIcon /></button>
                    <button className="live-pill" type="button" aria-pressed={blushOn} aria-label="Blush" onClick={() => setBlushOn((value) => !value)}><BlushIcon /></button>
                    <button className="live-pill" type="button" aria-pressed={browOn} aria-label="Brows" onClick={() => setBrowOn((value) => !value)}><BrowIcon /></button>
                    <span className="mx-0.5 h-5 w-px shrink-0 self-center bg-[var(--line)]" aria-hidden="true" />
                    {BRIDAL_LIPS.map((lip) => (
                      <button key={lip.id} type="button" aria-pressed={lipId === lip.id} aria-label={lip.name} className="live-dot" style={{ background: lip.hex }} onClick={() => setLipId(lip.id)} />
                    ))}
                  </div>
                ) : null}
              </LiveTray>
            ) : busyKind === "look" ? null : (
              <PhotoActions settled={result?.kind === "look"} className="grid w-full max-w-[28rem] gap-2">
                <button className="btn sheen" type="button" data-photo-action="selfie" onClick={() => beginLive("face", false)}>Take selfie</button>
                <p className="text-center text-xs text-muted">Front camera, one still photo. No live makeup.</p>
                <button className="btn secondary" type="button" data-photo-action="upload" onClick={() => consent.gate(() => bridalFile.current?.click())}>Upload</button>
                <button className="btn secondary" type="button" data-photo-action="live" onClick={() => beginLive("face", true)}>Live capture</button>
                <p className="text-center text-xs text-muted">Front camera with live lip colour while you frame the photo.</p>
                {face ? <CropPhotoButton src={face.url} disabled={busy} onApply={(blob) => replaceShot("face", blob)} /> : null}
                <input ref={bridalFile} className="sr-only" type="file" accept="image/*" data-photo="bridal" onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  void fileToShot(file).then((shot) => { setFace(shot); setResult((current) => (current?.kind === "look" ? null : current)); });
                }} />
              </PhotoActions>
            )}
            {camError && panel === "looks" ? <p className="text-sm" role="alert">{camError}</p> : null}
            {result?.kind === "look" && !busy ? (
              <LookResultActions slug={config.slug} name={result.name} imageUrl={result.after} shareUrl={result.share} kind="bridal" />
            ) : null}
            <AtSalonNote lang={config.defaultLang || "en"} />
            <TryBar
              label={lookButton.label}
              enabled={lookButton.enabled}
              busy={busy}
              counter={counter}
              note={capNote(lookButton.note)}
              another={lookButton.another}
              onAnother={() => scrollToStep("bridal-steps")}
              onClick={() => { if (face) void generate("look", face); }}
              onSave={result?.kind === "look" && !busy ? () => void saveCurrent() : undefined}
              saveLabel={currentSaved()?.kind === "look" ? "Unsave" : "Save this look"}
            />
          </section>
        </div>
      )}

      {panel === "mehendi" && (
        <div className="mt-4 grid gap-4">
          <fieldset disabled={busy} aria-busy={busy} className={`contents ${busy ? "picks-locked" : ""}`} data-picks-locked={busy ? "yes" : "no"}>
          <PhotoGrid step="mehendi" label="Mehendi" group="Mehendi" styles={bridalStylesFor(MEHENDI_CARDS)} style={mehendiCategory} onStyle={chooseMehendiCategory} items={mehendiCards} value={mehendiCardId} onChange={(id) => { pickMehendi(id); }} />
          </fieldset>
          <section id="bridal-hand" className="step-card grid gap-3" data-step="hand">
            <h3 className="text-base font-semibold leading-tight">Photo</h3>
            <p className="text-sm">Hold your hand flat in good light. Fill the photo with your palm.</p>
            {result?.kind === "mehendi" && !busy ? <h3 className="text-center font-serif text-2xl">{result.name}</h3> : null}
            {locked && !hand && live !== "hand" ? <LockedPhotoNote lang={config.defaultLang || "en"} /> : <LargeFrame boxRef={handBox} name="hand">
              {live === "hand" ? (
                <LiveStudio
                  videoRef={videoRef}
                  ready={camReady}
                  facing="environment"
                  guide="hand"
                  zoom={zoom}
                  onZoom={setZoom}
                  onBack={stopLive}
                  onClose={stopLive}
                  onShutter={captureLive}
                  onRetake={() => beginLive("hand")}
                  chrome="clean"
                />
              ) : result?.kind === "mehendi" && !busy ? (
                <>
                  <BeforeAfter className="relative h-full w-full touch-none overflow-hidden bg-[#F3F0F8]" before={result.before} after={result.after} beforeLabel="Before" afterLabel="After" afterClassName="gen-reveal" />
                  <ResultZoom src={result.after} />
                </>
              ) : (
                <>
                  {hand ? <img src={hand.url} alt="Your hand" className="absolute inset-0 h-full w-full object-cover" /> : <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm">Your palm, in good light.</p>}
                  {busyKind === "mehendi" ? <GeneratingLook tool="mehendi" /> : null}
                </>
              )}
            </LargeFrame>}
            {live === "hand" ? (
              <LiveTray ready={camReady} onShutter={() => void captureLive()} />
            ) : busyKind === "mehendi" ? null : (
              <PhotoActions settled={result?.kind === "mehendi"} className="grid w-full max-w-[28rem] gap-2">
                <button className="btn sheen" type="button" onClick={() => beginLive("hand")}>Take photo</button>
                <button className="btn secondary" type="button" onClick={() => consent.gate(() => mehendiFile.current?.click())}>Upload</button>
                {hand ? <CropPhotoButton src={hand.url} disabled={busy} onApply={(blob) => replaceShot("hand", blob)} /> : null}
                <input ref={mehendiFile} className="sr-only" type="file" accept="image/*" data-photo="mehendi" onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  void fileToShot(file).then((shot) => { setHand(shot); setResult((current) => (current?.kind === "mehendi" ? null : current)); });
                }} />
              </PhotoActions>
            )}
            {result?.kind === "mehendi" && !busy ? (
              <LookResultActions slug={config.slug} name={result.name} imageUrl={result.after} shareUrl={result.share} kind="bridal" />
            ) : null}
            <AtSalonNote lang={config.defaultLang || "en"} />
            <TryBar
              label={mehendiButton.label}
              enabled={mehendiButton.enabled}
              busy={busy}
              counter={counter}
              note={capNote(mehendiButton.note)}
              another={mehendiButton.another}
              onAnother={() => scrollToStep("bridal-mehendi")}
              onClick={() => { if (hand) void generate("mehendi", hand); }}
              onSave={result?.kind === "mehendi" && !busy ? () => void saveCurrent() : undefined}
              saveLabel={currentSaved()?.kind === "mehendi" ? "Unsave" : "Save this look"}
            />
          </section>
        </div>
      )}

      {error && panel !== "own" && panel !== "saved" ? <p className="mt-3 text-sm" role="status">{error}</p> : null}

      {panel === "saved" && (
        <div className="mt-4 grid gap-4">
          {saved.length === 0 ? <p className="text-sm">Save a look to compare it and send it to your family.</p> : null}
          <ul className="grid gap-3">
            {[...saved.map((look) => ({ look, removed: false })), ...gone.filter((look) => !saved.some((item) => item.id === look.id)).map((look) => ({ look, removed: true }))].map(({ look, removed }) => {
              const compareOn = compareControl(compare.includes(look.id));
              return (
              <li key={look.id} className="card grid gap-3 p-3 sm:grid-cols-[9rem_1fr]">
                <div className={`relative ${removed ? "is-removed" : ""}`}>
                  <img src={look.after} alt="" className="aspect-[3/4] w-full rounded-lg object-cover" />
                  <SavedMarks removed={removed} keepLabel="Save this look" dropLabel="Remove this look" onKeep={() => restoreLook(look)} onDrop={() => removeLook(look)} />
                </div>
                <div>
                  <p className="font-medium leading-snug">{look.name}</p>
                  <p className="text-xs text-muted">{bridalEventById(look.eventId)?.label}</p>
                  {removed ? null : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button className={compareOn.className} type="button" aria-pressed={compareOn.pressed} data-compare={compareOn.pressed ? "open" : "closed"} onClick={() => toggleCompare(look.id)}>{compareOn.label}</button>
                      <button className="btn secondary" type="button" onClick={() => share(look)}>Share with family</button>
                    </div>
                  )}
                </div>
              </li>
              );
            })}
          </ul>
          {compared.length === 1 && (
            <div data-compare-view="before-after">
              <h3 className="mb-2 font-serif text-xl">Before and after</h3>
              <p className="mb-2 text-xs text-muted">Tap Compare on a second look to see two looks side by side.</p>
              <BeforeAfter className="relative aspect-[3/4] w-full touch-none overflow-hidden rounded-xl bg-[#F3F0F8]" before={compared[0].before} after={compared[0].after} beforeLabel="Before" afterLabel={compared[0].name} />
            </div>
          )}
          {compared.length === 2 && (
            <div>
              <h3 className="mb-2 font-serif text-xl">Side by side</h3>
              <div className="grid grid-cols-2 gap-2">
                {compared.map((look) => (
                  <figure key={look.id}>
                    <img src={look.after} alt={look.name} className="aspect-[3/4] w-full rounded-xl object-cover" />
                    <figcaption className="mt-1 text-xs leading-snug">{look.name}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
          <form className="card grid gap-3 p-4" onSubmit={(event) => { event.preventDefault(); void book(); }}>
            <h3 className="font-serif text-xl">Book bridal trial</h3>
            <p className="text-sm">For your {event?.label.toLowerCase()}. The salon gets your name, the date, and the looks you saved.</p>
            {config.bridalPackages.length > 0 && (
              <ul className="grid gap-2" aria-label="Bridal packages">
                {config.bridalPackages.map((pack) => (
                  <li key={pack.key} className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{pack.name}</span>
                    <span>₹{pack.priceInr.toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ul>
            )}
            <label className="text-sm">Your name
              <input className="field mt-1" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} autoComplete="name" />
            </label>
            <label className="text-sm">Event date
              <input className="field mt-1" type="date" min={kolkataDayKey()} value={eventDate} onChange={(event) => setEventDate(event.target.value)} required />
            </label>
            <button className="btn sheen" type="submit">Book bridal trial</button>
            {bookNote && <p className="text-sm" role="status">{bookNote}</p>}
          </form>
        </div>
      )}
    </div>
  );
}

function PhotoGrid({ step, label, hint, group, styles, style, onStyle, items, value, onChange }: { step: string; label: string; hint?: string; group: string; styles: { id: BridalStyleId; label: string }[]; style: BridalStyleId; onStyle: (id: BridalStyleId) => void; items: { id: string; name: string; image: boolean }[]; value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(12);
  const pills = visibleStylePills(styles);
  const needle = query.trim().toLowerCase();
  const filtered = needle ? items.filter((item) => item.name.toLowerCase().includes(needle)) : items;
  const visible = filtered.slice(0, shown);
  return (
    <section id={`bridal-${step}`} className="card step-card grid gap-3 p-3" data-step={step}>
      <h3 className="text-base font-semibold leading-tight">{label}</h3>
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      <input className="field" type="search" aria-label={`Search ${group}`} placeholder={`Search ${group.toLowerCase()}`} value={query} onChange={(event) => { setQuery(event.target.value); setShown(12); }} />
      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={`${group} style`}>
          {pills.map((item) => (
            <button key={item.id} className="chip shrink-0" type="button" aria-pressed={style === item.id} onClick={() => { onStyle(item.id); setShown(12); }}>{item.label}</button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="list" aria-label={group}>
        {visible.map((item, index) => (
          <div key={item.id} role="listitem">
            <button type="button" aria-pressed={item.id === value} className={`relative w-full overflow-hidden rounded-[14px] border bg-[#F3E6D8] text-left shadow-sm ${item.id === value ? "border-[var(--brand)] ring-2 ring-[var(--brand)]" : "border-line"}`} onClick={() => onChange(item.id)}>
              {item.id === value ? <span className="check" aria-hidden="true">✓</span> : null}
              <BridalLookCard id={item.id} name={item.name} image={item.image} priority={index < 2} />
              <span className="block bg-white px-2 py-2 text-sm font-medium leading-snug">{item.name}</span>
            </button>
          </div>
        ))}
      </div>
      {filtered.length === 0 ? <p className="text-sm text-muted">No matches.</p> : null}
      {filtered.length > shown ? <button className="btn secondary min-h-11 w-fit" type="button" onClick={() => setShown((count) => count + 12)}>Show more</button> : null}
    </section>
  );
}

function OptionRow({ label, options, value, onChange }: { label: string; options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((item) => (
          <button key={item.id} className="chip" type="button" aria-pressed={value === item.id} onClick={() => onChange(item.id)}>{item.label}</button>
        ))}
      </div>
    </div>
  );
}
