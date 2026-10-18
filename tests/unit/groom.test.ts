import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { GroomFlow } from "@/components/tryon/GroomFlow";
import { TryOnApp } from "@/components/tryon/TryOnApp";
import { GROOM_BEARDS, GROOM_CLOTH_EDGE, GROOM_GROOMING, GROOM_HAIR, GROOM_JEWELLERY_EDGE, GROOM_OWN_SLOTS, categoryPills, groomItemEdge } from "@/data/groom";
import { guestSections } from "@/lib/guest-sections";
import {
  buildGroomOwnPrompt,
  buildGroomPrompt,
  generateGroom,
  groomItemKey,
  planGroom,
  prepareGroom,
} from "@/lib/groom";
import { isPublicMediaKey } from "@/lib/bridal-own";
import { salonActionItems } from "@/lib/salon-actions";
import type { SalonConfig } from "@/lib/salon";

async function jpeg(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 180, g: 140, b: 110 } } }).jpeg().toBuffer();
}

const salon = { slug: "demo", defaultLang: "en" } as SalonConfig;

describe("groom prompts", () => {
  it("keeps his face, beard, and skin, and stays modern", () => {
    const prompt = buildGroomPrompt(GROOM_HAIR[0], GROOM_BEARDS[0], GROOM_GROOMING[0]);
    expect(prompt).toContain("Keep his exact face, beard, and skin tone.");
    expect(prompt).toContain("Keep his natural skin tone and skin texture exactly; do not lighten, whiten or smooth the skin.");
    expect(prompt).toContain("Modern, natural styling. No heavy ritual stock imagery.");
    expect(prompt).toContain("clean side part");
    expect(prompt).toContain("Do not add a sherwani");
    expect(prompt).not.toMatch(/gold|jasmine/i);
    const own = buildGroomOwnPrompt([{ noun: "sherwani" }, { noun: "watch" }]);
    expect(own.indexOf("Image 1 is the groom's own selfie")).toBeLessThan(own.indexOf("Image 2 is his sherwani"));
    expect(own).toContain("Image 3 is his watch");
    expect(own).toContain("Copy that sherwani exactly");
    expect(own).toContain("Do not reshape or remove his beard.");
    expect(own).toContain("No flowers, garlands, or ceremonial props");
  });

  it("asks sunburst at medium and 1024x1360 for a planned 3:4 frame", () => {
    const planned = planGroom({ hairId: "groom-side-part", slotIds: ["watch", "sherwani"], size: "1024x1360" });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.plan.model).toBe("gpt-image-2.5-sunburst");
    expect(planned.plan.quality).toBe("medium");
    expect(planned.plan.size).toBe("1024x1360");
    expect(planned.plan.imageOrder).toEqual(["selfie.jpg", "sherwani.jpg", "watch.jpg"]);
    expect(planned.own).toBe(true);
    expect(categoryPills(["only"])).toEqual([]);
    expect(categoryPills(["wedding", "reception"])).toEqual(["wedding", "reception"]);
  });
});

describe("groom photos and privacy", () => {
  it("sends clothes at 512 and mala or watch at 640, then deletes them", async () => {
    expect(groomItemEdge("sherwani")).toBe(GROOM_CLOTH_EDGE);
    expect(groomItemEdge("turban")).toBe(GROOM_CLOTH_EDGE);
    expect(groomItemEdge("mala")).toBe(GROOM_JEWELLERY_EDGE);
    expect(groomItemEdge("watch")).toBe(GROOM_JEWELLERY_EDGE);
    const prepared = await prepareGroom({
      selfie: await jpeg(768, 1024),
      items: [
        { id: "sherwani", bytes: await jpeg(900, 700) },
        { id: "watch", bytes: await jpeg(800, 800) },
      ],
    });
    expect(prepared.plan.size).toBe("1024x1360");
    const cloth = await sharp(prepared.items[0]?.jpeg).metadata();
    const watch = await sharp(prepared.items[1]?.jpeg).metadata();
    expect(Math.max(cloth.width || 0, cloth.height || 0)).toBeLessThanOrEqual(512);
    expect(Math.max(watch.width || 0, watch.height || 0)).toBeLessThanOrEqual(640);
    const stored = new Map<string, Buffer>();
    const removed: string[] = [];
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      await generateGroom({
        selfie: await jpeg(768, 1024),
        items: [{ id: "kurta", bytes: await jpeg(400, 400) }],
        tenantId: "tenant",
        requestId: "req-1",
        put: async (key, body) => { stored.set(key, body); },
        remove: async (key) => { removed.push(key); stored.delete(key); },
        edit: async (form) => {
          expect(form.get("model")).toBe("gpt-image-2.5-sunburst");
          expect(form.get("quality")).toBe("medium");
          expect(form.get("size")).toBe("1024x1360");
          return jpeg(1024, 1360);
        },
      });
      expect(stored.size).toBe(0);
      expect(removed[0]).toBe(groomItemKey("tenant", "req-1", "kurta"));
      expect(isPublicMediaKey(removed[0] || "")).toBe(false);
    } finally {
      info.mockRestore();
    }
  });
});

