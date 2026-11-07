import { describe, expect, it } from "vitest";
import { guestPageLocale, t } from "@/data/i18n";
import { isSharedPath, parseHost } from "@/lib/host";

describe("guest page language", () => {
  it("keeps Women, Men, and Kids in English when English is one of the salon languages", () => {
    const lang = guestPageLocale("te", ["te", "en"]);
    expect(lang).toBe("en");
    expect(t(lang, "women")).toBe("Women");
    expect(t(lang, "men")).toBe("Men");
    expect(t(lang, "kids")).toBe("Kids");
    expect(t("te", "women")).toBe("మహిళలు");
  });

  it("uses the salon language only when English is not offered", () => {
    expect(guestPageLocale("hi", ["hi"])).toBe("hi");
    expect(t(guestPageLocale("hi", ["hi"]), "women")).toBe("महिलाएँ");
    expect(guestPageLocale("nope", [])).toBe("en");
    expect(guestPageLocale(null, ["kn"])).toBe("kn");
  });
});

describe("legal pages on a salon host", () => {
  it("does not rewrite refund, grievance, AI disclosure, or copyright onto the salon", () => {
    for (const path of ["/refund", "/grievance", "/ai-disclosure", "/copyright", "/privacy", "/terms"]) {
      expect(isSharedPath(path)).toBe(true);
    }
    expect(isSharedPath("/s/demo")).toBe(false);
    expect(parseHost("demo.try.agenticbuildworks.com", "agenticbuildworks.com")).toMatchObject({ kind: "subdomain", slug: "demo" });
  });
});
