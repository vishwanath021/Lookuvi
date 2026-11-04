/**
 * Planning rates for cost maths when a call has no token quote.
 * The AI settings card does not read this list. It prices every selectable guest model from the provider pages and FX_INR_PER_USD.
 * A ledger row with a provider actual replaces these figures for that image.
 * Calibration tiers are not on this list.
 */
export type ModelPrice = {
  id: string;
  provider: "openai" | "fal";
  label: string;
  model: string;
  quality: string;
  inrPerImage: number;
  role: "primary" | "fallback";
};

export const MODEL_PRICES: ModelPrice[] = [
  {
    id: "openai-sunburst-medium",
    provider: "openai",
    label: "OpenAI",
    model: "gpt-image-2.5-sunburst",
    quality: "medium",
    inrPerImage: 7,
    role: "primary",
  },
  {
    id: "fal-flux-3",
    provider: "fal",
    label: "fal",
    model: "FLUX.3",
    quality: "standard",
    inrPerImage: 4,
    role: "fallback",
  },
];

export function listedInr(provider: string, quality: string) {
  const row = MODEL_PRICES.find((item) => item.provider === provider && item.quality === quality);
  return row ? row.inrPerImage : null;
}
