export {
  EYE_IDS,
  FINISH_IDS,
  LIP_IDS,
  MAKEUP_STUDIO_KIND,
  MAKEUP_STUDIO_TOOL,
  PRESET_IDS,
  QUALITY_IDS,
} from "@/lib/makeup-studio/core/types";
export type {
  EyeStyle,
  FacePoint,
  Finish,
  LipId,
  LookParams,
  LookPresetId,
  Quality,
} from "@/lib/makeup-studio/core/types";

export {
  BLUSH_HEX,
  EYE_LOOKS,
  FINISH_LOOKS,
  LINER_HEX,
  LIP_SHADES,
  MATTE_VEIL,
  SHEEN_HEX,
  hexRgb,
} from "@/lib/makeup-studio/core/palette";
export type { EyeLook, FinishLook, LipShade } from "@/lib/makeup-studio/core/palette";

export {
  BROW_LEFT,
  BROW_RIGHT,
  CHEEK_LEFT,
  CHEEK_RIGHT,
  CHIN,
  EYE_OPEN_LEFT,
  EYE_OPEN_RIGHT,
  FACE_EDGE_LEFT,
  FACE_EDGE_RIGHT,
  FOREHEAD,
  LASH_LOWER_LEFT,
  LASH_LOWER_RIGHT,
  LASH_UPPER_LEFT,
  LASH_UPPER_RIGHT,
  LIP_INNER,
  LIP_LOWER,
  LIP_OUTER,
  NOSE_BRIDGE,
  NOSE_TIP,
  REGION_RINGS,
  SHADOW_LEFT,
  SHADOW_RIGHT,
  SKIN_OVAL,
} from "@/lib/makeup-studio/core/regions";

export { DEFAULT_LOOK, LOOK_PRESETS, PRESET_LIST } from "@/lib/makeup-studio/core/presets";
export type { LookPreset } from "@/lib/makeup-studio/core/presets";

export { applyPreset, clampLook, clampSlider, matchingPreset, paintRecipe, qualitySpec } from "@/lib/makeup-studio/core/params";
export type { PaintRecipe, QualitySpec } from "@/lib/makeup-studio/core/params";

export { buildMakeupPrompt } from "@/lib/makeup-studio/core/prompt";
export { faceWidthPx, pointPx } from "@/lib/makeup-studio/core/geometry";
