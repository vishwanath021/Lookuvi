import { describe, expect, it } from "vitest";
import { guestModelPriceRows } from "@/lib/ai/guest-prices";
import { GUEST_MODEL_OPTIONS } from "@/lib/ai/guest-models";
import { exactInr } from "@/lib/ai/tiers";

describe("guest model prices", () => {
  it("lists every selectable model from the live sunburst bill and fal pages", () => {
    const rows = guestModelPriceRows();
    expect(rows.map((row) => row.id)).toEqual(GUEST_MODEL_OPTIONS.map((row) => row.id));
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect(byId["gpt-image-2.5-sunburst"]?.usd).toBe(0.03263);
    expect(byId["gpt-image-2.5-sunburst"]?.inr).toBe(exactInr(0.03263));
    expect(byId["gpt-image-2.5-sunburst"]?.inr).toBeLessThan(7);
    expect(byId["meta/muse-image/edit"]?.usd).toBe(0.01);
    expect(byId["meta/muse-image/edit"]?.inr).toBe(exactInr(0.01));
    expect(byId["bytedance/seedream/v5/lite/edit"]?.usd).toBe(0.035);
    expect(byId["fal-ai/qwen-image-edit-2511"]?.inr).toBe(exactInr(byId["fal-ai/qwen-image-edit-2511"]!.usd));
    expect(byId["fal-ai/flux-2/edit"]?.usd).toBeGreaterThan(byId["fal-ai/flux-2/klein/4b/edit"]!.usd);
    expect(byId["blackforestlabs/flux-3/edit-image"]?.usd).toBeGreaterThan(0.04);
    for (const row of rows) expect(row.inr).toBe(exactInr(row.usd));
  });
});
