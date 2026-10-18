import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { OWN_LOOK_MAX_BODY_BYTES, OWN_LOOK_MAX_BYTES, OWN_LOOK_PROVIDER_TIMEOUT_MS, OWN_LOOK_SLOTS } from "@/data/bridal-own";
import { generateOwnLook, planOwnLook } from "@/lib/bridal-own";
import { isFresh, ownItemKey, OWN_ITEMS_TTL_MS } from "@/lib/own-items-store";
import {
  fitInside,
  OWN_BODY_LIMIT_BYTES,
  OWN_ITEM_EDGE,
  OWN_PHOTO_MAX_BYTES,
  OWN_SELFIE_EDGE,
  payloadProblem,
  postPreview,
  PreviewFailure,
  previewFailureMessage,
} from "@/lib/own-upload";

async function jpeg(width: number, height: number, color: { r: number; g: number; b: number }) {
  return sharp({ create: { width, height, channels: 3, background: color } }).jpeg().toBuffer();
}

const MB = 1024 * 1024;

describe("own look: any subset of pieces", () => {
  const ids = OWN_LOOK_SLOTS.map((slot) => slot.id);
  const subsets = [[], ids.slice(0, 1), [ids[0], ids[2], ids[6]], ids.slice(1, 5), ids.slice(0, ids.length - 1), ids];

  it("marks every slot optional", () => {
    expect(OWN_LOOK_SLOTS.every((slot) => slot.optional)).toBe(true);
  });

  it.each(subsets.map((subset) => [subset.length, subset] as const))("plans a preview with %i pieces", (_count, subset) => {
    const plan = planOwnLook("makeup-soft-rose", [...subset].reverse() as string[]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.ordered.map((slot) => slot.id)).toEqual(ids.filter((id) => subset.includes(id)));
  });

  it("sends only the pieces she added, in slot order", async () => {
    const selfie = await jpeg(320, 400, { r: 210, g: 170, b: 150 });
    const piece = await jpeg(300, 300, { r: 150, g: 20, b: 40 });
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      const pick = ["long-haram", "saree", "earrings"];
      let sent: string[] = [];
      await generateOwnLook({
        selfie,
        items: pick.map((id) => ({ id, bytes: piece })),
        makeupId: "makeup-soft-rose",
        tenantId: "tenant",
        requestId: "subset",
        put: async () => undefined,
        remove: async () => undefined,
        edit: async (form) => {
          sent = (form.getAll("image[]") as File[]).map((file) => file.name);
          return jpeg(64, 80, { r: 10, g: 10, b: 10 });
        },
      });
      expect(sent).toEqual(["selfie.jpg", "saree.jpg", "earrings.jpg", "long-haram.jpg"]);
    } finally {
      info.mockRestore();
    }
  });
});

describe("own look: large payloads", () => {
  it("fits phone photos inside the upload edge", () => {
    expect(fitInside(4000, 3000, OWN_ITEM_EDGE)).toEqual({ width: 1024, height: 768 });
    expect(fitInside(3024, 4032, OWN_SELFIE_EDGE)).toEqual({ width: 1152, height: 1536 });
    expect(fitInside(800, 600, OWN_ITEM_EDGE)).toEqual({ width: 800, height: 600 });
  });

  it("a full set of shrunk 1024px photos stays far under every limit", async () => {
    const noisy = Buffer.alloc(1024 * 768 * 3);
    for (let i = 0; i < noisy.length; i += 1) noisy[i] = (i * 2654435761) % 251;
    const worst = await sharp(noisy, { raw: { width: 1024, height: 768, channels: 3 } }).jpeg({ quality: 80 }).toBuffer();
    expect(worst.length).toBeLessThan(OWN_PHOTO_MAX_BYTES);
    const all = [{ label: "selfie", size: worst.length * 2 }, ...OWN_LOOK_SLOTS.map((slot) => ({ label: slot.label, size: worst.length }))];
    expect(payloadProblem(all)).toBe("");
  });

  it("refuses raw phone photos before sending, with a clear message", () => {
    const raw = [{ label: "selfie", size: 3.3 * MB }, ...OWN_LOOK_SLOTS.slice(0, 4).map((slot) => ({ label: slot.label, size: 3.3 * MB }))];
    expect(payloadProblem(raw)).toMatch(/selfie photo is too large/);
    const many = Array.from({ length: 6 }, (_, i) => ({ label: `p${i}`, size: 1.9 * MB }));
    expect(payloadProblem(many)).toMatch(/too large together/);
  });

  it("keeps client and server limits in step", () => {
    expect(OWN_PHOTO_MAX_BYTES).toBe(OWN_LOOK_MAX_BYTES);
    expect(OWN_BODY_LIMIT_BYTES).toBeLessThan(OWN_LOOK_MAX_BODY_BYTES);
    expect(OWN_LOOK_PROVIDER_TIMEOUT_MS).toBeLessThan(120_000);
    const config = readFileSync("next.config.ts", "utf8");
    expect(config).toMatch(/middlewareClientMaxBodySize:\s*"20mb"/);
    expect(OWN_LOOK_MAX_BODY_BYTES).toBe(20 * MB);
  });

  it("the route answers an oversized body with 413 before reading it", async () => {
    const route = readFileSync("src/app/api/v1/bridal/own/route.ts", "utf8");
    const check = route.indexOf("declared > OWN_LOOK_MAX_BODY_BYTES");
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(route.indexOf("req.formData()"));
    expect(route).toContain("postImageEdit(apiKey, body, OWN_LOOK_PROVIDER_TIMEOUT_MS)");
    expect(route).toContain('settleCredits(tenant.id, creditRef, "REFUND")');
  });
});

