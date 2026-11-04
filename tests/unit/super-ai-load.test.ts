import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scrubProviderBody } from "@/lib/logger";

describe("super AI load", () => {
  it("paints the AI page before spend and keeps the sidebar outside the page slot", () => {
    const page = readFileSync("src/app/super/ai/page.tsx", "utf8");
    const layout = readFileSync("src/app/super/layout.tsx", "utf8");
    const nav = readFileSync("src/components/admin/SuperShell.tsx", "utf8");
    const view = readFileSync("src/lib/ai/settings-store.ts", "utf8");
    expect(page).toContain('platformAiView({ spend: "skip" })');
    expect(page).toContain("guestModelPriceRows()");
    expect(layout).toContain("<SuperNav />");
    expect(layout).not.toContain("<SuperNav>{children}</SuperNav>");
    expect(nav).toContain("<a");
    expect(nav).not.toContain("next/link");
    const viewFn = view.slice(view.indexOf("async function platformMap"), view.indexOf("export async function salonAiView"));
    expect(viewFn).toContain("platformSetting.findMany");
    expect(viewFn).toContain("cachedSpendSummary");
    expect(viewFn).not.toContain("testProviderKey");
    expect(viewFn).not.toContain("testFalKey");
    expect(viewFn).not.toContain("api.openai.com");
    expect(viewFn).not.toContain("api.fal.ai");
  });

  it("scrubs provider bodies before they are logged", () => {
    const text = scrubProviderBody(JSON.stringify({
      detail: "field required",
      prompt: "keep the face",
      image_urls: ["https://cdn.example/secret-photo.jpg"],
      authorization: "Key fal-test-key-123456",
    }));
    expect(text).toContain("field required");
    expect(text).not.toContain("keep the face");
    expect(text).not.toContain("secret-photo");
    expect(text).not.toContain("fal-test-key-123456");
  });
});
