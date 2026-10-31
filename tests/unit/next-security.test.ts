import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("next security pins", () => {
  it("uses a Next.js release after the image-optimizer SVG advisory floor", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: { next: string } };
    const version = pkg.dependencies.next.replace(/^[^\d]*/, "");
    const [maj, min, patch] = version.split(".").map(Number);
    expect(maj).toBeGreaterThanOrEqual(15);
    const ok = maj > 15 || min > 5 || (min === 5 && patch >= 28);
    expect(ok).toBe(true);
  });

  it("keeps dangerouslyAllowSVG off in next.config", () => {
    const conf = readFileSync("next.config.ts", "utf8");
    expect(conf).toMatch(/dangerouslyAllowSVG:\s*false/);
  });
});
