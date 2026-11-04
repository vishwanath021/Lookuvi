import { falPriceListUsd, flux3UsdForResolution } from "@/lib/ai/cost-source";
import { GUEST_FAL_MODEL, GUEST_MODEL_OPTIONS, GUEST_OPENAI_MODEL, type GuestModelId } from "@/lib/ai/guest-models";
import { SUNBURST_TEXT_INPUT_TOKENS, sunburstImageInputTokens, sunburstOutputTokens } from "@/lib/ai/sunburst-tokens";
import { exactInr, usdFromTokenCounts } from "@/lib/ai/tiers";

/** Guest portrait fal edits are quoted at this output. Flux-2 also bills two 1MP inputs. */
const FAL_OUTPUT = { width: 1024, height: 1536 };
/** Live sunburst medium bill was this frame: about $0.032. */
const SUNBURST_FRAME = { width: 1024, height: 1360 };

export type GuestPriceRow = {
  id: GuestModelId;
  label: string;
  usd: number;
  inr: number;
  detail: string;
};

function falPortraitUsd(id: string, withInputs: boolean) {
  const priced = falPriceListUsd({
    model: id,
    outputWidth: FAL_OUTPUT.width,
    outputHeight: FAL_OUTPUT.height,
    inputs: withInputs
      ? [{ width: 1024, height: 1024 }, { width: 1024, height: 1024 }]
      : undefined,
  });
  return priced?.usd ?? 0;
}

function priceOne(id: GuestModelId): Pick<GuestPriceRow, "usd" | "inr" | "detail"> {
  if (id === GUEST_OPENAI_MODEL) {
    const textIn = SUNBURST_TEXT_INPUT_TOKENS;
    const imageIn = sunburstImageInputTokens(SUNBURST_FRAME.width, SUNBURST_FRAME.height);
    const output = sunburstOutputTokens("medium", SUNBURST_FRAME.width, SUNBURST_FRAME.height);
    const usd = usdFromTokenCounts(id, { textIn, imageIn, output }) ?? 0;
    return {
      usd,
      inr: exactInr(usd),
      detail: "medium 1024×1360. A live bill of this frame was about $0.032.",
    };
  }
  if (id === GUEST_FAL_MODEL) {
    const usd = flux3UsdForResolution("1k");
    return { usd, inr: exactInr(usd), detail: "1k portrait, output megapixels only" };
  }
  if (id === "meta/muse-image/edit") {
    return { usd: 0.01, inr: exactInr(0.01), detail: "$0.01 per image" };
  }
  if (id === "bytedance/seedream/v5/lite/edit") {
    return { usd: 0.035, inr: exactInr(0.035), detail: "$0.035 per image" };
  }
  if (id === "fal-ai/flux-2/edit") {
    const usd = falPortraitUsd(id, true);
    return { usd, inr: exactInr(usd), detail: "1024×1536 output plus two 1MP inputs at $0.012/MP" };
  }
  const usd = falPortraitUsd(id, false);
  const rate = id === "fal-ai/qwen-image-edit-2511" ? "$0.03" : "$0.01";
  return { usd, inr: exactInr(usd), detail: `1024×1536 output at ${rate}/MP` };
}

/** One row per selectable guest model. INR uses FX_INR_PER_USD with no 8% buffer. */
export function guestModelPriceRows(): GuestPriceRow[] {
  return GUEST_MODEL_OPTIONS.map((row) => ({ id: row.id, label: row.label, ...priceOne(row.id) }));
}
