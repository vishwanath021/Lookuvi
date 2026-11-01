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
import {
  DEFAULT_GRIEVANCE_OFFICER_EMAIL,
  DEFAULT_GRIEVANCE_OFFICER_NAME,
  DEFAULT_POSTAL_ADDRESS,
  FOUNDERS,
} from "@/lib/legal";

const root = join(process.cwd());

describe("compliance legal pages", () => {
  it("publishes grievance officer, founders, and address without bracket placeholders", () => {
    const html = renderToStaticMarkup(createElement(GrievancePage));
    expect(html).toContain(DEFAULT_GRIEVANCE_OFFICER_NAME);
    expect(html).toContain(DEFAULT_GRIEVANCE_OFFICER_EMAIL);
    expect(html).toContain(DEFAULT_POSTAL_ADDRESS);
    for (const name of FOUNDERS) expect(html).toContain(name);
    expect(html).toContain("48 hours");
    expect(html).toContain("30 days");
    expect(html).not.toMatch(/\[Grievance|\[Registered|\[Copyright/);
    expect(html.toLowerCase()).not.toContain("placeholder");
    expect(html).not.toContain("Phone:");
  });

  it("publishes refund, AI disclosure, copyright, privacy, and terms pages", () => {
    for (const Page of [RefundPage, AiDisclosurePage, CopyrightPage, PrivacyPage, TermsPage]) {
      const html = renderToStaticMarkup(createElement(Page));
      expect(html.length).toBeGreaterThan(200);
      expect(html.toLowerCase()).not.toContain("template");
      expect(html.toLowerCase()).not.toContain("lawyer");
      expect(html.toLowerCase()).not.toContain("placeholder");
      expect(html).not.toMatch(/\[[A-Z][^\]]{3,}\]/);
    }
    const privacy = renderToStaticMarkup(createElement(PrivacyPage));
    expect(privacy).toContain("Google Gemini");
    expect(privacy).toContain("outside India");
    expect(privacy).toContain("Cookies");
    expect(privacy).toContain("targeted advertising");
    expect(privacy).toContain(DEFAULT_POSTAL_ADDRESS);
    const terms = renderToStaticMarkup(createElement(TermsPage));
    expect(terms).toContain("unlawful");
    expect(terms).toContain("/refund");
    expect(terms).toContain(DEFAULT_POSTAL_ADDRESS);
    const copyright = renderToStaticMarkup(createElement(CopyrightPage));
    expect(copyright).toContain(DEFAULT_GRIEVANCE_OFFICER_EMAIL);
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
    expect(cert).toContain("T Sai Vishwanath");
    expect(cert).toContain("admin@agenticbuildworks.com");
    expect(cert).toContain("N/A");
    expect(cert).not.toMatch(/\[[A-Z][^\]]+\]/);
    const compose = readFileSync(join(root, "docker-compose.prod.yml"), "utf8");
    expect(compose).toContain("json-file");
    expect(compose).toContain("max-file");
    const incident = readFileSync(join(root, "src/lib/security-incident.ts"), "utf8");
    expect(incident).toContain("SECURITY_INCIDENT");
  });
});
