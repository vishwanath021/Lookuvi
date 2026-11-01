import { afterEach, describe, expect, it } from "vitest";
import {
  companyCin,
  companyGstin,
  companyLegalName,
  copyrightEmail,
  grievanceOfficerEmail,
  grievanceOfficerName,
  grievanceOfficerPhone,
  marketingUnsubscribeUrl,
  postalAddress,
  supportEmail,
} from "@/lib/legal";
import { mailFooter } from "@/lib/mail";

const keys = [
  "BRAND_LEGAL_NAME",
  "SUPPORT_EMAIL",
  "LEGAL_POSTAL_ADDRESS",
  "GRIEVANCE_OFFICER_NAME",
  "GRIEVANCE_OFFICER_EMAIL",
  "GRIEVANCE_OFFICER_PHONE",
  "COPYRIGHT_EMAIL",
  "MARKETING_UNSUBSCRIBE_URL",
  "COMPANY_CIN",
  "COMPANY_GSTIN",
] as const;

afterEach(() => {
  for (const key of keys) delete process.env[key];
});

describe("legal defaults", () => {
  it("uses Hyderabad address and Veerendra as grievance officer by default", () => {
    expect(companyLegalName()).toBe("Agentic Build Works");
    expect(supportEmail()).toBe("admin@agenticbuildworks.com");
    expect(postalAddress()).toContain("Kismatpur");
    expect(grievanceOfficerName()).toBe("Geddam Swami Veerendra");
    expect(grievanceOfficerEmail()).toBe("admin@agenticbuildworks.com");
    expect(grievanceOfficerPhone()).toBe("");
    expect(copyrightEmail()).toBe("admin@agenticbuildworks.com");
    expect(companyCin()).toBe("");
    expect(companyGstin()).toBe("");
    expect(marketingUnsubscribeUrl()).toBe("");
  });

  it("allows env overrides and skips marketing unsubscribe when unset", () => {
    process.env.LEGAL_POSTAL_ADDRESS = "Override Lane";
    process.env.GRIEVANCE_OFFICER_PHONE = "9999999999";
    process.env.MARKETING_UNSUBSCRIBE_URL = "https://example.com/unsub";
    expect(postalAddress()).toBe("Override Lane");
    expect(grievanceOfficerPhone()).toBe("9999999999");
    expect(mailFooter("marketing")).toContain("Unsubscribe: https://example.com/unsub");
    delete process.env.MARKETING_UNSUBSCRIBE_URL;
    expect(mailFooter("marketing")).not.toContain("Unsubscribe");
  });
});
