import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LegalFooter } from "@/components/legal/LegalFooter";
import GrievancePage from "@/app/grievance/page";
import RefundPage from "@/app/refund/page";
import AiDisclosurePage from "@/app/ai-disclosure/page";
import CopyrightPage from "@/app/copyright/page";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";

const root = join(process.cwd());

describe("compliance legal pages", () => {
  it("exposes grievance placeholders and timelines", () => {
    const html = renderToStaticMarkup(createElement(GrievancePage));
    expect(html).toContain("[Grievance Officer name]");
    expect(html).toContain("48 hours");
    expect(html).toContain("30 days");
  });

  it("publishes refund, AI disclosure, copyright, privacy, and terms pages", () => {
    for (const Page of [RefundPage, AiDisclosurePage, CopyrightPage, PrivacyPage, TermsPage]) {
      const html = renderToStaticMarkup(createElement(Page));
      expect(html.length).toBeGreaterThan(200);
      expect(html.toLowerCase()).not.toContain("template");
      expect(html.toLowerCase()).not.toContain("lawyer");
    }
    const privacy = renderToStaticMarkup(createElement(PrivacyPage));
    expect(privacy).toContain("Google Gemini");
    expect(privacy).toContain("outside India");
    expect(privacy).toContain("Cookies");
    expect(privacy).toContain("targeted advertising");
    const terms = renderToStaticMarkup(createElement(TermsPage));
    expect(terms).toContain("unlawful");
    expect(terms).toContain("/refund");
  });

  it("renders a shared legal footer", () => {
    const html = renderToStaticMarkup(createElement(LegalFooter));
    expect(html).toContain("/privacy");
    expect(html).toContain("/grievance");
    expect(html).toContain("/ai-disclosure");
    expect(html).toContain('data-legal-footer="yes"');
  });

  it("documents CERT-In retention and configures docker json-file logging", () => {
    const cert = readFileSync(join(root, "docs/CERT-IN.md"), "utf8");
    expect(cert).toContain("180 days");
    expect(cert).toContain("6 hours");
    expect(cert).toContain("NTP");
    const compose = readFileSync(join(root, "docker-compose.prod.yml"), "utf8");
    expect(compose).toContain("json-file");
    expect(compose).toContain("max-file");
    const incident = readFileSync(join(root, "src/lib/security-incident.ts"), "utf8");
    expect(incident).toContain("SECURITY_INCIDENT");
  });
});
