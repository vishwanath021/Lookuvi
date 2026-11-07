import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { confirmedMessage, reminderMessage } from "@/lib/queue/messages";
import { lookShareMessage } from "@/lib/look-result";
import { BRIDAL_TRIAL_SENT, buildBridalTrialText, buildWhatsAppText } from "@/lib/whatsapp";
import { DEFAULT_REMINDER_TEMPLATE, renderReminderMessage } from "@/lib/visit-reminders";
import { whatsAppDate, whatsAppSchedule, whatsAppTime } from "@/lib/whatsapp-format";

describe("WhatsApp plain dates", () => {
  it("writes a calendar day and a 12-hour time", () => {
    expect(whatsAppDate("2026-12-20")).toBe("20 December 2026");
    expect(whatsAppDate("2026-10-05")).toBe("05 October 2026");
    expect(whatsAppTime("16:30")).toBe("4:30 PM");
    expect(whatsAppTime("09:05")).toBe("9:05 AM");
    expect(whatsAppTime("00:00")).toBe("12:00 AM");
    expect(whatsAppTime("12:00")).toBe("12:00 PM");
    expect(whatsAppSchedule("2026-12-20 16:30")).toBe("20 December 2026 at 4:30 PM");
  });

  it("leaves a media link untouched and formats the bridal trial date", () => {
    const link = "https://127.0.0.1:3000/api/v1/media?key=generations/a/b/result.jpg&exp=1&sig=abc";
    const text = buildBridalTrialText({
      name: "Lakshmi",
      eventLabel: "Wedding",
      eventDate: "2026-12-20",
      looks: ["Telugu Muhurtham Classic"],
      urls: [link],
    });
    expect(text).toContain("20 December 2026");
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(text).toContain(link);
    expect(text.match(/https?:\/\//g)).toEqual([link.match(/https?:\/\//)?.[0]]);
  });

  it("formats the queue confirmation and the owner booking note", () => {
    const message = confirmedMessage({
      salon: "Demo",
      date: "2099-06-01",
      slot: "12:00",
      link: "https://lookuvi.test/s/demo/q/abc",
      home: "https://lookuvi.test/s/demo/queue",
      tryOn: "https://lookuvi.test/s/demo",
    });
    expect(message.body).toContain("01 June 2099 at 12:00 PM");
    expect(message.body).not.toContain("2099-06-01");
    expect(message.parameters[1]).toBe("01 June 2099");
    expect(message.parameters[2]).toBe("12:00 PM");
    expect(whatsAppSchedule("2026-12-20 16:30")).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("does not put an ISO date into share, reminder, or everyday booking text", () => {
    const share = lookShareMessage("bridal", "Soft rose", "https://look.example/a");
    const reminder = renderReminderMessage({
      template: DEFAULT_REMINDER_TEMPLATE,
      name: "Asha",
      salon: "Demo",
      points: 0,
      link: "https://lookuvi.test/s/demo",
    });
    const queued = reminderMessage({
      salon: "Demo",
      join: "https://lookuvi.test/s/demo/queue",
      tryOn: "https://lookuvi.test/s/demo",
    });
    const everyday = buildWhatsAppText({ phone: "919800011122", salonName: "Demo", lookName: "Bob", services: [] });
    for (const text of [share, reminder, queued.body, everyday]) {
      expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });

  it("turns Zod's eval probe off before a guest schema is built", () => {
    const guest = readFileSync("src/lib/hair-suitability.ts", "utf8");
    const flag = readFileSync("src/lib/zod-jitless.ts", "utf8");
    expect(guest.indexOf('import "@/lib/zod-jitless"')).toBeGreaterThan(-1);
    expect(guest.indexOf('import "@/lib/zod-jitless"')).toBeLessThan(guest.indexOf('from "zod"'));
    expect(flag).toContain("jitless: true");
  });

  it("uses the exact trial confirmation and no other casing in the catalog", () => {
    expect(BRIDAL_TRIAL_SENT).toBe("Sent to the Salon on WhatsApp");
    const i18n = readFileSync("src/data/i18n.ts", "utf8");
    expect(i18n.toLowerCase()).not.toContain("sent to the salon on whatsapp");
    const flow = readFileSync("src/components/tryon/BridalFlow.tsx", "utf8");
    expect(flow).not.toContain("Sent to the salon on WhatsApp");
    expect(flow).toContain("BRIDAL_TRIAL_SENT");
  });
});
