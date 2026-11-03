import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VisitUnlock } from "@/components/admin/VisitUnlock";
import { t } from "@/data/i18n";
import { QUEUE_JOIN_RATE_MESSAGE } from "@/lib/queue/service";

describe("launch copy", () => {
  it("names colour strength in English and keeps the other locale labels", () => {
    expect(t("en", "intensity")).toBe("Colour strength");
    expect(t("hi", "intensity")).toBe("तीव्रता");
    expect(t("kn", "intensity")).not.toBe("Colour strength");
  });

  it("explains the visit code for staff", () => {
    const html = renderToStaticMarkup(createElement(VisitUnlock, { show: true }));
    expect(html).toContain("Guest short code from the try-on limit screen");
    expect(html).toContain("Staff enter it here to allow more tries");
  });

  it("tells a guest the join limit is not about free chairs", () => {
    expect(QUEUE_JOIN_RATE_MESSAGE).toMatch(/phone or device this hour/i);
    expect(QUEUE_JOIN_RATE_MESSAGE).toMatch(/not about free chairs/i);
  });
});
