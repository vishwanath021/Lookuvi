import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { loadVisitPhoto, photoDigest, refuseVisit, rememberVisitPhoto, unlockVisit } from "@/lib/visit-allowance";
import { selectionKey, takePreview, tryButton, tryCounterLabel, visitAllowed, VISIT_CAP_MESSAGE } from "@/lib/visit-tries";

describe("session preview cache", () => {
  it("returns the saved result and does not call the provider again", async () => {
    const cache = new Map<string, { url: string; name: string; before: string }>();
    const generate = vi.fn(async () => ({ url: "after", name: "Look", before: "before" }));
    const key = selectionKey("photo", { look: "classic", lip: "red" });
    const first = await takePreview({ cache, key, used: 0, allowance: 3, generate });
    const again = await takePreview({ cache, key, used: first.used, allowance: 3, generate });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(again.called).toBe(false);
    expect(again.result).toBe(first.result);
    expect(again.used).toBe(1);

    const changed = await takePreview({
      cache,
      key: selectionKey("photo", { look: "classic", lip: "nude" }),
      used: again.used,
      allowance: 3,
      generate,
    });
    expect(changed.called).toBe(true);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("stops a new try at the limit and keeps a cached try free", async () => {
    const generate = vi.fn(async () => ({ url: "after", name: "Look", before: "before" }));
    const blocked = await takePreview({ cache: new Map(), key: "new", used: 3, allowance: 3, generate });
    expect(blocked.called).toBe(false);
    expect("blocked" in blocked && blocked.blocked).toBe(true);
    expect(generate).not.toHaveBeenCalled();

    const cache = new Map([["same", { url: "after", name: "Look", before: "before" }]]);
    const replay = await takePreview({ cache, key: "same", used: 3, allowance: 3, generate });
    expect(replay.called).toBe(false);
    expect(replay.result?.url).toBe("after");
    expect(generate).not.toHaveBeenCalled();
    expect(visitAllowed(3, 3, 0)).toBe(false);
    expect(visitAllowed(3, 3, 3)).toBe(true);
    expect(tryCounterLabel(0, 3)).toBe("Try 1 of 3");
    expect(tryCounterLabel(1, 3)).toBe("Try 2 of 3");
    expect(tryButton({ ready: true, sameAsResult: true, atLimit: false, cached: true })).toEqual({
      label: "Change something to try again",
      enabled: false,
      note: "",
    });
    expect(tryButton({ ready: true, sameAsResult: false, atLimit: true, cached: false }).note).toBe(VISIT_CAP_MESSAGE);
  });
});

describe("visit allowance", () => {
  afterEach(async () => {
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: "visit-cap-" } } });
  });

  it("counts three real bridal tries, ignores samples, and unlocks another batch", async () => {
    const tenant = await prisma.tenant.create({
      data: { slug: `visit-cap-${Date.now()}`, name: "Visit cap", visitTryLimit: 3 },
    });
    const sessionId = "session-visit-12345678";
    for (let index = 0; index < 3; index += 1) {
      await prisma.tryOn.create({
        data: { tenantId: tenant.id, sessionId, kind: "BRIDAL", status: "SUCCEEDED" },
      });
    }
    await prisma.tryOn.create({ data: { tenantId: tenant.id, sessionId, kind: "BRIDAL", status: "DEMO" } });
    await prisma.tryOn.create({ data: { tenantId: tenant.id, sessionId, kind: "STYLE", status: "SUCCEEDED" } });
    const blocked = await refuseVisit(tenant.id, sessionId, tenant.visitTryLimit);
    expect(blocked).toMatchObject({ error: "VISIT_CAP", message: VISIT_CAP_MESSAGE, used: 3, allowance: 3 });
    await unlockVisit(tenant.id, sessionId, tenant.visitTryLimit);
    expect(await refuseVisit(tenant.id, sessionId, tenant.visitTryLimit)).toBeNull();

    const jpeg = Buffer.from("resized-selfie");
    const photoId = await rememberVisitPhoto(tenant.id, sessionId, jpeg);
    expect(photoId).toBe(photoDigest(jpeg));
    expect(await loadVisitPhoto(tenant.id, sessionId, photoId)).toEqual(jpeg);
  });

  it("checks the visit and reuses the stored photo before the provider", () => {
    const groom = readFileSync("src/app/api/v1/groom/route.ts", "utf8");
    const own = readFileSync("src/app/api/v1/bridal/own/route.ts", "utf8");
    const generate = readFileSync("src/app/api/v1/tryon/generate/route.ts", "utf8");
    expect(groom.indexOf("refuseVisit")).toBeLessThan(groom.indexOf("generateGroom("));
    expect(groom.indexOf("loadVisitPhoto")).toBeLessThan(groom.indexOf("generateGroom("));
    expect(own.indexOf("refuseVisit")).toBeLessThan(own.indexOf("generateOwnLook("));
    expect(own).toContain("loadVisitPhoto");
    expect(generate.indexOf("await refuseVisit")).toBeLessThan(generate.indexOf("await runGuestLookIfReady"));
    expect(generate).toContain("loadVisitPhoto");
  });
});
