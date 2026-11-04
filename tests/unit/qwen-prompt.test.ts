import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { styleById } from "@/data/styles";
import { prepareComparison, prepareGuestReference } from "@/lib/ai/compare-models";
import { loadGuestReference } from "@/lib/ai/guest-hairstyle";
import { QWEN_EDIT_ID, qwenHairPrompt, tuneQwenGuest } from "@/lib/ai/qwen-prompt";
import { buildFalEditBody } from "@/lib/ai/fal-models";

describe("qwen image edit prompt", () => {
  it("names image 1 as the selfie and image 2 as the crew-cut reference", async () => {
    const style = styleById("crew-cut");
    expect(style).toBeTruthy();
    const prompt = qwenHairPrompt(style!);
    expect(prompt.startsWith("image 1 is the customer photo")).toBe(true);
    expect(prompt).toContain("image 2 is the reference only");
    expect(prompt).toContain("Change only the hair");
    expect(prompt).toContain("Crew Cut");
    expect(prompt).toContain("Do not invent a bowl fringe");
    const selfie = await sharp({ create: { width: 80, height: 120, channels: 3, background: "#c4a484" } }).jpeg().toBuffer();
    const ready = await prepareComparison({ jpeg: selfie, styleId: "crew-cut", modelId: QWEN_EDIT_ID, quality: "medium" });
    expect(ready.ok).toBe(true);
    if (!ready.ok) return;
    expect(ready.prompt).toBe(prompt);
    expect(ready.referenceFile).toMatch(/crew-cut/);
  });

  it("sends the high-arch card photo as image 2 and keeps thickness in the prompt", async () => {
    const loaded = await loadGuestReference("brows", "high-arch", { thickness: "thin", colour: "soft-brown" });
    expect(loaded).toBeTruthy();
    const tuned = tuneQwenGuest({
      tool: "brows",
      styleId: "high-arch",
      prompt: loaded!.prompt,
      reference: loaded!.reference,
      referenceFile: loaded!.referenceFile,
    });
    expect(tuned.prompt).toContain("image 1 is the customer photo");
    expect(tuned.prompt).toContain("image 2 shows the eyebrow shape");
    expect(tuned.prompt).toContain("Change only the eyebrows");
    expect(tuned.prompt).toContain("Do not paint a solid dark block");
    expect(tuned.prompt).toContain("High Arch");
    expect(tuned.prompt).toContain("thin sparse brow");
    expect(tuned.prompt).toContain("soft brown");
    expect(tuned.referenceFile).toBe("high-arch.webp");
    expect(tuned.reference.equals(loaded!.reference)).toBe(false);
    const meta = await sharp(tuned.reference).metadata();
    expect(meta.format).toBe("webp");
    const selfie = await sharp({ create: { width: 80, height: 120, channels: 3, background: "#c4a484" } }).jpeg().toBuffer();
    const ready = await prepareGuestReference({
      jpeg: selfie,
      styleId: "high-arch",
      modelId: QWEN_EDIT_ID,
      prompt: tuned.prompt,
      reference: tuned.reference,
      referenceFile: tuned.referenceFile,
    });
    expect(ready.ok).toBe(true);
    if (!ready.ok) return;
    expect(ready.prompt).toContain("image 2 shows the eyebrow shape");
  });

  it("keeps selfie then reference and does not force a new canvas", () => {
    const body = buildFalEditBody(QWEN_EDIT_ID, {
      prompt: "image 1 is the selfie. image 2 is the reference.",
      selfieUrl: "https://cdn.example/selfie.jpg",
      referenceUrl: "https://cdn.example/style.jpg",
      size: "1024x1536",
    });
    expect(body?.image_urls).toEqual(["https://cdn.example/selfie.jpg", "https://cdn.example/style.jpg"]);
    expect(body?.image_size).toBeUndefined();
    expect(body?.output_format).toBe("jpeg");
  });
});
