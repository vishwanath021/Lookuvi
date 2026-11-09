import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("guest layout", () => {
  const app = readFileSync("src/components/tryon/TryOnApp.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");
  const bridal = readFileSync("src/components/tryon/BridalFlow.tsx", "utf8");

  it("keeps the legal footer after the salon choice, not above it", () => {
    const footer = app.indexOf("<LegalFooter");
    const choice = app.indexOf("data-guest-tabs");
    const login = app.indexOf("Salon login");
    expect(footer).toBeGreaterThan(choice);
    expect(footer).toBeGreaterThan(login);
  });

  it("pins the bridal step bar to the top of the scrolling panel and highlights the current step", () => {
    expect(bridal).toContain("current={activeStep}");
    expect(bridal).not.toContain('current="bridal-event"');
    expect(css).toContain(".try-picks > .step-rail { top: 0;");
    expect(css).toMatch(/\.step-rail \{[^}]*background: #f3f0f8;/s);
  });

  it("makes the mobile preview full width and drops the large bottom gap", () => {
    expect(css).toMatch(/\.try-shot \{ width: 100%;/);
    expect(css).not.toContain("padding-bottom: 13rem");
    expect(css).toContain('[data-scroll="salon"][data-mini="yes"]');
  });
});
