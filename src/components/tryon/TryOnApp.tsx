"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { flushSync } from "react-dom";
import { isPlatformLogo, LookuviMark } from "@/components/brand/LookuviMark";
import { WhatsAppIcon } from "@/components/icons/ContactIcons";
import { BeforeAfter } from "@/components/tryon/BeforeAfter";
import { AtSalonNote } from "@/components/guest/AtSalonNote";
import { AtSalonSheet, useUnlockSheet } from "@/components/guest/AtSalonSheet";
import { GuestNav } from "@/components/guest/GuestNav";
import { addSavedPick, readSavedPicks, removeSavedPick, savedPickOn, savedPicksKey, writeSavedPicks, SAVED_DROP_ERROR, type SavedPick } from "@/lib/at-salon-browse";
import { guestDeviceId } from "@/lib/device-id";
import { guestSessionId } from "@/lib/guest-session";
import { ConsentSheet } from "@/components/tryon/ConsentSheet";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { AiGeneratedBadge } from "@/components/legal/AiGeneratedBadge";
import { GeneratingLook } from "@/components/tryon/GeneratingLook";
import { LookPicker } from "@/components/tryon/LookPicker";
import { LiveStudio, StudioRail } from "@/components/tryon/LiveStudio";
import { CropPhotoButton } from "@/components/tryon/PhotoCrop";
import { usePhotoConsent } from "@/components/tryon/usePhotoConsent";
import { BrowCard } from "@/components/tryon/BrowCard";
import { ColourStage } from "@/components/tryon/ColourStage";
import { HairTypePicker } from "@/components/tryon/HairTypePicker";
import { StyleCard } from "@/components/tryon/StyleCard";
import { browsForAudience, type BrowColour, type BrowThickness } from "@/data/brows";
import { guestPageLocale, t } from "@/data/i18n";
import { styleHasPhoto } from "@/data/style-photos";
import { LOOK_FILTERS, lookTagsForStyle } from "@/lib/look-picker";
import { orderStylesForPicker, suggestStyles, type HairReading } from "@/lib/hair-suitability";
import { captureShouldMirror, visiblePortraitCrop } from "@/lib/capture";
import { alignGeneratedPhoto } from "@/lib/face/align-client";
import { detectFaceLandmarks } from "@/lib/face/detect-client";
import type { PlacementDebug } from "@/lib/face/pose";
import { classifySkinPhoto } from "@/lib/hand-photo";
import type { SalonConfig } from "@/lib/salon";
import { guestSections, type GuestSection } from "@/lib/guest-sections";
import { guestJoinHref } from "@/lib/guest-nav";
import { downloadLookFile, lookDownloadName } from "@/lib/look-result";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";
import { GUEST_PREVIEW_FAILED, postGuestGenerate } from "@/lib/guest-preview";
import { clearTabLooks, parseTabSession, putTabLook, readTabSessionRaw, selfieForEdit, serializeTabSession, tabLookCacheKey, writeTabSessionRaw, type TabLook, type TabLookMap, type TabTool } from "@/lib/tab-looks";

function poseLine(label: string, value: number | string | null) {
  return (
    <div>
      <dt className="inline">{label} </dt>
      <dd className="inline">{value ?? "—"}</dd>
    </div>
  );
}

function PoseReadout({ debug }: { debug: PlacementDebug }) {
  return (
    <dl data-testid="pose-debug" className="mx-auto mt-2 max-w-sm rounded-xl bg-black/5 px-3 py-2 text-left text-xs leading-5">
      {poseLine("Yaw", debug.yaw === null ? null : `${debug.yaw}°`)}
      {poseLine("Roll", debug.roll === null ? null : `${debug.roll}°`)}
      {poseLine("Pitch", debug.pitch === null ? null : `${debug.pitch}°`)}
      {poseLine("Face size", debug.faceSize)}
      {poseLine("Mask area", debug.maskArea)}
      {poseLine("Hair", debug.hair)}
      {poseLine("Zone", debug.zone)}
      {poseLine("Check", debug.failed ? `${debug.failed} ${debug.value ?? ""}`.trim() : "ok")}
    </dl>
  );
}

type Look = {
  id: string;
  styleId: string;
  styleName: string;
  shadeName: string | null;
  before: string;
  after: string;
  /** Unaligned provider image. Present only for a signed-in super-admin. */
  raw?: string;
  alignMode?: "landmarks" | "cover";
  eyeDelta?: number | null;
  serviceKeys: string[];
  tool: "style" | "brows" | "beard" | "nails" | "colour";
  demo?: boolean;
  lookShare?: string;
};

type Chosen = { id: string; name: string; serviceKeys: string[]; tool: Look["tool"] };

type TryTool = "colour" | "style" | "brows" | "beard" | "nails";
type Audience = "women" | "men" | "kids";
type Shot = { blob: Blob; url: string; el: HTMLImageElement };

function firstTool(config: SalonConfig, requested?: string): TryTool {
  const allowed: TryTool[] = [];
  if (config.toolStyle) allowed.push("style");
  if (config.toolColour) allowed.push("colour");
  if (config.toolBrows) allowed.push("brows");
  if (config.toolNails) allowed.push("nails");
  if (config.toolBeard) allowed.push("beard");
  if (requested && allowed.includes(requested as TryTool)) return requested as TryTool;
  return allowed[0] ?? "style";
}

type BridalPaneProps = { config: SalonConfig };

function useBridalPane(active: boolean) {
  const [Pane, setPane] = useState<ComponentType<BridalPaneProps> | null>(null);
  useEffect(() => {
    if (!active || Pane) return;
    let live = true;
    void import("@/components/tryon/BridalFlow").then((mod) => {
      if (live) setPane(() => mod.BridalFlow);
    });
    return () => {
      live = false;
    };
  }, [active, Pane]);
  return Pane;
}

function useMakeupPane(active: boolean) {
  const [Pane, setPane] = useState<ComponentType<BridalPaneProps> | null>(null);
  useEffect(() => {
    if (!active || Pane) return;
    let live = true;
    void import("@/components/makeup-studio/MakeupStudio").then((mod) => {
      if (live) setPane(() => mod.MakeupStudio);
    });
    return () => {
      live = false;
    };
  }, [active, Pane]);
  return Pane;
}

function useGroomPane(active: boolean) {
  const [Pane, setPane] = useState<ComponentType<BridalPaneProps> | null>(null);
  useEffect(() => {
    if (!active || Pane) return;
    let live = true;
    void import("@/components/tryon/GroomFlow").then((mod) => {
      if (live) setPane(() => mod.GroomFlow);
    });
    return () => {
      live = false;
    };
  }, [active, Pane]);
  return Pane;
}

function sessionId() {
  return guestSessionId();
}

function friendlyHairMessage(message: string) {
  if (!message || /did not complete|not sent again|timeout|abort|vision/i.test(message)) {
    return "We couldn't analyze your photo. Please try again.";
  }
  return message;
}

async function shrinkForSuggest(blob: Blob) {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return blob;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const next = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    return next && next.size < blob.size ? next : blob;
  } catch {
    return blob;
  }
}

