import type { EyeStyle, Finish, LipId } from "@/lib/makeup-studio/core/types";

export type LipShade = { id: LipId; name: string; hex: string; phrase: string };
export type EyeLook = {
  id: EyeStyle;
  name: string;
  phrase: string;
  shadow: string;
  lid: string;
  /** Multiply strength before the global intensity curve. */
  alpha: number;
  liner: number;
  lash: number;
  cut: boolean;
};
export type FinishLook = {
  id: Finish;
  name: string;
  phrase: string;
  /** Screen highlight strength before the intensity curve. */
  highlight: number;
  /** Multiply veil strength before the intensity curve. */
  matte: number;
};

/** Lookuvi lip colours. Chosen for this studio, not taken from another product. */
export const LIP_SHADES: Record<LipId, LipShade> = {
  nude: { id: "nude", name: "Nude", hex: "#C9A08C", phrase: "a warm beige lip close to her own lip colour" },
  rose: { id: "rose", name: "Rose", hex: "#D4899A", phrase: "a muted rose lip" },
  coral: { id: "coral", name: "Coral", hex: "#E07A62", phrase: "a sunlit coral lip" },
  berry: { id: "berry", name: "Berry", hex: "#9E3D5A", phrase: "a crushed berry lip" },
  wine: { id: "wine", name: "Wine", hex: "#7C2E45", phrase: "an evening wine lip" },
  red: { id: "red", name: "Red", hex: "#C4453A", phrase: "a temple red lip" },
  plum: { id: "plum", name: "Plum", hex: "#6E3B5C", phrase: "an inked plum lip" },
};

export const EYE_LOOKS: Record<EyeStyle, EyeLook> = {
  natural: {
    id: "natural",
    name: "Natural",
    phrase: "a soft taupe wash, a thin line, and short lashes",
    shadow: "#A6846A",
    lid: "#C4A48A",
    alpha: 0.34,
    liner: 0.72,
    lash: 0.55,
    cut: false,
  },
  smokey: {
    id: "smokey",
    name: "Smokey",
    phrase: "charcoal brown smoked through the crease, a darker line, and longer lashes",
    shadow: "#3F3330",
    lid: "#3F3330",
    alpha: 0.62,
    liner: 1.12,
    lash: 1.05,
    cut: false,
  },
  bridal: {
    id: "bridal",
    name: "Bridal",
    phrase: "warm bronze on the lid, a soft wing, and defined lashes",
    shadow: "#9A6840",
    lid: "#C48A55",
    alpha: 0.48,
    liner: 1,
    lash: 0.92,
    cut: false,
  },
  "cut-crease": {
    id: "cut-crease",
    name: "Cut crease",
    phrase: "a deeper crease against a lighter lid, with a sharp line",
    shadow: "#5A3048",
    lid: "#E6C2B0",
    alpha: 0.56,
    liner: 1.08,
    lash: 0.96,
    cut: true,
  },
  glam: {
    id: "glam",
    name: "Glam",
    phrase: "rich bronze, a lifted wing, and full lashes",
    shadow: "#7A542C",
    lid: "#C4894A",
    alpha: 0.58,
    liner: 1.18,
    lash: 1.16,
    cut: false,
  },
};

export const FINISH_LOOKS: Record<Finish, FinishLook> = {
  matte: { id: "matte", name: "Matte", phrase: "a soft matte finish with the shine taken down", highlight: 0, matte: 0.18 },
  dewy: { id: "dewy", name: "Dewy", phrase: "a dewy finish with light on the high points of the face", highlight: 0.36, matte: 0 },
  glass: { id: "glass", name: "Glass skin", phrase: "glass skin with a clear highlight on the nose, cheeks, and forehead", highlight: 0.52, matte: 0 },
  satin: { id: "satin", name: "Satin", phrase: "a satin finish, smooth with only a little shine", highlight: 0.2, matte: 0.05 },
};

/** Cheek colour for the local renderer. */
export const BLUSH_HEX = "#D47888";
/** Multiply veil used by the matte finish. */
export const MATTE_VEIL = "#E7D5C8";
/** Screen colour for dewy, glass, and satin highlights. */
export const SHEEN_HEX = "#FFF3E6";
/** Liner and lash colour. */
export const LINER_HEX = "#241816";

export function hexRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  if (!Number.isFinite(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
