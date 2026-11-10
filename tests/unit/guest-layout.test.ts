import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("guest layout", () => {
  const app = readFileSync("src/components/tryon/TryOnApp.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");
  const bridal = readFileSync("src/components/tryon/BridalFlow.tsx", "utf8");

  it("keeps the legal footer after the salon choice, not above it", () => {
    const footer = app.indexOf("<LegalFooter");
    const choice = app.indexOf("data-guest-tabs");
    expect(footer).toBeGreaterThan(choice);
    expect(app).not.toContain("Salon login");
    expect(app).not.toContain("Demo preview");
    expect(app).not.toContain("Powered by Lookuvi");
    expect(app).toContain("<GuestNav");
  });

  it("pins the bridal step bar under the header on the page scroll", () => {
    expect(bridal).toContain("current={activeStep}");
    expect(bridal).not.toContain('current="bridal-event"');
    expect(css).toContain(".try-picks > .step-rail { top: 4.5rem;");
    expect(css).not.toMatch(/\.try-picks \{[^}]*overflow:\s*auto/);
    expect(css).toMatch(/\.step-rail \{[^}]*background: #f3f0f8;/s);
  });

  it("makes the mobile preview full width and drops the large bottom gap", () => {
    expect(css).toMatch(/\.try-shot \{ width: 100%;/);
    expect(css).not.toContain("padding-bottom: 13rem");
    expect(css).toContain('[data-scroll="salon"][data-mini="yes"]');
  });
});
