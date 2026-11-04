import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("style thumbnails", () => {
  it("serves a smaller webp and caches the catalogue images", () => {
    const full = statSync("public/styles/crew-cut.jpg").size;
    const thumb = statSync("public/styles/thumbs/crew-cut.webp").size;
    expect(thumb).toBeLessThan(full / 2);
    expect(statSync("public/brows/cards/thumbs/high-arch.webp").size).toBeLessThan(statSync("public/brows/cards/high-arch.webp").size);
    const config = readFileSync("next.config.ts", "utf8");
    expect(config).toContain('source: "/styles/:path*"');
    expect(config).toContain("public, max-age=86400, stale-while-revalidate=604800");
    const card = readFileSync("src/components/tryon/StyleCard.tsx", "utf8");
    expect(card).toContain('loading="lazy"');
    expect(card).toContain("/thumbs/");
    const app = readFileSync("src/components/tryon/TryOnApp.tsx", "utf8");
    expect(app).toContain('!showResult && !busy && tool === "brows"');
  });
});
