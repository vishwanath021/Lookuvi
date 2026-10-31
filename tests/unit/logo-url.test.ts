import { describe, expect, it } from "vitest";
import { isAllowedLogoUrl } from "@/lib/logo-url";

describe("isAllowedLogoUrl", () => {
  it("allows empty, brand paths, and raster data URLs", () => {
    expect(isAllowedLogoUrl(null)).toBe(true);
    expect(isAllowedLogoUrl("")).toBe(true);
    expect(isAllowedLogoUrl("/brand/lookuvi-mark.svg")).toBe(true);
    expect(isAllowedLogoUrl("data:image/jpeg;base64,/9j/4AAQ")).toBe(true);
    expect(isAllowedLogoUrl("data:image/png;base64,iVBOR")).toBe(true);
  });

  it("rejects scriptable or remote schemes", () => {
    expect(isAllowedLogoUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedLogoUrl("https://evil.example/x.png")).toBe(false);
    expect(isAllowedLogoUrl("data:image/svg+xml;base64,PHN2Zy")).toBe(false);
    expect(isAllowedLogoUrl("data:text/html;base64,PGh0bWw+")).toBe(false);
    expect(isAllowedLogoUrl("/../etc/passwd")).toBe(false);
  });
});
