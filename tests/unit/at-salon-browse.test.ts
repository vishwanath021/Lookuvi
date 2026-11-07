import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { addSavedPick, readSavedPicks, showLockedBrowse } from "@/lib/at-salon-browse";

describe("locked browse", () => {
  it("hides the empty photo frame until the guest is unlocked", () => {
    expect(showLockedBrowse(true, { ready: false, required: false, unlocked: true })).toBe(true);
    expect(showLockedBrowse(true, { ready: true, required: true, unlocked: false })).toBe(true);
    expect(showLockedBrowse(true, { ready: true, required: true, unlocked: true })).toBe(false);
    expect(showLockedBrowse(false, { ready: false, required: false, unlocked: true })).toBe(false);
    expect(showLockedBrowse(true, { ready: true, required: false, unlocked: true })).toBe(false);
  });

  it("keeps saved styles and does not duplicate a style", () => {
    const first = addSavedPick([], { tool: "style", id: "bob", name: "Bob" });
    const again = addSavedPick(first, { tool: "style", id: "bob", name: "Bob" });
    const colour = addSavedPick(again, { tool: "colour", id: "honey", name: "Honey" });
    expect(colour.map((item) => item.name)).toEqual(["Honey", "Bob"]);
    expect(readSavedPicks(JSON.stringify(colour))).toEqual(colour);
    expect(readSavedPicks("nope")).toEqual([]);
  });

  it("labels the custom tries box and does not offer a counter QR", () => {
    const desk = readFileSync("src/components/admin/QueueDesk.tsx", "utf8");
    const qr = readFileSync("src/app/admin/qr/page.tsx", "utf8");
    const guest = readFileSync("src/components/guest/AtSalonNote.tsx", "utf8");
    expect(desk).toContain("Custom tries");
    expect(desk).toContain('placeholder="1–9"');
    expect(qr).not.toContain("Counter QR");
    expect(qr).not.toContain("counter");
    expect(guest).not.toContain("counter");
  });
});
