import type { LookParams, LookPresetId } from "@/lib/makeup-studio/core/types";
import { PRESET_IDS } from "@/lib/makeup-studio/core/types";

export type LookPreset = {
  id: LookPresetId;
  name: string;
  line: string;
  params: LookParams;
};

/**
 * One tap sets every look field, including finish, lip, eyes, gloss, and the three sliders.
 * Numbers are our own. Quality stays on Balanced so a tap is about the look, and the guest can still change it.
 */
export const LOOK_PRESETS: Record<LookPresetId, LookPreset> = {
  bridal: {
    id: "bridal",
    name: "Bridal",
    line: "Wine lip, bronze eye, dewy base",
    params: { foundation: 66, blush: 46, intensity: 82, lip: "wine", eyes: "bridal", finish: "dewy", quality: "balanced", gloss: false },
  },
  reception: {
    id: "reception",
    name: "Reception",
    line: "Berry lip, smokey eye, satin",
    params: { foundation: 58, blush: 40, intensity: 78, lip: "berry", eyes: "smokey", finish: "satin", quality: "balanced", gloss: true },
  },
  party: {
    id: "party",
    name: "Party",
    line: "Coral lip, glam eye, dewy",
    params: { foundation: 50, blush: 68, intensity: 88, lip: "coral", eyes: "glam", finish: "dewy", quality: "balanced", gloss: true },
  },
  natural: {
    id: "natural",
    name: "Natural",
    line: "Nude lip, light eye, glass skin",
    params: { foundation: 26, blush: 22, intensity: 64, lip: "nude", eyes: "natural", finish: "glass", quality: "balanced", gloss: false },
  },
  glam: {
    id: "glam",
    name: "Glam",
    line: "Red lip, glam eye, matte",
    params: { foundation: 72, blush: 54, intensity: 90, lip: "red", eyes: "glam", finish: "matte", quality: "balanced", gloss: true },
  },
  editorial: {
    id: "editorial",
    name: "Editorial",
    line: "Plum lip, cut crease, matte",
    params: { foundation: 56, blush: 30, intensity: 84, lip: "plum", eyes: "cut-crease", finish: "matte", quality: "balanced", gloss: false },
  },
  "telugu-bridal": {
    id: "telugu-bridal",
    name: "Telugu bridal",
    line: "Temple red lip, bronze eye, dewy base",
    params: { foundation: 70, blush: 38, intensity: 86, lip: "red", eyes: "bridal", finish: "dewy", quality: "balanced", gloss: false },
  },
};

export const PRESET_LIST: LookPreset[] = PRESET_IDS.map((id) => LOOK_PRESETS[id]);

export const DEFAULT_LOOK: LookParams = { ...LOOK_PRESETS.natural.params };
