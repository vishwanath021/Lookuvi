import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsentSheet } from "@/components/tryon/ConsentSheet";
import { AiGeneratedBadge } from "@/components/legal/AiGeneratedBadge";
import { CONSENT_VERSION } from "@/data/consent-copy";
import { maskPhone, redact } from "@/lib/logger";
import { mailFooter } from "@/lib/mail";
import { lookDownloadName } from "@/lib/look-result";

describe("compliance consent + logger + mail", () => {
  it("requires an 18+/guardian checkbox before agree is enabled", () => {
    const html = renderToStaticMarkup(
      createElement(ConsentSheet, { open: true, lang: "en", onAgree: () => undefined, onClose: () => undefined }),
    );
    expect(html).toContain('data-testid="consent-age"');
    expect(html).toContain("disabled");
    expect(html).toContain("Withdraw or delete");
    expect(html).toContain("/privacy");
    expect(CONSENT_VERSION).toBe("2026-10-31");
  });

  it("labels AI-generated results and download names", () => {
    const badge = renderToStaticMarkup(createElement(AiGeneratedBadge, { lang: "en" }));
    expect(badge).toContain('data-ai-generated="yes"');
    expect(badge).toContain("AI-generated");
    expect(lookDownloadName("demo", "bob")).toMatch(/^ai-preview-demo-bob-/);
  });

  it("masks phones and PII keys in redact()", () => {
    expect(maskPhone("Call 9876543210 now")).toContain("***3210");
    expect(maskPhone("9876543210")).toBe("***3210");
    const safe = redact({ phone: "9876543210", name: "Asha", note: "ok", nested: { mobile: "9123456789" } }) as Record<string, unknown>;
    expect(String(safe.phone)).toContain("3210");
    expect(safe.name).toBe("[redacted]");
    expect(String(safe.note)).toBe("ok");
    const nested = safe.nested as Record<string, unknown>;
    expect(String(nested.mobile)).toMatch(/\*\*\*6789|redacted/);
  });

  it("appends sender identity and postal placeholder on email footers", () => {
    const tx = mailFooter("transactional");
    expect(tx).toContain("Agentic Build Works");
    expect(tx).toContain("[Registered address]");
    expect(tx).not.toContain("Unsubscribe");
    const mk = mailFooter("marketing");
    expect(mk).toContain("Unsubscribe");
  });
});
