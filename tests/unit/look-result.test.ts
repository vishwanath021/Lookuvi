import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LookResultActions, LookZoom } from "@/components/tryon/LookResultActions";
import { lookDownloadName, lookShareMessage } from "@/lib/look-result";

describe("look result actions", () => {
  it("names the full-resolution file salon, look, and date", () => {
    expect(lookDownloadName("Demo Salon", "Telugu Muhurtham Classic", new Date(2026, 9, 18))).toBe("demo-salon-telugu-muhurtham-classic-2026-10-18.jpg");
    expect(lookShareMessage("bridal", "Soft rose", "https://look.example/a")).toBe("Look at this bridal look: Soft rose. https://look.example/a");
    expect(lookShareMessage("groom", "Your own look")).toBe("Look at this groom look: Your own look.");
  });

  it("offers download, WhatsApp, and zoom controls", () => {
    const actions = renderToStaticMarkup(createElement(LookResultActions, {
      slug: "demo",
      name: "Soft rose",
      imageUrl: "/look.jpg",
      kind: "bridal",
    }));
    expect(actions).toContain("Download");
    expect(actions).toContain("Share on WhatsApp");
    const zoom = renderToStaticMarkup(createElement(LookZoom, { src: "/look.jpg", onClose: () => undefined }));
    expect(zoom).toContain("Zoom in");
    expect(zoom).toContain("Zoom out");
    expect(zoom).toContain("data-zoom=\"open\"");
    expect(zoom).not.toContain("overflow-y-auto");
  });
});