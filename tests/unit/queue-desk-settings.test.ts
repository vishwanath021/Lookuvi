import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("queue desk settings (#17)", () => {
  it("gates the wait-time alert field to live mode only", () => {
    const src = readFileSync("src/components/admin/QueueDesk.tsx", "utf8");
    expect(src).toContain('mode === "LIVE"');
    expect(src).toContain("queueAlert");
    const alertBlock = src.slice(src.indexOf("queueAlert") - 80, src.indexOf("queueAlert") + 200);
    expect(alertBlock).toContain('mode === "LIVE"');
  });
});
