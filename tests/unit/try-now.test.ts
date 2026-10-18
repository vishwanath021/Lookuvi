import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BridalFlow } from "@/components/tryon/BridalFlow";
import { GroomFlow } from "@/components/tryon/GroomFlow";
import { tryNowReady } from "@/lib/try-now";
import type { SalonConfig } from "@/lib/salon";

const salon = { slug: "demo", defaultLang: "en", bridalPackages: [] } as SalonConfig;

function between(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  return source.slice(from, to);
}

describe("try now", () => {
  it("stays closed until the photo and the required choice are set", () => {
    expect(tryNowReady(false, true)).toBe(false);
    expect(tryNowReady(true, false)).toBe(false);
    expect(tryNowReady(true, true)).toBe(true);
  });

  it("does not start a preview from a photo or a choice change", () => {
    const bridal = readFileSync("src/components/tryon/BridalFlow.tsx", "utf8");
    expect(between(bridal, "async function captureLive", "function pickMakeup")).not.toContain("generate(");
    expect(between(bridal, "function pickMakeup", "function pickMehendi")).not.toContain("generate(");
    expect(bridal).not.toContain("1. The event");
    const groom = readFileSync("src/components/tryon/GroomFlow.tsx", "utf8");
    expect(between(groom, "async function captureLive", "async function generate")).not.toContain("generate(");
    const own = readFileSync("src/components/tryon/BridalOwnLook.tsx", "utf8");
    expect(between(own, "async function captureLive", "async function generate")).not.toContain("generate(");

    const html = renderToStaticMarkup(createElement(BridalFlow, { config: salon }));
    expect(html).toContain("You selected");
    expect(html).toContain("data-swatch=\"makeup\"");
    expect(html).toContain("Try now");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("photo-frame");
    expect(html).not.toContain("1. The event");
    expect(html).not.toContain("max-h-[240px]");

    const groomHtml = renderToStaticMarkup(createElement(GroomFlow, { config: salon }));
    expect(groomHtml).toContain("You selected");
    expect(groomHtml).toContain(">Try now<");
    expect(groomHtml).toContain("photo-frame");
    expect(groomHtml).toContain("Change");
    expect(groomHtml).not.toContain("1. Wedding hair");
  });
});
