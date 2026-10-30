import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("bridal before/after overlay", () => {
  it("keeps Zoom as a chip so it cannot cover the compare drag surface", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).not.toMatch(/\.look-zoom-hit\b/);
    expect(css).toMatch(/\.look-zoom-chip\s*\{[^}]*z-index:\s*25/s);

    const zoom = readFileSync("src/components/tryon/LookResultActions.tsx", "utf8");
    expect(zoom).not.toContain("look-zoom-hit");
    expect(zoom).toContain('className="look-zoom-chip"');
    expect(zoom).toContain('data-zoom-chip="yes"');
  });

  it("keeps Save this look inside the sticky TryBar so it cannot collide with the counter", () => {
    const stepper = readFileSync("src/components/tryon/LookStepper.tsx", "utf8");
    expect(stepper).toContain("onSave");
    expect(stepper).toContain("Save this look");

    const bridal = readFileSync("src/components/tryon/BridalFlow.tsx", "utf8");
    expect(bridal).toMatch(/onSave=\{result\?\.kind === "look"/);
    expect(bridal).toMatch(/onSave=\{result\?\.kind === "mehendi"/);
    // Standalone Save button outside TryBar was the overlap source.
    expect(bridal).not.toMatch(/<button className="btn"[^>]*>Save this look<\/button>/);
  });
});