describe("groom screen and switches", () => {
  it("shows text chips, hides empty photo cards, and keeps one scroll", () => {
    const html = renderToStaticMarkup(createElement(GroomFlow, { config: salon }));
    for (const item of [...GROOM_HAIR, ...GROOM_BEARDS, ...GROOM_GROOMING]) expect(html).toContain(item.name);
    for (const slot of GROOM_OWN_SLOTS) expect(html).toContain(slot.label);
    expect(html).toContain("Your own look");
    expect(html).toContain("Take a close-up of each piece on its own");
    expect(html).toContain("Take photo");
    expect(html).toContain("Use photo");
    expect(html).toContain("btn sheen");
    expect(html).not.toContain("Photo coming");
    expect(html).not.toContain("data-pills=\"category\"");
    expect(html).not.toContain("overflow-y-auto");
    expect(html).not.toContain("Join queue");
    expect(html).not.toMatch(/gold/i);
    expect(guestSections({ everyday: true, bridal: true, groom: false })).toEqual(["everyday", "bridal"]);
    expect(guestSections({ everyday: false, bridal: false, groom: true })).toEqual(["groom"]);
    expect(salonActionItems({ phone: true, showQueue: true, bridalOn: false, groomOn: true })).toEqual(["book", "chat"]);
    expect(salonActionItems({ phone: true, showQueue: true, bridalOn: true })).toEqual(["book", "chat"]);
  });

  it("hides a turned-off tab and offers both switches to the owner", () => {
    const html = renderToStaticMarkup(createElement(TryOnApp, {
      config: { ...salon, name: "Demo", whatsapp: "919800011122", toolStyle: true, styles: [], shades: [], brows: [], beards: [], nails: [] } as SalonConfig,
      showEveryday: true,
      showBridal: false,
      showGroom: true,
      showQueue: true,
    }));
    expect(html).toContain("Groom");
    expect(html).toContain("Everyday");
    expect(html).not.toContain("aria-label=\"Bridal\"");
    const settings = renderToStaticMarkup(createElement(SettingsForm, {
      initial: {
        name: "Demo",
        primaryColor: "#3e304b",
        accentColor: "#7d5a9e",
        whatsapp: "",
        address: "",
        mapsUrl: "",
        city: "",
        gstin: "",
        removeBranding: false,
        toolColour: true,
        toolStyle: true,
        toolBrows: true,
        toolBeard: true,
        toolNails: true,
        hairPickerOn: true,
        hairSuggestOn: false,
        hairSuggestUsesCredits: false,
        anonDailyCap: 8,
        memberDailyCap: 30,
        requireLoginToBook: false,
        productBridal: true,
        productGroom: false,
        logoUrl: null,
      },
      canRemoveBranding: false,
      members: [],
      selfId: "owner",
    }));
    expect(settings).toContain("aria-label=\"Bridal\"");
    expect(settings).toContain("aria-label=\"Groom\"");
    expect(settings).toContain("Off by default");
    const sql = readFileSync("prisma/migrations/20261018000000_groom/migration.sql", "utf8");
    expect(sql).toContain(`"productGroom" BOOLEAN NOT NULL DEFAULT false`);
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toContain("productBridal       Boolean   @default(true)");
    expect(schema).toContain("productGroom        Boolean   @default(false)");
  });
});
