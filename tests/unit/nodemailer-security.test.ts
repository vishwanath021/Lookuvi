import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("nodemailer security pin", () => {
  it("is at least 10.1.4 (GHSA-8c8m-p3m8-cjg8 floor)", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: { nodemailer: string } };
    const version = pkg.dependencies.nodemailer.replace(/^[^\d]*/, "");
    const [maj, min, patch] = version.split(".").map(Number);
    expect(maj).toBeGreaterThanOrEqual(10);
    const ok = maj > 10 || min > 1 || (min === 1 && patch >= 4);
    expect(ok).toBe(true);
  });
});
