import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { MAIL_NOT_CONFIGURED, MAIL_SEND_FAILED } from "@/lib/mail";
import { shareableLookUrl } from "@/lib/media-link";
import { buildBridalPrompt, bridalEyeLines } from "@/lib/prompts";
import { cardDisplayUrl, qrCardSvg } from "@/lib/qr-card";
import { isShareLink, lookShareLink, verifyShareToken } from "@/lib/share-link";

beforeAll(() => {
  process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-for-share-links";
  process.env.APP_BASE_URL = "https://app.example.test";
});

describe("row 37: forgot password copy", () => {
  it("never shows env var names or scripts to a customer", () => {
    for (const text of [MAIL_NOT_CONFIGURED, MAIL_SEND_FAILED]) {
      expect(text).not.toMatch(/RESEND|SMTP|EMAIL_FROM|scripts\//);
    }
    for (const file of ["src/app/api/v1/auth/forgot/route.ts", "src/app/api/v1/auth/magic/route.ts"]) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toMatch(/message: "[^"]*(RESEND_API_KEY|SMTP_URL)[^"]*" \}, \{ status: 5/);
    }
  });
  it("Back to sign in is a styled button", () => {
    const page = readFileSync("src/app/login/reset/page.tsx", "utf8");
    expect(page).toMatch(/className="btn secondary[^"]*" href="\/login"/);
  });
});

describe("row 46: WhatsApp share link", () => {
  it("has no storage key or query string and still verifies", () => {
    const link = lookShareLink("tenant1", "11111111-2222-3333-4444-555555555555", 3600);
    expect(link).toMatch(/^https:\/\/app\.example\.test\/l\/[^?]+$/);
    expect(link).not.toMatch(/key=|sig=|generations/);
    const token = link.split("/l/")[1];
    expect(verifyShareToken(token)).toBe("generations/tenant1/11111111-2222-3333-4444-555555555555/result.jpg");
    expect(isShareLink(link)).toBe(true);
    expect(shareableLookUrl(link)).toBe(link);
  });
  it("rejects a tampered or expired token", () => {
    const link = lookShareLink("tenant1", "req1", 3600);
    const token = link.split("/l/")[1];
    expect(verifyShareToken(token.slice(0, -2) + "xx")).toBe("");
    const old = lookShareLink("tenant1", "req1", -10).split("/l/")[1];
    expect(verifyShareToken(old)).toBe("");
  });
});

describe("owner ask: QR card", () => {
  it("shows only the salon name, QR and customer website", async () => {
    const svg = await qrCardSvg({ name: "Demo Salon – Bengaluru", url: "https://demo.try.agenticbuildworks.com/welcome" });
    const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    expect(texts).toEqual(["Demo Salon – Bengaluru", "demo.try.agenticbuildworks.com"]);
    expect(svg).toContain("<path");
    expect(cardDisplayUrl("https://demo.try.agenticbuildworks.com/welcome")).toBe("demo.try.agenticbuildworks.com");
  });
  it("escapes salon names", async () => {
    const svg = await qrCardSvg({ name: "A & B <Salon>", url: "https://ab.try.agenticbuildworks.com/welcome" });
    expect(svg).toContain("A &amp; B &lt;Salon&gt;");
  });
});

describe("row 47: bridal eye and brow strength", () => {
  it("adds concrete instructions only for chosen items", () => {
    expect(bridalEyeLines({})).toEqual([]);
    const lines = bridalEyeLines({ kajal: true, brow: true });
    expect(lines.join(" ")).toMatch(/kajal/);
    expect(lines.join(" ")).toMatch(/eyebrows/);
    expect(lines.join(" ")).not.toMatch(/lashes on the upper lids/);
  });
  it("reaches the bridal prompt", () => {
    const look = { id: "x", name: "Test", prompt: "Gold jewellery.", outfit: false } as never;
    const prompt = buildBridalPrompt(look, { prompt: "HD finish." } as never, { name: "Red" } as never, { kajal: true, brow: true });
    expect(prompt).toMatch(/bold black bridal kajal/);
    expect(prompt).toMatch(/Brows: fill and define/);
  });
});
