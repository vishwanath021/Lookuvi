import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { styleById } from "@/data/styles";
import { prepareComparison } from "@/lib/ai/compare-models";
import { qwenHairPrompt, usesShortReferencePrompt } from "@/lib/ai/qwen-prompt";
import { clearTabLooks, parseTabSession, putTabLook, selfieForEdit, serializeTabSession, type TabLook } from "@/lib/tab-looks";

function look(tool: TabLook["tool"], styleId: string): TabLook {
  return {
    id: `${tool}-1`,
    styleId,
    styleName: styleId,
    shadeName: null,
    before: "data:image/jpeg;base64,before",
    after: `data:image/jpeg;base64,${tool}`,
    serviceKeys: [],
    tool,
  };
}

describe("per-tab guest previews", () => {
  it("keeps each tab's latest result and edits from the original selfie", () => {
    const selfie = { id: "original" };
    const brows = look("brows", "high-arch");
    const style = look("style", "crew-cut");
    const first = putTabLook({}, brows);
    const both = putTabLook(first, style);
    expect(both.brows?.after).toBe(brows.after);
    expect(both.style?.styleId).toBe("crew-cut");
    const nextBrows = putTabLook(both, look("brows", "soft-arch"));
    expect(nextBrows.style?.styleId).toBe("crew-cut");
    expect(nextBrows.brows?.styleId).toBe("soft-arch");
    expect(selfieForEdit(selfie)).toBe(selfie);
    expect(clearTabLooks(nextBrows, ["style"]).style).toBeUndefined();
    expect(clearTabLooks(nextBrows, ["style"]).brows?.styleId).toBe("soft-arch");
    const raw = serializeTabSession({ face: "data:image/jpeg;base64,face", looks: nextBrows });
    const restored = parseTabSession(raw);
    expect(restored.face).toContain("data:image/jpeg");
    expect(restored.looks.brows?.styleId).toBe("soft-arch");
    expect(restored.looks.style?.styleId).toBe("crew-cut");
    expect(parseTabSession("not-json").looks).toEqual({});
  });

  it("tells FLUX.2 and Klein 4B to keep the face in image 1 and copy only the hair from image 2", async () => {
    const style = styleById("crew-cut");
    expect(style).toBeTruthy();
    const prompt = qwenHairPrompt(style!);
    expect(prompt).toContain("image 1 is the customer photo");
    expect(prompt).toContain("image 2 is the reference only");
    expect(prompt).toContain("Change only the hair");
    expect(prompt).toContain("Do not copy the face");
    for (const modelId of ["fal-ai/flux-2/edit", "fal-ai/flux-2/klein/4b/edit"]) {
      expect(usesShortReferencePrompt(modelId)).toBe(true);
      const selfie = await sharp({ create: { width: 64, height: 80, channels: 3, background: "#c4a484" } }).jpeg().toBuffer();
      const ready = await prepareComparison({ jpeg: selfie, styleId: "crew-cut", modelId, quality: "medium" });
      expect(ready.ok).toBe(true);
      if (!ready.ok) return;
      expect(ready.prompt.startsWith("image 1 is the customer photo")).toBe(true);
      expect(ready.prompt).toContain("Change only the hair");
      expect(ready.prompt).toContain("Do not copy the face");
    }
  });
});
