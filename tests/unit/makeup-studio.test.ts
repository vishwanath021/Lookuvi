import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as renderStudio } from "@/app/api/v1/makeup-studio/render/route";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { TryOnApp } from "@/components/tryon/TryOnApp";
import { guestSections } from "@/lib/guest-sections";
import {
  applyPreset,
  buildMakeupPrompt,
  clampLook,
  DEFAULT_LOOK,
  EYE_IDS,
  FINISH_IDS,
  LIP_IDS,
  LIP_SHADES,
  LOOK_PRESETS,
  MAKEUP_STUDIO_KIND,
  matchingPreset,
  paintRecipe,
  PRESET_IDS,
  PRESET_LIST,
  REGION_RINGS,
} from "@/lib/makeup-studio/core";
import type { LookParams } from "@/lib/makeup-studio/core";
import { prisma } from "@/lib/prisma";
import type { SalonConfig } from "@/lib/salon";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => null),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const salon = { slug: "demo", defaultLang: "en", name: "Demo", whatsapp: "", toolStyle: true, styles: [], shades: [], brows: [], beards: [], nails: [] } as SalonConfig;

const FORBIDDEN = [
  "deep wine burgundy",
  "Keep the exact same person",
  "mubysoniya",
  "Makeup Lab",
  "#6E1B33",
  "#E0708A",
  "#B98A6E",
  "#3A2B2B",
  "#B4763F",
];

describe("makeup studio looks", () => {
  it("keeps the existing guest tabs and adds makeup only when the switch is on", () => {
    expect(guestSections({ everyday: true, bridal: true, groom: false })).toEqual(["everyday", "bridal"]);
    expect(guestSections({ everyday: false, bridal: false, groom: true })).toEqual(["groom"]);
    expect(guestSections({ everyday: true, bridal: true, groom: true, makeup: true })).toEqual(["everyday", "bridal", "groom", "makeup"]);
    const hidden = renderToStaticMarkup(createElement(TryOnApp, { config: salon, showEveryday: true, showBridal: true, showGroom: false, showMakeup: false }));
    expect(hidden).toContain("aria-label=\"Everyday\"");
    expect(hidden).toContain("aria-label=\"Bridal\"");
    expect(hidden).not.toContain("aria-label=\"Makeup\"");
    const shown = renderToStaticMarkup(createElement(TryOnApp, { config: salon, showEveryday: true, showBridal: false, showGroom: false, showMakeup: true }));
    expect(shown).toContain("aria-label=\"Makeup\"");
    expect(shown).toContain("Photo makeup");
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
        monthlyTryAllowance: 30,
        requireLoginToBook: false,
        productBridal: false,
        productGroom: false,
        productMakeupStudio: false,
        visitTryLimit: 3,
        logoUrl: null,
      },
      canRemoveBranding: false,
      members: [],
      selfId: "owner",
    }));
    expect(settings).toContain("aria-label=\"Makeup studio\"");
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toContain("productMakeupStudio Boolean   @default(false)");
    const sql = readFileSync("prisma/migrations/20261026000000_makeup_studio/migration.sql", "utf8");
    expect(sql).toContain(`"productMakeupStudio" BOOLEAN NOT NULL DEFAULT false`);
  });

  it("lets one preset set every field, and clamps anything outside the lists", () => {
    for (const id of PRESET_IDS) {
      const look = applyPreset(id);
      const keys: (keyof LookParams)[] = ["foundation", "blush", "intensity", "lip", "eyes", "finish", "quality", "gloss"];
      for (const key of keys) expect(look[key]).toEqual(LOOK_PRESETS[id].params[key]);
      expect(matchingPreset(look)).toBe(id);
      expect(look).not.toBe(LOOK_PRESETS[id].params);
    }
    expect(PRESET_LIST.map((item) => item.id)).toContain("telugu-bridal");
    expect(LOOK_PRESETS["telugu-bridal"].params.lip).toBe("red");
    expect(LOOK_PRESETS["telugu-bridal"].params.eyes).toBe("bridal");
    const messy = clampLook({ foundation: 400, blush: -3, intensity: "85", lip: "not-a-colour", eyes: "smokey", finish: "glass", quality: "high", gloss: "yes", extra: "ignore" });
    expect(messy).toEqual({
      foundation: 100,
      blush: 0,
      intensity: 85,
      lip: DEFAULT_LOOK.lip,
      eyes: "smokey",
      finish: "glass",
      quality: "high",
      gloss: false,
    });
    expect(LIP_IDS).toContain(messy.lip);
    expect(EYE_IDS).toContain(messy.eyes);
    expect(FINISH_IDS).toContain(messy.finish);
  });

  it("builds a prompt from the look and leaves other products' wording out", () => {
    const bridal = buildMakeupPrompt(applyPreset("bridal"));
    expect(bridal).toContain(LIP_SHADES.wine.phrase);
    expect(bridal).toContain(LIP_SHADES.wine.hex);
    expect(bridal).toContain("Foundation strength 66 out of 100");
    expect(bridal).toContain("warm bronze on the lid");
    expect(bridal).toContain("dewy finish");
    expect(bridal).toContain("without a mirror shine");
    expect(bridal).toContain("Image 2 is a flat lip-colour chip");
    const glossy = buildMakeupPrompt(applyPreset("party"));
    expect(glossy).toContain("thin clear gloss");
    expect(glossy).not.toBe(bridal);
    for (const phrase of FORBIDDEN) {
      expect(bridal.toLowerCase()).not.toContain(phrase.toLowerCase());
      expect(glossy.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
    const bare = paintRecipe({ ...DEFAULT_LOOK, foundation: 0, intensity: 0 }, 200);
    const full = paintRecipe({ ...DEFAULT_LOOK, foundation: 100, intensity: 100 }, 200);
    expect(full.coverage).toBeGreaterThan(bare.coverage);
    expect(full.lipMultiply).toBeGreaterThan(bare.lipMultiply);
    expect(paintRecipe(applyPreset("glam"), 180).gloss).toBeGreaterThan(0);
    expect(paintRecipe(applyPreset("natural"), 180).gloss).toBe(0);
  });

  it("keeps region indexes inside the 478-point mesh", () => {
    const seen = new Set<number>();
    for (const ring of REGION_RINGS) {
      expect(ring.length).toBeGreaterThan(2);
      for (const index of ring) {
        expect(Number.isInteger(index)).toBe(true);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(478);
        seen.add(index);
      }
    }
    expect(seen.size).toBeGreaterThan(40);
  });
});

