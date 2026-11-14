import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ONBOARDING_SAVED, ONBOARDING_STEPS, OnboardingWizard } from "@/components/admin/OnboardingWizard";
import { WeekHoursEditor } from "@/components/admin/WeekHoursEditor";
import { hoursAfterClosedToggle, serializeWeek, sessionSpanWarning, suggestedWeek, weekFromPair } from "@/lib/queue/schedule";

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
    expect(html).not.toContain('aria-checked="true"');
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
    expect(html).toMatch(/aria-label="Monday closed"[^>]*aria-checked="true"/);
    expect(html).toMatch(/aria-label="Tuesday closed"[^>]*aria-checked="false"/);
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

describe("closed toggle and AM/PM", () => {
  it("keeps the previous times when closed is ticked and unticked", () => {
    const closed = hoursAfterClosedToggle({ open: "09:00", close: "22:00", open2: "", close2: "" }, true);
    expect(closed.sessions).toEqual([]);
    expect(closed.open).toBe("09:00");
    expect(closed.close).toBe("22:00");
    const opened = hoursAfterClosedToggle(closed, false);
    expect(opened.sessions).toEqual([{ open: "09:00", close: "22:00" }]);
    expect(opened.sessions).not.toEqual([{ open: "10:00", close: "20:00" }]);
  });

  it("warns when close is earlier or only a few minutes later", () => {
    expect(sessionSpanWarning("09:00", "10:00")).toMatch(/only 60 minutes|only \d+ minutes|9:00 AM/);
    expect(sessionSpanWarning("09:00", "08:00")).toMatch(/not after/);
    expect(sessionSpanWarning("09:00", "21:00")).toBe("");
  });
});

describe("owner onboarding", () => {
  it("reaches hours after services and before the QR step, with WhatsApp as step 3", () => {
    expect(ONBOARDING_STEPS).toEqual(["Brand", "Services", "WhatsApp", "Hours", "Reminders", "Done"]);
    expect(ONBOARDING_STEPS).not.toContain("Languages");
    expect(ONBOARDING_STEPS.indexOf("Hours")).toBeGreaterThan(ONBOARDING_STEPS.indexOf("Services"));
    expect(ONBOARDING_STEPS.indexOf("Reminders")).toBeGreaterThan(ONBOARDING_STEPS.indexOf("Hours"));
    expect(ONBOARDING_STEPS.indexOf("Reminders")).toBeLessThan(ONBOARDING_STEPS.indexOf("Done"));
    expect(ONBOARDING_SAVED).toBe("Saved ✓");
    const html = renderToStaticMarkup(createElement(OnboardingWizard, {
      initial: { name: "Demo", primaryColor: "#69517D", whatsapp: "", address: "", languages: ["en"], services: [] },
    }));
    expect(html).toContain("Step 1 of 6");
    expect(html).not.toContain("తెలుగు");
    expect(html).not.toContain("हिन्दी");
    expect(html).not.toContain("How do you want to send come-back reminders?");
    expect(html).toContain("Brand");
    expect(html).not.toContain('data-onboarding-step="hours"');
  });
});
