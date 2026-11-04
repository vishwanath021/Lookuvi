import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { SuperAiForm } from "@/components/admin/SuperAiForm";
import { falPriceListUsd } from "@/lib/ai/cost-source";
import { buildFalEditBody, closestMuseAspect, falUsdRange } from "@/lib/ai/fal-models";
import { DEFAULT_GUEST_MODEL, GUEST_MODEL_OPTIONS, parseGuestModel, readGuestModel, saveGuestModel } from "@/lib/ai/guest-hairstyle";
import { guestModelPriceRows } from "@/lib/ai/guest-prices";
import { resolveFalKey } from "@/lib/ai/credentials";
import { saveFalKey } from "@/lib/ai/settings-store";
import { prisma } from "@/lib/prisma";

describe("guest hairstyle models", () => {
  afterEach(async () => {
    await prisma.platformSetting.deleteMany({
      where: { key: { in: ["guest_hairstyle_model", "guest_hairstyle_engine", "platform_fal_key_cipher", "platform_fal_key_hint", "platform_fal_enabled"] } },
    });
    await prisma.auditLog.deleteMany({ where: { action: { in: ["GUEST_MODEL", "GUEST_ENGINE", "AI_KEY_UPDATE"] } } });
    delete process.env.FAL_KEY;
  });

  it("keeps sunburst unless a listed model is saved", async () => {
    expect(DEFAULT_GUEST_MODEL).toBe("gpt-image-2.5-sunburst");
    expect(parseGuestModel("fal-ai/flux-2")).toBeNull();
    expect((await readGuestModel("")).model).toBe("gpt-image-2.5-sunburst");
    await saveGuestModel("bytedance/seedream/v5/lite/edit", "super");
    expect((await readGuestModel("")).model).toBe("bytedance/seedream/v5/lite/edit");
    expect((await prisma.platformSetting.findUnique({ where: { key: "guest_hairstyle_engine" } }))?.value).toBe("fal");
    await saveGuestModel("gpt-image-2.5-sunburst", "super");
    expect((await readGuestModel("")).model).toBe("gpt-image-2.5-sunburst");
    expect((await prisma.platformSetting.findUnique({ where: { key: "guest_hairstyle_engine" } }))?.value).toBe("openai");
  });

  it("prices the selectable fal edits and sends selfie plus reference", () => {
    expect(falPriceListUsd({ model: "meta/muse-image/edit", outputWidth: 800, outputHeight: 1200 })?.usd).toBe(0.01);
    const mp = (1024 * 1536) / 1_000_000;
    expect(falPriceListUsd({ model: "fal-ai/qwen-image-edit-2511", outputWidth: 1024, outputHeight: 1536 })?.usd).toBeCloseTo(0.03 * mp, 6);
    expect(falPriceListUsd({ model: "fal-ai/flux-2/klein/4b/edit", outputWidth: 1024, outputHeight: 1536 })?.usd).toBeCloseTo(0.01 * mp, 6);
    expect(falPriceListUsd({ model: "bytedance/seedream/v5/lite/edit", outputWidth: 512, outputHeight: 512 })?.usd).toBe(0.035);
    const flux = falPriceListUsd({
      model: "fal-ai/flux-2/edit",
      outputWidth: 1024,
      outputHeight: 1536,
      inputs: [{ width: 768, height: 1024 }, { width: 512, height: 512 }],
    });
    const inMp = (768 * 1024 + 512 * 512) / 1_000_000;
    expect(flux?.usd).toBeCloseTo(0.012 * (inMp + mp), 6);
    expect(falUsdRange("meta/muse-image/edit", "1024x1536", [{ width: 768, height: 1024 }])?.highUsd).toBe(0.01);

    const muse = buildFalEditBody("meta/muse-image/edit", {
      prompt: "Change only the hair.",
      selfieUrl: "https://cdn.example/selfie.jpg",
      referenceUrl: "https://cdn.example/style.jpg",
      size: "1024x1536",
      width: 768,
      height: 1024,
    });
    expect(muse?.image_urls).toEqual(["https://cdn.example/selfie.jpg", "https://cdn.example/style.jpg"]);
    expect(muse?.aspect_ratio).toBe(closestMuseAspect(768, 1024));
    expect(muse?.output_format).toBe("png");
    expect(muse?.num_images).toBe(1);
    expect(muse).not.toHaveProperty("enable_safety_checker");

    for (const id of ["fal-ai/qwen-image-edit-2511", "fal-ai/flux-2/edit", "fal-ai/flux-2/klein/4b/edit", "bytedance/seedream/v5/lite/edit"] as const) {
      const body = buildFalEditBody(id, {
        prompt: "Change only the hair.",
        selfieUrl: "https://cdn.example/selfie.jpg",
        referenceUrl: "https://cdn.example/style.jpg",
        size: "1024x1536",
      });
      expect(body?.image_urls, id).toEqual(["https://cdn.example/selfie.jpg", "https://cdn.example/style.jpg"]);
      expect(body?.prompt, id).toBe("Change only the hair.");
    }
  });

  it("shows the model list and keeps the fal key field", async () => {
    await saveFalKey({ apiKey: "fal-generation-key-123456", enabled: true, remove: false }, "super");
    expect((await resolveFalKey()).ok).toBe(true);
    const html = renderToStaticMarkup(createElement(SuperAiForm, {
      salonCapInr: 100,
      initial: {
        provider: "openai",
        hasKey: false,
        hint: "",
        allowByo: false,
        tier: "test",
        mediumApproved: false,
        highEnabled: false,
        calibrationOk: false,
        choices: { openai: [], gemini: [] },
        spend: { spentInr: 0, capInr: 100, calls: 0 },
        openaiKey: { saved: false, hint: "" },
        geminiKey: { saved: false, hint: "" },
        falKey: { saved: true, hint: "3456", enabled: true },
        falBillingKey: { saved: false, hint: "" },
        openRouterKey: { saved: false, hint: "", enabled: false },
        guestEngine: "openai",
        guestModel: "gpt-image-2.5-sunburst",
      },
      prices: guestModelPriceRows(),
    }));
    expect(html).toContain("aria-label=\"fal key\"");
    expect(html).toContain("Guest hairstyle model");
    for (const row of GUEST_MODEL_OPTIONS) expect(html).toContain(row.label);
    expect(html).toContain("selected");
  });
});
