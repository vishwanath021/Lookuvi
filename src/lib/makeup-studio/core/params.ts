import { EYE_LOOKS, FINISH_LOOKS, LIP_SHADES } from "@/lib/makeup-studio/core/palette";
import { DEFAULT_LOOK, LOOK_PRESETS } from "@/lib/makeup-studio/core/presets";
import {
  EYE_IDS,
  FINISH_IDS,
  LIP_IDS,
  PRESET_IDS,
  QUALITY_IDS,
  type EyeStyle,
  type Finish,
  type LipId,
  type LookParams,
  type LookPresetId,
  type Quality,
} from "@/lib/makeup-studio/core/types";

export type QualitySpec = {
  maxEdge: number;
  /** Feather radius as a fraction of face width. */
  feather: number;
  /** Foundation blur radius as a fraction of face width. */
  blur: number;
};

export type PaintRecipe = {
  coverage: number;
  blushAlpha: number;
  shadowAlpha: number;
  linerWidth: number;
  lashLength: number;
  lowerLash: boolean;
  cut: boolean;
  lipMultiply: number;
  lipSoft: number;
  gloss: number;
  highlight: number;
  matte: number;
  blurPx: number;
  featherPx: number;
  shadow: string;
  lid: string;
  lip: string;
};

function asId<T extends string>(value: unknown, ids: readonly T[], fallback: T): T {
  return typeof value === "string" && (ids as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function clampSlider(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.min(100, Math.max(0, n)));
}

/** Drop unknown fields and keep every number inside 0–100. */
export function clampLook(input: unknown): LookParams {
  const raw = input && typeof input === "object" ? (input as Partial<LookParams>) : {};
  return {
    foundation: clampSlider(raw.foundation, DEFAULT_LOOK.foundation),
    blush: clampSlider(raw.blush, DEFAULT_LOOK.blush),
    intensity: clampSlider(raw.intensity, DEFAULT_LOOK.intensity),
    lip: asId<LipId>(raw.lip, LIP_IDS, DEFAULT_LOOK.lip),
    eyes: asId<EyeStyle>(raw.eyes, EYE_IDS, DEFAULT_LOOK.eyes),
    finish: asId<Finish>(raw.finish, FINISH_IDS, DEFAULT_LOOK.finish),
    quality: asId<Quality>(raw.quality, QUALITY_IDS, DEFAULT_LOOK.quality),
    gloss: raw.gloss === true,
  };
}

export function applyPreset(id: LookPresetId): LookParams {
  const preset = LOOK_PRESETS[id];
  return { ...preset.params };
}

export function matchingPreset(params: LookParams): LookPresetId | null {
  const look = clampLook(params);
  for (const id of PRESET_IDS) {
    const other = LOOK_PRESETS[id].params;
    const same = (Object.keys(other) as (keyof LookParams)[]).every((key) => look[key] === other[key]);
    if (same) return id;
  }
  return null;
}

export function qualitySpec(quality: Quality): QualitySpec {
  if (quality === "fast") return { maxEdge: 720, feather: 0.008, blur: 0.012 };
  if (quality === "high") return { maxEdge: 1800, feather: 0.022, blur: 0.02 };
  return { maxEdge: 1200, feather: 0.016, blur: 0.018 };
}

function curve(intensity: number) {
  return 0.4 + 0.6 * (intensity / 100);
}

/** Strengths for one draw. Face width is in pixels so blur and lashes scale with the face. */
export function paintRecipe(params: LookParams, faceWidthPx: number): PaintRecipe {
  const look = clampLook(params);
  const eye = EYE_LOOKS[look.eyes];
  const finish = FINISH_LOOKS[look.finish];
  const span = Math.max(8, faceWidthPx);
  const mix = curve(look.intensity);
  const spec = qualitySpec(look.quality);
  return {
    coverage: Math.min(0.72, (look.foundation / 100) * (0.45 + 0.55 * (look.intensity / 100))),
    blushAlpha: Math.min(0.5, (look.blush / 100) * 0.55 * mix),
    shadowAlpha: Math.min(0.7, eye.alpha * (0.45 + 0.55 * (look.intensity / 100))),
    linerWidth: Math.max(1.1, span * 0.0075 * eye.liner),
    lashLength: span * 0.034 * eye.lash,
    lowerLash: eye.lash >= 1,
    cut: eye.cut,
    lipMultiply: Math.min(0.8, 0.72 * mix),
    lipSoft: Math.min(0.5, 0.42 * (look.intensity / 100)),
    gloss: look.gloss ? Math.min(0.55, 0.28 + 0.22 * (look.intensity / 100)) : 0,
    highlight: finish.highlight * (0.5 + 0.5 * (look.intensity / 100)),
    matte: finish.matte * (0.55 + 0.45 * (look.intensity / 100)),
    blurPx: Math.max(1, span * spec.blur),
    featherPx: Math.max(0.6, span * spec.feather),
    shadow: eye.shadow,
    lid: eye.lid,
    lip: LIP_SHADES[look.lip].hex,
  };
}