describe("makeup studio photoreal route", () => {
  afterEach(async () => {
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: "makeup-" } } });
  });

  async function jpeg() {
    const buf = await sharp({ create: { width: 96, height: 128, channels: 3, background: { r: 180, g: 140, b: 120 } } }).jpeg().toBuffer();
    return new File([new Uint8Array(buf)], "portrait.jpg", { type: "image/jpeg" });
  }

  function form(slug: string, file?: File) {
    const body = new FormData();
    body.set("slug", slug);
    body.set("sessionId", "session-makeup-1");
    body.set("look", JSON.stringify(applyPreset("bridal")));
    body.set("requestId", "makeup-request-1");
    if (file) body.set("photo", file);
    return body;
  }

  it("refuses the route when the salon switch is off", async () => {
    const tenant = await prisma.tenant.create({
      data: { slug: `makeup-off-${Date.now()}`, name: "Off", productMakeupStudio: false, creditBalance: 5 },
    });
    const res = await renderStudio(new Request("http://localhost/api/v1/makeup-studio/render", { method: "POST", body: form(tenant.slug, await jpeg()) }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("PRODUCT");
    expect(await prisma.tryOn.count({ where: { tenantId: tenant.id } })).toBe(0);
    const again = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(again?.creditBalance).toBe(5);
  });

  it("returns a sample image without spending a credit when the provider is mock", async () => {
    const tenant = await prisma.tenant.create({
      data: { slug: `makeup-on-${Date.now()}`, name: "On", productMakeupStudio: true, creditBalance: 0, visitTryLimit: 3 },
    });
    const res = await renderStudio(new Request("http://localhost/api/v1/makeup-studio/render", { method: "POST", body: form(tenant.slug, await jpeg()) }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/jpeg");
    expect(res.headers.get("x-demo-reason")).toBe("no-key");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(500);
    expect(bytes[0]).toBe(0xff);
    const row = await prisma.tryOn.findFirst({ where: { tenantId: tenant.id } });
    expect(row?.kind).toBe(MAKEUP_STUDIO_KIND);
    expect(row?.status).toBe("DEMO");
    expect(row?.credits).toBe(0);
    const saved = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(saved?.creditBalance).toBe(0);
  });
});
