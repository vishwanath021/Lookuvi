/**
 * Photo makeup studio types.
 * This folder is plain TypeScript so the Bride Look Expo app can copy it.
 * No React, DOM, Node, or network calls.
 */

export const LIP_IDS = ["nude", "rose", "coral", "berry", "wine", "red", "plum"] as const;
export const EYE_IDS = ["natural", "smokey", "bridal", "cut-crease", "glam"] as const;
export const FINISH_IDS = ["matte", "dewy", "glass", "satin"] as const;
export const QUALITY_IDS = ["fast", "balanced", "high"] as const;
export const PRESET_IDS = ["bridal", "reception", "party", "natural", "glam", "editorial", "telugu-bridal"] as const;

export type LipId = (typeof LIP_IDS)[number];
export type EyeStyle = (typeof EYE_IDS)[number];
export type Finish = (typeof FINISH_IDS)[number];
export type Quality = (typeof QUALITY_IDS)[number];
export type LookPresetId = (typeof PRESET_IDS)[number];

/** One still-photo look. Sliders are 0–100. */
export type LookParams = {
  foundation: number;
  blush: number;
  intensity: number;
  lip: LipId;
  eyes: EyeStyle;
  finish: Finish;
  quality: Quality;
  gloss: boolean;
};

export type FacePoint = { x: number; y: number; z?: number };

export const MAKEUP_STUDIO_KIND = "MAKEUP_STUDIO";
export const MAKEUP_STUDIO_TOOL = "makeup";
