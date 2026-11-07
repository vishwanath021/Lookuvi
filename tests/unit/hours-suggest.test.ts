import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ONBOARDING_SAVED, ONBOARDING_STEPS, OnboardingWizard } from "@/components/admin/OnboardingWizard";
import { WeekHoursEditor } from "@/components/admin/WeekHoursEditor";
import { serializeWeek, suggestedWeek, weekFromPair } from "@/lib/queue/schedule";

describe("suggested hours", () => {
  it("shows 10:00–20:00 as a suggestion and does not mark the week closed", () => {
    const html = renderToStaticMarkup(createElement(WeekHoursEditor, {
      openTime: "",
      closeTime: "",
      weeklyHours: "",
      onChange: () => undefined,
    }));
    expect(html).toContain("Suggested — not saved yet");
    expect(html).toContain('data-hours-suggested="yes"');
    expect(html).toContain('value="10:00"');
    expect(html).toContain('value="20:00"');
    expect(html).not.toContain("checked");
    expect(suggestedWeek().mon).toEqual([{ open: "10:00", close: "20:00" }]);
    expect(suggestedWeek().sun).toEqual([{ open: "10:00", close: "20:00" }]);
  });

  it("marks a day closed only after that day is saved closed", () => {
    const week = suggestedWeek();
    week.mon = [];
    const html = renderToStaticMarkup(createElement(WeekHoursEditor, {
      openTime: "",
      closeTime: "",
      weeklyHours: serializeWeek(week),
      onChange: () => undefined,
    }));
    expect(html).not.toContain("Suggested — not saved yet");
    expect(html).toMatch(/aria-label="Monday closed"[^>]*checked/);
    expect(html).not.toMatch(/aria-label="Tuesday closed"[^>]*checked/);
  });

  it("keeps a saved one-session week instead of the suggestion", () => {
    const html = renderToStaticMarkup(createElement(WeekHoursEditor, {
      openTime: "11:00",
      closeTime: "19:00",
      weeklyHours: serializeWeek(weekFromPair("11:00", "19:00")),
      onChange: () => undefined,
    }));
    expect(html).not.toContain("Suggested — not saved yet");
    expect(html).toContain('value="11:00"');
    expect(html).toContain('value="19:00"');
  });
});

describe("owner onboarding", () => {
  it("reaches hours after services and before the QR step, with WhatsApp as step 3", () => {
    expect(ONBOARDING_STEPS).toEqual(["Brand", "Services", "WhatsApp", "Languages", "Hours", "Done"]);
    expect(ONBOARDING_STEPS.indexOf("Hours")).toBeGreaterThan(ONBOARDING_STEPS.indexOf("Services"));
    expect(ONBOARDING_STEPS.indexOf("Hours")).toBeLessThan(ONBOARDING_STEPS.indexOf("Done"));
    expect(ONBOARDING_SAVED).toBe("Saved ✓");
    const html = renderToStaticMarkup(createElement(OnboardingWizard, {
      initial: { name: "Demo", primaryColor: "#69517D", whatsapp: "", address: "", languages: ["en"], services: [] },
    }));
    expect(html).toContain("Step 1 of 6");
    expect(html).toContain("Brand");
    expect(html).not.toContain('data-onboarding-step="hours"');
  });
});