describe("own look: failures always reach the guest", () => {
  const form = () => new FormData();

  it("never leaves the message empty", () => {
    for (const status of [400, 413, 429, 500, 502, 504]) expect(previewFailureMessage(status, {}).length).toBeGreaterThan(10);
    expect(previewFailureMessage(413, null)).toMatch(/too large/);
    expect(previewFailureMessage(400, { message: "Add the photo again." })).toBe("Add the photo again.");
  });

  it("turns a 413 HTML page from a proxy into a message", async () => {
    const fetcher = vi.fn(async () => new Response("<html>413</html>", { status: 413, headers: { "content-type": "text/html" } }));
    await expect(postPreview("/x", form(), 1000, fetcher as typeof fetch)).rejects.toThrow(/too large/);
  });

  it("passes the route's JSON message and body through", async () => {
    const fetcher = vi.fn(async () => Response.json({ error: "VISIT_CAP", message: "You used all tries." }, { status: 429 }));
    const failure = await postPreview("/x", form(), 1000, fetcher as typeof fetch).catch((error) => error);
    expect(failure).toBeInstanceOf(PreviewFailure);
    expect(failure.message).toBe("You used all tries.");
    expect(failure.data.error).toBe("VISIT_CAP");
  });

  it("treats a 200 JSON body as a failure", async () => {
    const fetcher = vi.fn(async () => Response.json({ message: "That preview did not finish." }));
    await expect(postPreview("/x", form(), 1000, fetcher as typeof fetch)).rejects.toThrow("That preview did not finish.");
  });

  it("reports a dropped connection and a timeout", async () => {
    const dropped = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    await expect(postPreview("/x", form(), 1000, dropped as typeof fetch)).rejects.toThrow(/connection dropped/);
    const hang = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    await expect(postPreview("/x", form(), 20, hang as unknown as typeof fetch)).rejects.toThrow(/taking too long/);
  });

  it("resolves with the image on success", async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } }));
    const res = await postPreview("/x", form(), 1000, fetcher as typeof fetch);
    expect(res.status).toBe(200);
  });

  it("shows errors next to Try now, not below the flow", () => {
    const own = readFileSync("src/components/tryon/BridalOwnLook.tsx", "utf8");
    const section = own.slice(own.indexOf('<section id="own-photo"'), own.indexOf("</section>", own.indexOf('<section id="own-photo"')));
    expect(section).toContain('data-own-error="yes"');
    expect(own).toContain("shrinkPhoto(raw, edge)");
  });
});

describe("own look: pieces survive a reload in the same tab", () => {
  it("scopes saved pieces to the tab and expires them", () => {
    expect(ownItemKey("tab1", "bridal:demo", "saree")).toBe("tab1|bridal:demo|saree");
    const now = 1_000_000_000;
    expect(isFresh(now - 1000, now)).toBe(true);
    expect(isFresh(now - OWN_ITEMS_TTL_MS, now)).toBe(false);
    expect(isFresh(now + 5000, now)).toBe(false);
  });

  it("keeps the own-look panel mounted across tab switches", () => {
    const flow = readFileSync("src/components/tryon/BridalFlow.tsx", "utf8");
    expect(flow).toContain('hidden={panel !== "own"}');
    expect(flow).not.toContain('panel === "own" && <div');
  });
});
