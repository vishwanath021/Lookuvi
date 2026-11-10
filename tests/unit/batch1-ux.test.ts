import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { toggleSavedPick } from "@/lib/at-salon-browse";
import { guestJoinHref, guestNavCurrent } from "@/lib/guest-nav";
import { serviceChoiceLabel } from "@/lib/service-label";

describe("batch 1 guest and owner copy", () => {
  it("labels a service with its price, including a combo name", () => {
    expect(serviceChoiceLabel({ name: "Haircut + face wash", priceInr: 700 })).toBe("Haircut + face wash · ₹700");
    expect(serviceChoiceLabel({ name: "Colour", priceInr: 2500 })).toBe("Colour · ₹2,500");
  });

  it("sends Join / Book to the queue when the salon has one, otherwise to the booking link", () => {
    expect(guestJoinHref({ slug: "demo", showQueue: true, bookHref: "https://wa.me/91" })).toBe("/s/demo/queue");
    expect(guestJoinHref({ slug: "demo", showQueue: false, bookHref: "https://wa.me/91" })).toBe("https://wa.me/91");
    expect(guestNavCurrent("/s/demo/q/abc", "demo")).toBe("join");
    expect(guestNavCurrent("/s/demo/services", "demo")).toBe("services");
    expect(guestNavCurrent("/s/demo/saved", "demo")).toBe("saved");
    expect(guestNavCurrent("/s/demo", "demo")).toBe("try");
  });

  it("toggles a saved look without duplicating it", () => {
    const first = toggleSavedPick([], { tool: "style", id: "soft-bob", name: "Soft Bob" });
    expect(first).toEqual([{ tool: "style", id: "soft-bob", name: "Soft Bob" }]);
    expect(toggleSavedPick(first, { tool: "style", id: "soft-bob", name: "Soft Bob" })).toEqual([]);
  });

  it("keeps the visit-code card off settings and the reminder link off the full settings page", () => {
    const settings = readFileSync("src/components/admin/SettingsForm.tsx", "utf8");
    const focus = readFileSync("src/components/admin/SettingsFocus.tsx", "utf8");
    const customers = readFileSync("src/components/admin/CustomersBoard.tsx", "utf8");
    expect(settings).not.toContain("VisitUnlock");
    expect(settings).toContain("ImportCustomers");
    expect(focus).not.toContain("All settings");
    expect(customers).toContain("Send offer on WhatsApp");
    expect(customers).toContain("until this month");
    expect(customers).not.toContain("Two come-back messages per visit");
    expect(customers).not.toContain("Add customer");
  });
});