export function TryOnApp({
  config,
  embed = false,
  initialTool,
  initialStyleId,
  initialShadeId,
  salonToken,
  salonMode = false,
  poseDebug = false,
  showQueue = false,
  queueMode = "LIVE",
  showBridal = false,
  showEveryday = true,
  showGroom = false,
  showMakeup = false,
}: {
  config: SalonConfig;
  embed?: boolean;
  initialTool?: string;
  initialStyleId?: string;
  initialShadeId?: string;
  salonToken?: string;
  salonMode?: boolean;
  /** Signed-in super-admin only. Guests never receive the numbers. */
  poseDebug?: boolean;
  showQueue?: boolean;
  queueMode?: string;
  showBridal?: boolean;
  showEveryday?: boolean;
  showGroom?: boolean;
  showMakeup?: boolean;
}) {
  const lang = guestPageLocale(config.defaultLang, config.languages);
  const gate = useUnlockSheet(config.tryOnsAtSalon);
  const [savedPicks, setSavedPicks] = useState<SavedPick[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const sections = guestSections({ everyday: showEveryday, bridal: showBridal, groom: showGroom, makeup: showMakeup });
  const [section, setSection] = useState<GuestSection>(sections[0] || "everyday");
  const bridalOn = section === "bridal" && showBridal;
  const groomOn = section === "groom" && showGroom;
  const makeupOn = section === "makeup" && showMakeup;
  const BridalPane = useBridalPane(bridalOn);
  const GroomPane = useGroomPane(groomOn);
  const MakeupPane = useMakeupPane(makeupOn);
  const [sid, setSid] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [faceShot, setFaceShot] = useState<Shot | null>(null);
  const [handShot, setHandShot] = useState<Shot | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [shadeId, setShadeId] = useState(config.shades[0]?.id ?? "");
  const [intensity, setIntensity] = useState(72);
  const [tool, setTool] = useState<TryTool>(firstTool(config, initialTool));
  const [gender, setGender] = useState<Audience>(config.showWomen ? "women" : config.showMen ? "men" : "kids");
  const [styleId, setStyleId] = useState("");
  const browThickness: BrowThickness = "natural";
  const browColour: BrowColour = "natural";
  const [busy, setBusy] = useState(false);
  const [busyTool, setBusyTool] = useState<TryTool | null>(null);
  const [pickedDensity, setPickedDensity] = useState("");
  const [pickedTexture, setPickedTexture] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [lookFilter, setLookFilter] = useState("all");
  const [hairReading, setHairReading] = useState<HairReading | null>(null);
  const [suggestNote, setSuggestNote] = useState("");
  const [suggestCost, setSuggestCost] = useState("");
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestFailed, setSuggestFailed] = useState(false);
  const previewLock = useRef(false);
  const resultSig = useRef<Partial<Record<TryTool, string>>>({});
  const resultBlobs = useRef<Partial<Record<TryTool, Blob>>>({});
  const faceRef = useRef<Shot | null>(null);
  const handRef = useRef<Shot | null>(null);
  const pendingLook = useRef<Chosen | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [poseNote, setPoseNote] = useState<PlacementDebug | null>(null);
  const [looks, setLooks] = useState<TabLookMap>({});
  const [rawUrls, setRawUrls] = useState<Partial<Record<TryTool, string>>>({});
  const [picked, setPicked] = useState<Partial<Record<TryTool, string>>>({});
  const [cacheReady, setCacheReady] = useState(false);
  const [freshGlow, setFreshGlow] = useState(false);
  const [modelStatus, setModelStatus] = useState<"loading" | "ready" | "error">("loading");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraGen = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLElement>(null);
  const previewDockRef = useRef<HTMLDivElement>(null);
  const [miniPreview, setMiniPreview] = useState(false);
  const consent = usePhotoConsent(config.slug, lang);
  const [zoom, setZoom] = useState(1);
  const [compareOn, setCompareOn] = useState(true);

  useEffect(() => {
    const saved = parseTabSession(readTabSessionRaw(config.slug));
    setLooks(saved.looks);
    const current = saved.looks[firstTool(config, initialTool)];
    if (current) {
      setStyleId(current.styleId);
      setPicked((prev) => ({ ...prev, [current.tool]: current.styleId }));
    }
    void restoreShot(saved.face, "face");
    void restoreShot(saved.hand, "hand");
    setCacheReady(true);
    // Restore once per salon. config.slug is the stable key; the object identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.slug, initialTool]);

  useEffect(() => {
    if (!cacheReady) return;
    const stored = parseTabSession(readTabSessionRaw(config.slug));
    const face = faceRef.current?.url.startsWith("data:image/") ? faceRef.current.url : stored.face;
    const hand = handRef.current?.url.startsWith("data:image/") ? handRef.current.url : stored.hand;
    writeTabSessionRaw(config.slug, serializeTabSession({ face, hand, looks }));
  }, [looks, config.slug, faceShot, handShot, cacheReady]);

  useEffect(() => {
    setSavedPicks(readSavedPicks(localStorage.getItem(savedPicksKey(config.slug))));
  }, [config.slug]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("lookuvi-hair-filters");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { density?: string; texture?: string };
      if (typeof parsed.density === "string") setPickedDensity(parsed.density);
      if (typeof parsed.texture === "string") setPickedTexture(parsed.texture);
    } catch {
      /* A bad saved filter just starts blank. */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("lookuvi-hair-filters", JSON.stringify({ density: pickedDensity, texture: pickedTexture }));
    } catch {
      /* The choice still applies for this visit. */
    }
  }, [pickedDensity, pickedTexture]);

  useEffect(() => {
    setSid(sessionId());
    if (initialStyleId) return;
    const saved = localStorage.getItem("helix_audience");
    if (saved === "women" && config.showWomen) setGender("women");
    if (saved === "men" && config.showMen) setGender("men");
    if (saved === "kids" && config.showKids) setGender("kids");
  }, [config.showKids, config.showMen, config.showWomen, initialStyleId]);

  useEffect(() => {
    if (initialShadeId && config.shades.some((item) => item.id === initialShadeId)) setShadeId(initialShadeId);
  }, [initialShadeId, config.shades]);

  useEffect(() => {
    if (!initialStyleId) return;
    const style = config.styles.find((item) => item.id === initialStyleId);
    if (style) {
      setGender(style.gender);
      setStyleId(style.id);
      return;
    }
    const known = config.brows.some((item) => item.id === initialStyleId)
      || config.beards.some((item) => item.id === initialStyleId)
      || config.nails.some((item) => item.id === initialStyleId);
    if (known) setStyleId(initialStyleId);
  }, [initialStyleId, config.styles, config.brows, config.beards, config.nails]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const shade = config.shades.find((item) => item.id === shadeId) ?? null;
  const activeShot = tool === "nails" ? handShot : faceShot;
  const styles = config.styles.filter((style) => style.gender === gender);
  const browList = browsForAudience(config.brows, gender);
  const visibleStyles = config.hairPickerOn
    ? orderStylesForPicker(styles, { density: pickedDensity, texture: pickedTexture }, false)
    : styles;
  const shownStyles = visibleStyles.filter((style) => styleHasPhoto(style.id));
  const hairSuggestions = hairReading
    ? suggestStyles(styles, hairReading).flatMap((row) => styleHasPhoto(row.style.id) ? [{
        id: row.style.id,
        name: row.style.name,
        reason: row.reason,
        serviceKeys: row.style.serviceKeys ?? [],
      }] : [])
    : [];
  const active: Look | null = looks[tool] ? { ...looks[tool], raw: rawUrls[tool] } : null;
  const generatingHere = busy && busyTool === tool;
  const showResult = Boolean(active) && !generatingHere && !cameraOn;
  useEffect(() => {
    if (!showResult || !active?.id) return;
    setFreshGlow(true);
    const timer = window.setTimeout(() => setFreshGlow(false), 1200);
    return () => window.clearTimeout(timer);
  }, [showResult, active?.id]);
  const phone = normalizeWhatsAppPhone(config.whatsapp);
  const bookHref = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(`Hi ${config.name}, I would like to book an appointment.`)}`
    : "";
  const chatHref = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(`Hi ${config.name}, I'd like to know more / book an appointment.`)}`
    : "";

  function track(eventName: string, props?: Record<string, string | number | boolean | null>) {
    const session = sid || sessionId();
    void fetch("/api/v1/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: config.slug, sessionId: session, events: [{ name: eventName, props }] }),
    }).catch(() => undefined);
  }

  function chooseGender(next: Audience) {
    setGender(next);
    localStorage.setItem("helix_audience", next);
  }

  function needPhoto() {
    setError(t(lang, "addPhotoFirst"));
    frameRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function recordPhotoConsent() {
    const session = sid || sessionId();
    if (!sid) setSid(session);
    return consent.persist();
  }

  function openCamera(nextFacing: "user" | "environment" = facing) {
    consent.gate(() => startCamera(nextFacing));
  }

  function openFile() {
    consent.gate(() => pickFile(fileRef.current));
  }

  function clearPickers() {
    if (fileRef.current) fileRef.current.value = "";
    if (captureRef.current) captureRef.current.value = "";
  }

  function pickFile(input: HTMLInputElement | null) {
    if (!input) return;
    input.value = "";
    input.click();
  }

  function releaseStream() {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.srcObject = null;
  }

  function logCamera(error: unknown) {
    if (process.env.NODE_ENV === "production") return;
    const name = error && typeof error === "object" && "name" in error ? String((error as { name?: string }).name) : "";
    console.error(`[camera] ${name || "error"}`, error);
  }

  function messageForCamera(error: unknown) {
    const name = error && typeof error === "object" && "name" in error ? String((error as { name?: string }).name) : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") return t(lang, "cameraDenied");
    if (name === "NotFoundError" || name === "DevicesNotFoundError") return t(lang, "cameraMissing");
    if (name === "NotReadableError" || name === "TrackStartError") return t(lang, "cameraBusy");
    if (name === "SecurityError" || !window.isSecureContext) return t(lang, "cameraInsecure");
    return t(lang, "cameraError");
  }

  function stopCamera() {
    cameraGen.current += 1;
    releaseStream();
    setCameraOn(false);
    setCameraReady(false);
    setVideoEl(null);
  }

  function dropLiveShot(nextFacing: "user" | "environment") {
    const hand = nextFacing === "environment";
    const shot = hand ? handRef.current : faceRef.current;
    if (shot?.url.startsWith("blob:")) URL.revokeObjectURL(shot.url);
    if (hand) {
      handRef.current = null;
      setHandShot(null);
    } else {
      faceRef.current = null;
      setFaceShot(null);
    }
  }

  function startCamera(nextFacing: "user" | "environment" = facing) {
    const gen = cameraGen.current + 1;
    cameraGen.current = gen;
    clearPickers();
    releaseStream();
    if (!window.isSecureContext) {
      setCameraOn(false);
      setCameraReady(false);
      setVideoEl(null);
      setCameraError(t(lang, "cameraInsecure"));
      logCamera(new Error("insecure context"));
      return;
    }
    const devices = navigator.mediaDevices;
    if (!devices?.getUserMedia) {
      setCameraOn(false);
      setCameraReady(false);
      setVideoEl(null);
      setCameraError(t(lang, "cameraError"));
      return;
    }
    // Ask in this click, before React paints, so the browser still treats it as the user gesture.
    const pending = devices.getUserMedia({
      video: { facingMode: nextFacing === "user" ? "user" : { ideal: "environment" } },
    });
    flushSync(() => {
      setError("");
      setCameraError("");
      setCameraReady(false);
      setFacing(nextFacing);
      setCameraOn(true);
      dropLiveShot(nextFacing);
    });
    frameRef.current?.scrollIntoView({ block: "end" });
    void attachCamera(pending, gen);
  }

  async function attachCamera(pending: Promise<MediaStream>, gen: number) {
    let stream: MediaStream;
    try {
      stream = await pending;
    } catch (error) {
      if (cameraGen.current !== gen) return;
      logCamera(error);
      releaseStream();
      setCameraOn(false);
      setCameraReady(false);
      setVideoEl(null);
      setCameraError(messageForCamera(error));
      return;
    }
    if (cameraGen.current !== gen) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((track) => track.stop());
      logCamera(new Error("video element missing after getUserMedia"));
      setCameraOn(false);
      return;
    }
    try {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.setAttribute("playsinline", "true");
      video.srcObject = stream;
      streamRef.current = stream;
      await video.play();
      if (cameraGen.current !== gen) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        if (typeof video.requestVideoFrameCallback === "function") video.requestVideoFrameCallback(() => done());
        else video.addEventListener("loadeddata", done, { once: true });
        window.setTimeout(done, 1200);
      });
      if (cameraGen.current !== gen) return;
      setVideoEl(video);
      setCameraReady(true);
      track("camera_started", {});
    } catch (error) {
      if (cameraGen.current !== gen) return;
      logCamera(error);
      stream.getTracks().forEach((track) => track.stop());
      releaseStream();
      setCameraOn(false);
      setCameraReady(false);
      setVideoEl(null);
    }
  }

  async function classifyHand(blob: Blob) {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      bitmap.close();
      return "unclear" as const;
    }
    ctx.drawImage(bitmap, 0, 0, 48, 48);
    bitmap.close();
    return classifySkinPhoto(ctx.getImageData(0, 0, 48, 48).data, 48, 48, 4);
  }

  async function restoreShot(dataUrl: string | undefined, slot: "face" | "hand") {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const shot = { blob, url: dataUrl, el: img };
      if (slot === "hand") {
        handRef.current = shot;
        setHandShot(shot);
      } else {
        faceRef.current = shot;
        setFaceShot(shot);
      }
    } catch {
      /* A stale session photo is ignored. The customer can take another. */
    }
  }

  function dataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function storeLook(look: TabLook) {
    setLooks((current) => putTabLook(current, look));
    setPicked((current) => ({ ...current, [look.tool]: look.styleId }));
  }

  async function applyBlob(blob: Blob) {
    const slot = tool === "nails" ? "hand" : "face";
    if (slot === "hand" && (await classifyHand(blob)) === "face") {
      stopCamera();
      setError(t(lang, "faceNotHand"));
      return;
    }
    const url = await dataUrl(blob);
    const img = new Image();
    img.src = url;
    await img.decode();
    stopCamera();
    const shot = { blob, url, el: img };
    if (slot === "hand") {
      handRef.current = shot;
      setHandShot(shot);
    } else {
      faceRef.current = shot;
      setFaceShot(shot);
    }
    setError("");
    const faceTools: TabTool[] = ["style", "colour", "brows", "beard"];
    resultSig.current = {};
    resultBlobs.current = {};
    setLooks((current) => clearTabLooks(current, slot === "hand" ? ["nails"] : faceTools));
    track("photo_captured", {});
    await recordPhotoConsent();
    continuePending();
  }

  async function jpegFromBitmap(bitmap: ImageBitmap) {
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  }

  async function loadFile(file: Blob) {
    setError("");
    try {
      const bitmap = await createImageBitmap(file);
      const blob = await jpegFromBitmap(bitmap);
      if (blob) await applyBlob(blob);
      return;
    } catch {
      /* Phone HEIC often cannot be decoded in the browser. The server tries next. */
    }
    const body = new FormData();
    body.set("photo", file);
    const res = await fetch("/api/v1/tryon/prepare-photo", { method: "POST", body });
    if (!res.ok) {
      setError(t(lang, "photoFormat"));
      return;
    }
    try {
      const bitmap = await createImageBitmap(await res.blob());
      const blob = await jpegFromBitmap(bitmap);
      if (blob) await applyBlob(blob);
      else setError(t(lang, "photoFormat"));
    } catch {
      setError(t(lang, "photoFormat"));
    }
  }

  async function shutter() {
    const video = videoRef.current;
    if (!video || !cameraOn) return;
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
    if (captureShouldMirror(facing)) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return;
    await applyBlob(blob);
  }

  function resetForAnotherPhoto() {
    resultSig.current = {};
    resultBlobs.current = {};
    setLooks({});
    try {
      writeTabSessionRaw(config.slug, serializeTabSession({ looks: {} }));
      sessionStorage.removeItem(tabLookCacheKey(config.slug));
    } catch {
      /* The next photo replaces the cache. */
    }
    pendingLook.current = null;
    setStyleId("");
    setHairReading(null);
    setPickedDensity("");
    setPickedTexture("");
    setSuggestNote("");
    setSuggestCost("");
    setNotice("");
    frameRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    void startCamera(tool === "nails" ? "environment" : "user");
  }

  async function suggestHair() {
    if (gate.locked) return;
    if (!faceShot) {
      needPhoto();
      return;
    }
    const consentId = (await recordPhotoConsent()) || "";
    if (suggestBusy || busy) return;
    setSuggestBusy(true);
    setSuggestFailed(false);
    setError("");
    setSuggestNote("");
    try {
      const photo = await shrinkForSuggest(faceShot.blob);
      const body = new FormData();
      body.set("photo", photo, "selfie.jpg");
      body.set("slug", config.slug);
      body.set("consentId", consentId);
      body.set("sessionId", sid || sessionId());
      body.set("deviceId", guestDeviceId());
      body.set("gender", gender);
      const res = await fetch("/api/v1/tryon/suggest", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const friendly = friendlyHairMessage(typeof data.message === "string" ? data.message : "");
        setError(friendly);
        setSuggestNote(friendly);
        setSuggestFailed(true);
        return;
      }
      setHairReading({
        density: data.density,
        texture: data.texture,
        hairline: data.hairline,
        faceShape: data.faceShape,
        confidence: Number(data.confidence),
      });
      setPickedDensity(String(data.density || ""));
      setPickedTexture(String(data.texture || ""));
      const low = Number(data.confidence) < 0.4;
      setSuggestNote(low ? "Check the hair type." : "");
      setSuggestCost("");
    } catch {
      const friendly = friendlyHairMessage("");
      setError(friendly);
      setSuggestNote(friendly);
      setSuggestFailed(true);
    } finally {
      setSuggestBusy(false);
    }
  }

  function shotRefFor(next: Look["tool"]) {
    return next === "nails" ? handRef.current : faceRef.current;
  }

  function comboSig(chosen: Chosen) {
    const shot = shotRefFor(chosen.tool);
    const options = chosen.tool === "brows"
      ? `${browThickness}:${browColour}`
      : chosen.tool === "style"
        ? shadeId
        : "";
    return `${chosen.tool}|${chosen.id}|${options}|${shot?.blob.size ?? 0}|${shot?.url.length ?? 0}`;
  }

  function resultReady(chosen: Chosen | null) {
    if (!chosen) return false;
    return Boolean(looks[chosen.tool]?.styleId === chosen.id && resultSig.current[chosen.tool] === comboSig(chosen));
  }

  function continuePending() {
    const chosen = pendingLook.current;
    if (!chosen || previewLock.current) return;
    if (!shotRefFor(chosen.tool)) return;
    void preview(chosen);
  }

  function selectLook(chosen: Chosen, generate = false) {
    setStyleId(chosen.id);
    setPicked((current) => ({ ...current, [chosen.tool]: chosen.id }));
    setTool(chosen.tool);
    setError("");
    if (gate.locked) {
      if (generate) gate.show();
      return;
    }
    if (!shotRefFor(chosen.tool)) {
      pendingLook.current = chosen;
      setError(t(lang, chosen.tool === "nails" ? "uploadHand" : "addPhotoFirst"));
      frameRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    pendingLook.current = chosen;
    if (generate) void preview(chosen);
  }

  async function preview(chosen: Chosen) {
    setStyleId(chosen.id);
    setPicked((current) => ({ ...current, [chosen.tool]: chosen.id }));
    setTool(chosen.tool);
    const shot = selfieForEdit(shotRefFor(chosen.tool));
    if (!shot) {
      pendingLook.current = chosen;
      setError(t(lang, chosen.tool === "nails" ? "uploadHand" : "addPhotoFirst"));
      frameRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (gate.stop()) return;
    if (resultSig.current[chosen.tool] === comboSig(chosen)) return;
    if (previewLock.current) return;
    previewLock.current = true;
    pendingLook.current = null;
    setError("");
    setPoseNote(null);
    setBusyTool(chosen.tool);
    setBusy(true);
    try {
      const consentId = (await recordPhotoConsent()) || "";
      track("generate_requested", { styleId: chosen.id, tool: chosen.tool });
      const body = new FormData();
      body.set("photo", shot.blob, "selfie.jpg");
      body.set("slug", config.slug);
      body.set("styleId", chosen.id);
      body.set("tool", chosen.tool);
      body.set("quality", "standard");
      body.set("consentId", consentId);
      body.set("sessionId", sid || sessionId());
      body.set("deviceId", guestDeviceId());
      const requestId = crypto.randomUUID();
      body.set("requestId", requestId);
      if (chosen.tool === "style" && shadeId) body.set("shadeId", shadeId);
      if (salonToken) body.set("salonToken", salonToken);
      if (chosen.tool === "brows") {
        body.set("browThickness", browThickness);
        body.set("browColour", browColour);
      }
      if (chosen.tool === "brows" || chosen.tool === "beard" || chosen.tool === "colour") {
        const detected = await detectFaceLandmarks(shot.blob).catch(() => null);
        if (detected) {
          body.set("landmarks", JSON.stringify(detected.landmarks));
          body.set("pose", JSON.stringify(detected.pose));
          body.set("faceCount", String(detected.faceCount));
        }
      }
      const res = await postGuestGenerate({ slug: config.slug, body, requestId });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: GUEST_PREVIEW_FAILED }));
        if (gate.fromRefusal(data)) return;
        setError(data.message || GUEST_PREVIEW_FAILED);
        if (poseDebug && data.debug) setPoseNote(data.debug as PlacementDebug);
        track("generate_failed", { styleId: chosen.id });
        return;
      }
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("json")) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || t(lang, "creditsEmpty"));
        return;
      }
      const out = await res.blob();
      const reason = res.headers.get("x-demo-reason") || "";
      const sample = reason === "no-key" || reason === "spend-cap" || reason === "failover" || reason === "placement";
      // Demo samples are the selfie plus a style card. Aligning them to the selfie crops the card
      // and makes Mid Fade (and every other category) look unchanged.
      const aligned = sample
        ? { blob: out, mode: "cover" as const, eyeDelta: null }
        : await alignGeneratedPhoto(shot.blob, out, chosen.tool === "beard");
      const warning = res.headers.get("x-placement-warning") || "";
      setNotice(
        reason === "spend-cap"
          ? t(lang, "spendCapNote")
          : reason === "no-key" || reason === "failover"
            ? t(lang, "sampleNote")
            : warning,
      );
      if (poseDebug) {
        const raw = res.headers.get("x-placement-debug");
        if (raw) {
          try {
            setPoseNote(JSON.parse(raw) as PlacementDebug);
          } catch {
            setPoseNote(null);
          }
        }
      }
      const before = await dataUrl(shot.blob);
      const after = await dataUrl(aligned.blob);
      resultBlobs.current[chosen.tool] = aligned.blob;
      resultSig.current[chosen.tool] = comboSig(chosen);
      setCompareOn(true);
      storeLook({
        id: res.headers.get("x-tryon-id") || crypto.randomUUID(),
        styleId: chosen.id,
        styleName: chosen.name,
        shadeName: chosen.tool === "style" ? shade?.name ?? null : chosen.tool === "colour" ? chosen.name : null,
        before,
        after,
        alignMode: aligned.mode,
        eyeDelta: aligned.eyeDelta,
        serviceKeys: chosen.serviceKeys,
        tool: chosen.tool,
        demo: sample,
        lookShare: res.headers.get("x-look-share") || "",
      });
      if (poseDebug) setRawUrls((current) => ({ ...current, [chosen.tool]: URL.createObjectURL(out) }));
      frameRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      track("generate_succeeded", { styleId: chosen.id });
    } catch {
      setError(GUEST_PREVIEW_FAILED);
      track("generate_failed", { styleId: chosen.id });
    } finally {
      previewLock.current = false;
      setBusy(false);
      setBusyTool(null);
    }
  }

  function chosenNow(): Chosen | null {
    if (tool === "colour") {
      if (!shade) return null;
      return { id: shade.id, name: shade.name, serviceKeys: shade.serviceKeys ?? [], tool: "colour" };
    }
    const chosen =
      tool === "style" ? config.styles.find((item) => item.id === styleId)
      : tool === "brows" ? config.brows.find((item) => item.id === styleId)
      : tool === "beard" ? config.beards.find((item) => item.id === styleId)
      : config.nails.find((item) => item.id === styleId);
    if (!chosen) return null;
    return { id: chosen.id, name: chosen.name, serviceKeys: chosen.serviceKeys ?? [], tool };
  }

  function pickShade(id: string) {
    const item = config.shades.find((shade) => shade.id === id);
    if (!item) return;
    if (gate.locked) {
      gate.show();
      return;
    }
    setShadeId(id);
    track("colour_selected", { shade: id });
    selectLook({ id: item.id, name: item.name, serviceKeys: item.serviceKeys ?? [], tool: "colour" });
  }

  async function book() {
    if (!active) return;
    const res = await fetch("/api/v1/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: config.slug,
        sessionId: sid || sessionId(),
        styleId: active.styleId,
        tool: active.tool,
        shadeId: active.tool === "colour" ? active.styleId : active.tool === "style" ? shadeId || null : null,
        lang,
        src: embed ? "embed" : "tryon",
        lookUrl: active.lookShare || null,
      }),
    });
    const data = await res.json();
    if (!data.whatsappUrl) {
      setError(t(lang, "whatsappMissing"));
      return;
    }
    if (embed && window.parent !== window) {
      window.parent.postMessage({ type: "tryon:booked", look: active.styleName }, "*");
    }
    window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
    track("lead_submitted", { look: active.styleName });
  }

  async function downloadLook() {
    if (!active) return;
    try {
      await downloadLookFile(resultBlobs.current[active.tool] || active.after, lookDownloadName(config.slug, active.styleName));
      setNotice(t(lang, "downloadReady"));
      track("download", { style: active.styleId });
    } catch {
      setNotice(t(lang, "downloadFailed"));
    }
  }

  function saveCurrentLook() {
    const chosen = chosenNow();
    if (!chosen) {
      setNotice(t(lang, "downloadFailed"));
      return;
    }
    const pick = { tool: chosen.tool, id: chosen.id, name: chosen.name };
    if (!savedPickOn(savedPicks, pick)) keepPick(pick);
    setNotice(t(lang, "lookSaved"));
  }

  const tools: { id: TryTool; label: string; name: string; on: boolean; icon: "style" | "colour" | "brows" | "nails" | "beard" }[] = [
    { id: "style", label: "Style", name: t(lang, "hairStyle"), on: config.toolStyle, icon: "style" },
    { id: "colour", label: "Colour", name: t(lang, "hairColour"), on: config.toolColour, icon: "colour" },
    { id: "brows", label: "Brows", name: t(lang, "brows"), on: config.toolBrows, icon: "brows" },
    { id: "nails", label: "Nails", name: t(lang, "nails"), on: config.toolNails, icon: "nails" },
    { id: "beard", label: "Beard", name: t(lang, "beardChip"), on: config.toolBeard, icon: "beard" },
  ];
  const visibleTools = tools.filter((item) => item.on);
  const joinHref = guestJoinHref({ slug: config.slug, showQueue, bookHref });
  const audiences = (["women", "men", "kids"] as const).filter((item) => (item === "women" ? config.showWomen : item === "men" ? config.showMen : config.showKids));

  const platformLogo = isPlatformLogo(config.logoUrl);
  const salonLocked = gate.locked;
  const lockedBrowse = salonLocked && !cameraOn && !activeShot && !showResult;
  useEffect(() => {
    const node = previewDockRef.current;
    if (!node) return;
    let previewAway = false;
    let footerNear = false;
    const apply = () => {
      const narrow = window.matchMedia("(max-width: 1023px)").matches;
      setMiniPreview(narrow && previewAway && !footerNear);
    };
    const previewObs = new IntersectionObserver(([entry]) => {
      previewAway = !entry.isIntersecting;
      apply();
    }, { threshold: 0.25 });
    previewObs.observe(node);
    const foot = document.querySelector("[data-page-foot]");
    const readFoot = () => {
      const top = foot?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      footerNear = top < window.innerHeight - 4;
      apply();
    };
    readFoot();
    window.addEventListener("scroll", readFoot, { passive: true });
    window.addEventListener("resize", readFoot);
    return () => {
      previewObs.disconnect();
      window.removeEventListener("scroll", readFoot);
      window.removeEventListener("resize", readFoot);
    };
  }, [section, tool, lockedBrowse]);

  function writePicks(next: SavedPick[]) {
    setSavedPicks(next);
    try {
      localStorage.setItem(savedPicksKey(config.slug), JSON.stringify(next));
    } catch {
      /* The list still shows for this visit. */
    }
  }

  function keepPick(pick: SavedPick) {
    writePicks(addSavedPick(savedPicks, pick));
    setSavedFlash(true);
  }

  function dropPick(pick: SavedPick) {
    const previous = savedPicks;
    const next = removeSavedPick(previous, pick);
    setSavedPicks(next);
    setSavedFlash(true);
    const saved = writeSavedPicks(next, (raw) => localStorage.setItem(savedPicksKey(config.slug), raw));
    if (!saved.ok) {
      setSavedPicks(previous);
      setNotice(saved.message || SAVED_DROP_ERROR);
    }
  }

  function toggleCurrentStyle() {
    const chosen = chosenNow();
    if (!chosen) return;
    const pick = { tool: chosen.tool, id: chosen.id, name: chosen.name };
    if (savedPickOn(savedPicks, pick)) dropPick(pick);
    else keepPick(pick);
  }

  function markFor(pick: SavedPick) {
    if (lookFilter !== "saved") return undefined;
    if (!savedPickOn(savedPicks, pick)) return undefined;
    return { removed: false, onKeep: () => keepPick(pick), onDrop: () => dropPick(pick) };
  }

  const chosenLive = chosenNow();
  const chosenSaved = Boolean(chosenLive && savedPickOn(savedPicks, chosenLive));
  const saveNote = savedFlash ? (chosenSaved ? t(lang, "atSalonSaved") : t(lang, "savedRemoved")) : undefined;
  const saveLabels = {
    savedOn: chosenSaved,
    saveLabel: t(lang, "saveThisLook"),
    unsaveLabel: t(lang, "unsaveThisLook"),
    keepLabel: t(lang, "saveThisLook"),
    dropLabel: t(lang, "removeLook"),
    saveNote,
    onSave: toggleCurrentStyle,
  };
  const sameResult = resultReady(chosenLive);
  const tryControls = {
    tryLabel: sameResult ? t(lang, "lookDone") : t(lang, "tryThisLook"),
    tryDisabled: sameResult,
    onTry: () => {
      const chosen = chosenNow();
      if (!chosen || resultReady(chosen)) return;
      selectLook(chosen, true);
    },
  };

  return (
    <div data-salon-mode={salonMode ? "yes" : "no"} data-queue-mode={queueMode} className={embed ? "flex min-h-svh flex-col" : "guest-shell flex min-h-svh w-full flex-col"}>
      <header className={`salon-bar header-metal sticky top-0 z-30 border-b border-white/15 px-4 py-3 ${embed ? "" : "guest-bar-bleed"}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
              {platformLogo ? (
                <LookuviMark className="h-8 w-8" />
              ) : (
                <img src={config.logoUrl || ""} alt="" className="h-8 w-8 object-contain" />
              )}
            </span>
            <h1 className="min-w-0 flex-1 break-words text-lg leading-tight sm:text-xl">{config.name}</h1>
          </div>
          <div className={`${showQueue ? "grid-cols-3" : "grid-cols-2"} grid w-full gap-2 sm:flex sm:w-auto`}>
            {showQueue ? <a className="btn bar-book min-h-11 px-2 text-center text-sm sm:px-4" href={joinHref}>{t(lang, "navToken")}</a> : null}
            {phone ? (
              <>
                <a className="btn bar-book min-h-11 px-2 text-center text-sm sm:px-4" href={bookHref} target="_blank" rel="noreferrer">{t(lang, "bookNow")}</a>
                <a className="btn bar-chat min-h-11 px-2 text-center text-sm sm:px-4" href={chatHref} target="_blank" rel="noreferrer">
                  <WhatsAppIcon />
                  {t(lang, "whatsappBtn")}
                </a>
              </>
            ) : <p className="col-span-2 self-center text-sm leading-snug sm:col-span-1">{t(lang, "whatsappMissing")}</p>}
          </div>
        </div>
      </header>
      <ConsentSheet open={consent.open} lang={lang} onAgree={(ageGate) => { track("consent_accepted", { lang }); void consent.agree(ageGate); }} onClose={consent.close} />
      <div data-scroll="salon" data-mini={miniPreview ? "yes" : "no"} className="flex flex-1 flex-col pt-6">
      {sections.length > 0 ? (
        <div className="mode-tabs mb-4" data-guest-tabs="yes" role="group" aria-label="Look">
          {sections.map((item) => {
            const label = t(lang, item === "everyday" ? "sectionEveryday" : item === "bridal" ? "sectionBridal" : item === "groom" ? "sectionGroom" : "sectionMakeup");
            return (
              <button key={item} type="button" aria-label={label} aria-pressed={section === item} data-active={section === item ? "yes" : "no"} disabled={busy && section !== item} onClick={() => setSection(item)}>
                {label}
              </button>
            );
          })}
        </div>
      ) : null}
      {bridalOn && !BridalPane ? <p className="mt-2 text-sm text-muted">Opening bridal looks…</p> : null}
      {bridalOn && BridalPane ? <BridalPane config={config} /> : null}
      {groomOn && !GroomPane ? <p className="mt-2 text-sm text-muted">Opening groom looks…</p> : null}
      {groomOn && GroomPane ? <GroomPane config={config} /> : null}
      {makeupOn && !MakeupPane ? <p className="mt-2 text-sm text-muted">Opening makeup…</p> : null}
      {makeupOn && MakeupPane ? <MakeupPane config={config} /> : null}
      {bridalOn || groomOn || makeupOn ? null : <>
      <AtSalonNote lang={lang} />

      <div className="try-desk mt-4">
      <div className="try-preview" ref={previewDockRef}>
      <section
        ref={frameRef}
        className={`try-shot ${generatingHere || showResult ? `ai-photo ${showResult ? "is-ready" : "is-working"}${freshGlow ? " is-fresh" : ""}` : "overflow-hidden rounded-[14px] border border-line bg-white shadow-lift"}`}
        aria-label="Photo"
      >
        {(generatingHere || showResult) && <div className="ai-photo-spin" aria-hidden="true" />}
        <div className={busy || showResult ? "ai-photo-inner" : "contents"}>
        {showResult && active ? (
          <div className="relative overflow-hidden">
            <div className={freshGlow ? "gen-reveal" : undefined} style={{ transform: `scale(${zoom})` }}>
              {compareOn ? (
                <BeforeAfter
                  before={active.before}
                  after={active.after}
                  beforeLabel={t(lang, "before")}
                  afterLabel={t(lang, "after")}
                  alignMode={active.alignMode}
                  eyeDelta={active.eyeDelta}
                  lang={lang}
                />
              ) : (
                <div className="relative">
                  <AiGeneratedBadge lang={lang} />
                  <img src={active.after} alt="" className="w-full" />
                </div>
              )}
            </div>
            <StudioRail
              onRetake={() => openCamera(tool === "nails" ? "environment" : "user")}
              onZoomIn={() => setZoom((value) => Math.min(2, Math.round((value + 0.25) * 100) / 100))}
              onZoomOut={() => setZoom((value) => Math.max(1, Math.round((value - 0.25) * 100) / 100))}
              onCompare={() => setCompareOn((value) => !value)}
              compareOn={compareOn}
              onDownload={() => void downloadLook()}
              canDownload
            />
          </div>
        ) : (
          <div className="relative aspect-[3/4] overflow-hidden">
            {cameraOn && (
              <LiveStudio
                videoRef={videoRef}
                ready={cameraReady}
                facing={facing}
                guide={tool === "nails" ? "hand" : "face"}
                zoom={zoom}
                onZoom={setZoom}
                onBack={() => { setZoom(1); stopCamera(); }}
                onClose={() => { setZoom(1); stopCamera(); }}
                onShutter={() => shutter()}
                onRetake={() => { setZoom(1); startCamera(tool === "nails" ? "environment" : "user"); }}
                onUpload={() => { stopCamera(); openFile(); }}
                onDownload={active ? () => void downloadLook() : undefined}
                canDownload={Boolean(active)}
                makeup={tool === "colour" && !salonLocked && modelStatus !== "error" ? (
                  <div className="absolute inset-0">
                    <ColourStage
                      video={videoEl}
                      image={null}
                      shade={shade}
                      intensity={intensity}
                      mirror={false}
                      audience={gender}
                      onStatus={setModelStatus}
                    />
                  </div>
                ) : null}
              />
            )}
            {activeShot && !cameraOn && (
              <div className="absolute inset-0" style={{ transform: `scale(${zoom})` }}>
                <img src={activeShot.url} alt="" className="h-full w-full object-contain" />
              </div>
            )}
            {tool === "colour" && !salonLocked && !cameraOn && !busy && faceShot && modelStatus !== "error" && (
              <div className="absolute inset-0">
                <ColourStage
                  video={null}
                  image={faceShot.el}
                  shade={shade}
                  intensity={intensity}
                  mirror={false}
                  audience={gender}
                  onStatus={setModelStatus}
                />
              </div>
            )}
            {!cameraOn && !activeShot && (
              <div className="absolute inset-0 grid content-center justify-items-center gap-3 px-6">
                <button className="btn sheen min-w-44" type="button" onClick={() => openCamera(tool === "nails" ? "environment" : "user")}>{t(lang, tool === "nails" ? "takeHand" : "takeSelfie")}</button>
                <button className="btn secondary min-w-44" type="button" onClick={() => openFile()}>{t(lang, tool === "nails" ? "uploadHandPhoto" : "uploadPhoto")}</button>
                <p className="max-w-xs text-center text-sm text-muted">
                  {t(lang, "privacyLine")}.{" "}
                  <a className="underline" href="/privacy">Details</a>
                </p>
                {cameraError && <p className="text-center text-sm text-[var(--bad)]" role="alert">{cameraError}</p>}
              </div>
            )}
            {activeShot && !cameraOn && !busy && (
              <StudioRail
                onRetake={() => openCamera(tool === "nails" ? "environment" : "user")}
                onZoomIn={() => setZoom((value) => Math.min(2, Math.round((value + 0.25) * 100) / 100))}
                onZoomOut={() => setZoom((value) => Math.max(1, Math.round((value - 0.25) * 100) / 100))}
                onCompare={() => setCompareOn((value) => !value)}
                compareOn={compareOn}
                onDownload={() => void downloadLook()}
                canDownload={Boolean(active)}
              />
            )}
            {generatingHere && <GeneratingLook tool={busyTool || tool} />}
          </div>
        )}
        </div>
      </section>

      {activeShot && !cameraOn && !showResult ? (
        <div className="mt-3">
          <CropPhotoButton src={activeShot.url} disabled={busy} onApply={(blob) => applyBlob(blob)} />
        </div>
      ) : null}

      {(cameraOn || activeShot || showResult) && (
        <p className="mt-3 text-center text-sm text-muted">
          {t(lang, "privacyLine")}.{" "}
          <a className="underline" href="/privacy">Details</a>
        </p>
      )}

      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        accept="image/*"
        data-photo="gallery"
        aria-label={tool === "nails" ? "Choose a hand photo" : "Choose a selfie file"}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void loadFile(file);
        }}
      />
      <input
        ref={captureRef}
        className="sr-only"
        type="file"
        accept="image/*"
        capture="user"
        tabIndex={-1}
        aria-hidden="true"
        data-photo="camera"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void loadFile(file);
        }}
      />

      {tool === "colour" && faceShot && (
        <label className="mt-3 block px-1 text-sm">
          {t(lang, "intensity")} · {intensity}
          <input className="mt-1 w-full" type="range" min={20} max={100} value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} />
        </label>
      )}
      {error && <p className="mt-3 text-center text-sm text-[var(--bad)]" role="alert">{error}</p>}
      {poseDebug && poseNote && (error || showResult) && <PoseReadout debug={poseNote} />}
      {notice && <p className="mt-3 text-center text-sm" role="status">{notice}</p>}

      {!showResult && !busy && error && (tool === "nails" ? handShot : faceShot) && chosenNow() && (
        <button className="btn mt-4 w-full" type="button" onClick={() => { const chosen = chosenNow(); if (chosen) void preview(chosen); }}>{t(lang, "retry")}</button>
      )}
      {showResult && active && (
        <div className="mt-4 grid gap-2">
          <button className="btn" type="button" data-save-result="yes" onClick={saveCurrentLook}>{t(lang, "downloadLook")}</button>
          {poseDebug && active.raw && (
            <a className="text-center text-sm underline" href={active.raw} target="_blank" rel="noreferrer" data-testid="provider-image">Provider image</a>
          )}
          {phone ? (
            <button className="btn secondary" type="button" onClick={() => void book()}>{t(lang, "bookLook")}</button>
          ) : (
            <p className="text-center text-sm" role="status">{t(lang, "whatsappMissing")}</p>
          )}
          <button className="btn secondary" type="button" onClick={() => resetForAnotherPhoto()}>{t(lang, "tryAnotherShort")}</button>
        </div>
      )}
      </div>
      <div className="try-picks">
      {visibleTools.length > 1 && (
      <div className="tool-row seg-fade">
      <div className="seg" role="tablist" aria-label={t(lang, "toolsLabel")}>
        {visibleTools.map((item) => (
          <button
            key={item.id}
            className="seg-btn"
            type="button"
            role="tab"
            aria-selected={tool === item.id}
            aria-label={item.name}
            onClick={() => {
              setTool(item.id);
              setError("");
              setCameraError("");
              setStyleId(picked[item.id] || looks[item.id]?.styleId || "");
            }}
          >
            <ToolGlyph name={item.icon} />
            {item.label}
          </button>
        ))}
      </div>
      </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        {audiences.length > 1 ? (
          <div className="seg seg-fill min-w-0 flex-1" role="group" aria-label={t(lang, "audienceLabel")}>
            {audiences.map((item) => (
              <button key={item} className="seg-btn" type="button" aria-pressed={gender === item} onClick={() => chooseGender(item)}>
                {t(lang, item)}
              </button>
            ))}
          </div>
        ) : <div className="min-w-0 flex-1" />}
        {tool === "style" ? (
          <button className="btn secondary grid h-11 w-11 shrink-0 place-items-center px-0" type="button" aria-label={t(lang, "filterTitle")} onClick={() => setFiltersOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M2 4h14M4 9h10M7 14h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>
      <section ref={gridRef} className="mt-3" data-style-grid="yes" aria-label={tool === "style" ? t(lang, "styles") : tool === "colour" ? t(lang, "shades") : tool === "brows" ? t(lang, "brows") : tool === "beard" ? t(lang, "beards") : t(lang, "nails")}>
        {tool === "style" && (
          <>
            {config.hairPickerOn && (pickedDensity || pickedTexture) && visibleStyles.length === 0 && (
              <p className="mb-2 text-sm">No style photos for that hair type. Clear filters to see every style.</p>
            )}
            <LookPicker
              key={`style-${gender}`}
              label="styles"
              category={lookFilter}
              selectedId={styleId}
              disabled={busy}
              {...tryControls}
              {...saveLabels}
              items={[
                ...shownStyles.map((style) => {
                  const pick = { tool: "style", id: style.id, name: style.name };
                  return {
                    id: style.id,
                    name: style.name,
                    tags: lookTagsForStyle(style, savedPickOn(savedPicks, pick)),
                    preview: <StyleCard id={style.id} name={style.name} />,
                    mark: markFor(pick),
                  };
                }),
              ]}
              onSelect={(id) => {
                const style = shownStyles.find((item) => item.id === id) || config.styles.find((item) => item.id === id);
                if (style) selectLook({ id: style.id, name: style.name, serviceKeys: style.serviceKeys, tool: "style" });
              }}
            />
            {filtersOpen ? (
              <div className="fixed inset-0 z-[60] grid place-items-end bg-black/40 p-4 sm:place-items-center" role="dialog" aria-label={t(lang, "filterTitle")}>
                <div className="card max-h-[85dvh] w-full max-w-md overflow-y-auto p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-serif text-xl">{t(lang, "filterTitle")}</h3>
                    <button className="btn ghost min-h-11" type="button" onClick={() => setFiltersOpen(false)}>{t(lang, "filterClose")}</button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t(lang, "filterTitle")}>
                    {LOOK_FILTERS.map((item) => (
                      <button key={item.id} className="chip" type="button" aria-pressed={lookFilter === item.id} onClick={() => setLookFilter((current) => current === item.id ? "all" : item.id)}>
                        {t(lang, item.labelKey)}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3">
                    <HairTypePicker
                      pickerOn={config.hairPickerOn}
                      suggestOn={false}
                      usesCredits={config.hairSuggestUsesCredits}
                      density={pickedDensity}
                      texture={pickedTexture}
                      suggestions={hairSuggestions}
                      selectedId={styleId}
                      busy={busy || suggestBusy}
                      note={suggestNote}
                      costLine={suggestCost}
                      onDensity={setPickedDensity}
                      onTexture={setPickedTexture}
                      onSuggest={() => void suggestHair()}
                      suggestLabel={suggestFailed ? "Try again" : "Get AI suggestions"}
                      onPick={(card) => selectLook({ id: card.id, name: card.name, serviceKeys: card.serviceKeys, tool: "style" })}
                    />
                  </div>
                  <button className="btn secondary mt-4 min-h-11" type="button" onClick={() => { setLookFilter("all"); setPickedDensity(""); setPickedTexture(""); }}>{t(lang, "filterClear")}</button>
                </div>
              </div>
            ) : null}
          </>
        )}

        {tool === "colour" && (
          <LookPicker
            key="colour"
            label="shades"
            selectedId={shadeId}
            disabled={busy}
            {...tryControls}
            items={config.shades.map((item) => ({
              id: item.id,
              name: item.name,
              tags: savedPicks.some((pick) => pick.tool === "colour" && pick.id === item.id) ? ["saved"] : [],
              preview: <span className="block h-16 w-full" style={{ background: item.hex }} />,
            }))}
            onSelect={(id) => pickShade(id)}
              {...saveLabels}
          />
        )}

        {tool === "brows" && (
          <>
          <LookPicker
            key="brows"
            label="brows"
            selectedId={styleId}
            disabled={busy}
            {...tryControls}
            items={browList.map((brow) => ({
              id: brow.id,
              name: brow.name,
              meta: brow.audience === "men" ? "Men" : brow.audience === "women" ? "Women" : "Unisex",
              tags: savedPicks.some((pick) => pick.tool === "brows" && pick.id === brow.id) ? ["saved"] : [],
              preview: <BrowCard id={brow.id} name={brow.name} />,
            }))}
            onSelect={(id) => {
              const brow = browList.find((item) => item.id === id);
              if (brow) selectLook({ id: brow.id, name: brow.name, serviceKeys: brow.serviceKeys, tool: "brows" });
            }}
              {...saveLabels}
          />
          </>
        )}

        {tool === "beard" && (
          <LookPicker
            key="beard"
            label="beards"
            selectedId={styleId}
            disabled={busy}
            {...tryControls}
            items={config.beards.map((beard) => ({
              id: beard.id,
              name: beard.name,
              tags: savedPicks.some((pick) => pick.tool === "beard" && pick.id === beard.id) ? ["saved"] : [],
              preview: <StyleCard id={beard.id} name={beard.name} folder="beards" />,
            }))}
            onSelect={(id) => {
              const beard = config.beards.find((item) => item.id === id);
              if (beard) selectLook({ id: beard.id, name: beard.name, serviceKeys: beard.serviceKeys, tool: "beard" });
            }}
              {...saveLabels}
          />
        )}

        {tool === "nails" && (
          <LookPicker
            key="nails"
            label="nails"
            selectedId={styleId}
            disabled={busy}
            {...tryControls}
            items={config.nails.map((nail) => ({
              id: nail.id,
              name: nail.name,
              tags: savedPicks.some((pick) => pick.tool === "nails" && pick.id === nail.id) ? ["saved"] : [],
              preview: <StyleCard id={nail.id} name={nail.name} folder="nails" />,
            }))}
            onSelect={(id) => {
              const nail = config.nails.find((item) => item.id === id);
              if (nail) selectLook({ id: nail.id, name: nail.name, serviceKeys: nail.serviceKeys, tool: "nails" });
            }}
              {...saveLabels}
          />
        )}
      </section>
      </div>
      </div>
      <AtSalonSheet
        open={gate.open}
        lang={lang}
        joinHref={showQueue ? joinHref : undefined}
        onClose={gate.close}
        onSave={chosenNow() ? toggleCurrentStyle : undefined}
        saveLabel={chosenNow() ? (chosenSaved ? t(lang, "unsaveThisLook") : t(lang, "saveThisLook")) : undefined}
      />
      </>}
      <div data-page-foot="yes">
      <LegalFooter className="mt-auto px-0 pb-2" />
      </div>
      </div>
      {embed ? null : <GuestNav slug={config.slug} lang={lang} current="try" />}
    </div>
  );
}

function ToolGlyph({ name }: { name: "style" | "colour" | "brows" | "nails" | "beard" }) {
  const common = { viewBox: "0 0 24 24", className: "h-5 w-5 shrink-0", "aria-hidden": true } as const;
  if (name === "colour") {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M12 2.4c.4 0 .8.3 1 .7 1.6 3.2 5.2 7.2 5.2 11a6.2 6.2 0 0 1-12.4 0c0-3.8 3.6-7.8 5.2-11 .2-.4.6-.7 1-.7z" />
        <path fill="#B6A0C9" d="M8.4 13.2a2.1 2.1 0 0 0 2.2 3.2 5 5 0 0 1-2.2-3.2z" />
      </svg>
    );
  }
  if (name === "brows") {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M2.4 15.6c1.2-1.2 2.6-3.2 4.2-4.6 1.8-1.6 3.6-2.4 5.4-2.4 2.2 0 4.2 1 6.2 3.2 1.2 1.3 2.2 2.2 3.4 2.6-.6 1.2-2.2.6-3.6-.6-1.6-1.4-3.2-2.2-5-2.2-1.4 0-2.8.6-4.2 1.8-1.2 1-2.2 2.2-3 3.2-1 .4-2.2.2-3.4-1z" />
        <path fill="#B6A0C9" d="M6.2 13.2c1.4-1.2 2.8-2 4.4-2 1.2 0 2.4.4 3.6 1.4-.8.6-1.8 1-2.8 1-1.2 0-2.4-.6-3.4-1.6-.6.2-1.2.6-1.8 1.2z" />
      </svg>
    );
  }
  if (name === "nails") {
    return (
      <svg {...common}>
        <rect x="9" y="2.2" width="6" height="3.2" rx="1.2" fill="#B6A0C9" />
        <rect x="8.2" y="5" width="7.6" height="2.2" rx="0.6" fill="currentColor" />
        <path fill="currentColor" d="M7.2 8.2h9.6c.6 0 1 .5.9 1.1l-.8 8.2A3.2 3.2 0 0 1 13.7 20.4h-3.4a3.2 3.2 0 0 1-3.2-2.9l-.8-8.2c-.1-.6.3-1.1.9-1.1z" />
        <path fill="#B6A0C9" d="M8.4 13.2h7.2l-.4 4.2a1.8 1.8 0 0 1-1.8 1.6h-2.8a1.8 1.8 0 0 1-1.8-1.6l-.4-4.2z" />
      </svg>
    );
  }
  if (name === "beard") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8.2" r="3.6" fill="currentColor" />
        <path fill="currentColor" d="M5.6 13.4c.4 4.6 2.8 8.2 6.4 8.2s6-3.6 6.4-8.2c-1.6 1.8-3.8 2.8-6.4 2.8s-4.8-1-6.4-2.8z" />
        <path fill="#B6A0C9" d="M8.2 15.2c.8 2.2 2.2 3.4 3.8 3.4s3-1.2 3.8-3.4c-1 .8-2.3 1.2-3.8 1.2s-2.8-.4-3.8-1.2z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path fill="currentColor" fillRule="evenodd" d="M7.1 13.6a3.3 3.3 0 1 0 .2 4.7 3.3 3.3 0 0 0-.2-4.7zm.7 1.6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM16.9 13.6a3.3 3.3 0 1 0 .2 4.7 3.3 3.3 0 0 0-.2-4.7zm.7 1.6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
      <path fill="currentColor" d="M8.6 13.2 16.4 4.2c.4-.5 1.1-.5 1.5.1.3.5.2 1.2-.3 1.6l-7.6 8.6c-.5.5-1.3.4-1.7-.2-.3-.4-.2-.9.3-1.1z" />
      <path fill="currentColor" d="M15.4 13.2 7.6 4.2c-.4-.5-1.1-.5-1.5.1-.3.5-.2 1.2.3 1.6l7.6 8.6c.5.5 1.3.4 1.7-.2.3-.4.2-.9-.3-1.1z" />
      <circle cx="12" cy="12.2" r="1.5" fill="#B6A0C9" />
    </svg>
  );
}
