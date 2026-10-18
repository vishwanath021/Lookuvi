import { describe, expect, it } from "vitest";
import { quoteComparisonModel } from "@/lib/ai/compare-models";
import { quoteOwnLook } from "@/lib/bridal-own";
import { sunburstImageInputTokens, sunburstOutputTokens } from "@/lib/ai/sunburst-tokens";
import { bufferedInr, costUsdFromUsage, exactInr, providerUsageLog, usdFromTokenCounts } from "@/lib/ai/tiers";

/** Live Sunburst medium 1024×1360 edit: 397 text in, 2400 image in, 367 out. */
const LIVE = { textTokens: 397, imageTokens: 2400, outputTokens: 367 };
const LIVE_USD = 0.032195;
const LIVE_INR = 3.09;

describe("sunburst cost estimate", () => {
  it("prices the live usage at $0.032195 and Rs 3.09", () => {
    const usd = costUsdFromUsage("gpt-image-2.5-sunburst", LIVE);
    expect(usd).toBe(LIVE_USD);
    expect(exactInr(usd!)).toBe(LIVE_INR);
    const log = providerUsageLog("gpt-image-2.5-flare", LIVE);
    expect(log).toMatchObject({ known: true, costUsd: LIVE_USD, pictureIn: 2400, pictureOut: 367, textCount: 397 });
  });

  it("quotes a medium 1024x1360 edit within 10% of that live bill", () => {
    const quote = quoteComparisonModel("gpt-image-2.5-sunburst", 768, 1024, { width: 512, height: 512 }, "medium");
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;
    expect(quote.size).toBe("1024x1360");
    expect(quote.quality).toBe("medium");
    expect(quote.imageInputTokens).toBe(2400);
    expect(quote.textInputTokens).toBe(400);
    expect(quote.outputTokens).toBe(381);
    expect(Math.abs(quote.estimateUsd - LIVE_USD) / LIVE_USD).toBeLessThan(0.1);
    expect(quote.estimateUsd).toBe(0.03263);
    expect(quote.estimateInr).toBe(bufferedInr(quote.estimateUsd));
    expect(quote.estimateInr).toBe(3.4);
    expect(quote.estimateInr).toBeLessThan(14.9);
  });

  it("changes the quote with size and quality", () => {
    expect(sunburstOutputTokens("low", 1024, 1024)).toBe(196);
    expect(sunburstOutputTokens("medium", 1024, 1024)).toBe(439);
    expect(sunburstOutputTokens("high", 1024, 1024)).toBe(1756);
    const landscape = sunburstOutputTokens("medium", 1536, 1024);
    expect(landscape).toBe(358);
    expect(Math.abs(landscape - 343) / 343).toBeLessThan(0.1);
    const frame = sunburstOutputTokens("medium", 1024, 1360);
    expect(frame).toBe(381);
    expect(Math.abs(frame - LIVE.outputTokens) / LIVE.outputTokens).toBeLessThan(0.1);
    expect(sunburstOutputTokens("low", 1024, 1360)).toBeLessThan(frame);
    expect(sunburstOutputTokens("high", 1024, 1360)).toBeGreaterThan(frame);
    expect(frame).toBeLessThan(sunburstOutputTokens("medium", 1024, 1024));
    expect(sunburstImageInputTokens(1024, 1360)).toBe(LIVE.imageTokens);
    expect(sunburstImageInputTokens(1024, 1024)).toBe(1600);
    expect(sunburstImageInputTokens(1536, 1024)).toBe(2400);
    expect(sunburstImageInputTokens(1024, 1824)).toBe(3200);

    const square = quoteComparisonModel("gpt-image-2.5-sunburst", 1024, 1024, { width: 512, height: 512 }, "medium");
    const wide = quoteComparisonModel("gpt-image-2.5-flare", 1536, 1024, { width: 512, height: 512 }, "medium");
    const high = quoteComparisonModel("gpt-image-2.5-sunburst", 768, 1024, { width: 512, height: 512 }, "high");
    const low = quoteComparisonModel("gpt-image-2.5-flare", 768, 1024, { width: 512, height: 512 }, "low");
    expect(square.ok && wide.ok && high.ok && low.ok).toBe(true);
    if (!square.ok || !wide.ok || !high.ok || !low.ok) return;
    expect(square.size).toBe("1024x1024");
    expect(wide.size).toBe("1536x1024");
    expect(square.imageInputTokens).toBe(1600);
    expect(wide.imageInputTokens).toBe(2400);
    expect(square.estimateUsd).not.toBe(wide.estimateUsd);
    expect(low.estimateUsd).toBeLessThan(0.03263);
    expect(high.estimateUsd).toBeGreaterThan(0.03263);
    expect(high.outputTokens).toBeGreaterThan(low.outputTokens);
  });

  it("quotes a bridal own look from the real 6-item bill and scales with item count", () => {
    const one = quoteOwnLook({
      prompt: "Image 1 is the bride.",
      size: "1024x1360",
      selfiePixels: 1024 * 1360,
      itemPixels: [512 * 512],
    });
    const six = quoteOwnLook({
      prompt: "Image 1 is the bride.",
      size: "1024x1360",
      selfiePixels: 1024 * 1360,
      itemPixels: Array.from({ length: 6 }, () => 512 * 512),
    });
    const none = quoteOwnLook({
      prompt: "Image 1 is the bride.",
      size: "1024x1360",
      selfiePixels: 1024 * 1360,
      itemPixels: [],
    });
    expect(one.ok && six.ok && none.ok).toBe(true);
    if (!one.ok || !six.ok || !none.ok) return;
    expect(one.quote.textInputTokens).toBe(600);
    expect(one.quote.imageInputTokens).toBe(1250 + 650);
    expect(one.quote.outputTokens).toBe(370);
    expect(one.quote.estimateUsd).toBe(usdFromTokenCounts("gpt-image-2.5-sunburst", { textIn: 600, imageIn: 1900, output: 370 }));
    expect(six.quote.imageInputTokens).toBe(1250 + 6 * 650);
    expect(six.quote.estimateUsd).toBe(0.0553);
    expect(exactInr(six.quote.estimateUsd)).toBe(5.31);
    expect(six.quote.estimateInr).toBe(bufferedInr(0.0553));
    expect(six.quote.estimateUsd).toBeGreaterThan(one.quote.estimateUsd);
    expect(one.quote.estimateUsd).toBeGreaterThan(none.quote.estimateUsd);
  });
});
