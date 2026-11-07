import { describe, expect, it } from "vitest";
import { isPastKolkataDay, kolkataDayKey, PAST_DATE_MESSAGE } from "@/lib/queue/day";

describe("Kolkata calendar day", () => {
  it("treats a date before today in Asia/Kolkata as past", () => {
    const now = new Date("2026-11-06T19:00:00.000Z");
    expect(kolkataDayKey(now)).toBe("2026-11-07");
    expect(isPastKolkataDay("2026-11-06", now)).toBe(true);
    expect(isPastKolkataDay("2026-10-05", now)).toBe(true);
    expect(isPastKolkataDay("2026-11-07", now)).toBe(false);
    expect(isPastKolkataDay("2026-12-20", now)).toBe(false);
    expect(PAST_DATE_MESSAGE).toBe("Choose today or a later date.");
  });
});
