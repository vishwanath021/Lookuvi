import { describe, expect, it } from "vitest";
import { comeBackStep } from "@/lib/customers/comeback";

const visit = new Date("2026-06-01T06:30:00.000Z");

describe("come-back reminders", () => {
  it("allows one message from 6 weeks and a second only after 2 months", () => {
    const atSixWeeks = new Date("2026-07-20T06:30:00.000Z");
    const beforeTwoMonths = new Date("2026-07-25T06:30:00.000Z");
    const atTwoMonths = new Date("2026-08-05T06:30:00.000Z");
    expect(comeBackStep(visit, [], new Date("2026-07-01T06:30:00.000Z"))).toBe("early");
    expect(comeBackStep(visit, [], atSixWeeks)).toBe("send");
    expect(comeBackStep(visit, [atSixWeeks], beforeTwoMonths)).toBe("wait");
    expect(comeBackStep(visit, [atSixWeeks], atTwoMonths)).toBe("send");
    expect(comeBackStep(visit, [atSixWeeks, atTwoMonths], new Date("2026-09-01T06:30:00.000Z"))).toBe("done");
    expect(comeBackStep(visit, [atTwoMonths], new Date("2026-09-01T06:30:00.000Z"))).toBe("done");
  });
});
