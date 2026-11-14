import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { POST as generate } from "@/app/api/v1/tryon/generate/route";
import { POST as bridalOwn } from "@/app/api/v1/bridal/own/route";
import { POST as groom } from "@/app/api/v1/groom/route";
import { POST as makeup } from "@/app/api/v1/makeup-studio/render/route";
import { GET as atSalonGet } from "@/app/api/v1/at-salon/route";
import { markArrived, NOT_AT_SALON_MESSAGE } from "@/lib/at-salon";
import { prisma } from "@/lib/prisma";
import { kolkataDayKey } from "@/lib/queue/day";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const slug = `salon-lock-all-${Date.now()}`;
const sessionId = "session-all-12345678";
const deviceId = "device-all-12345678";

async function salon() {
  return prisma.tenant.create({
    data: {
      slug,
      name: slug,
      productTryOn: true,
      productQueue: true,
      productBridal: true,
      productGroom: true,
      productMakeupStudio: true,
      tryOnsAtSalon: true,
      visitTryLimit: 3,
      monthlyTryAllowance: 30,
      dailyCap: 100,
      creditBalance: 40,
      toolStyle: true,
      toolColour: true,
      toolBrows: true,
      toolBeard: true,
      toolNails: true,
    },
  });
}

function tinyPhoto() {
  return new File([Uint8Array.from([1, 2, 3])], "selfie.jpg", { type: "image/jpeg" });
}

async function post(route: (req: Request) => Promise<Response>, fields: Record<string, string>) {
  const form = new FormData();
  form.set("slug", slug);
  form.set("sessionId", sessionId);
  form.set("deviceId", deviceId);
  form.set("photo", tinyPhoto());
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return route(new Request("http://localhost/api", { method: "POST", body: form }));
}

describe("at-salon gate on every paid endpoint", () => {
  afterEach(async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (!tenant) return;
    await prisma.generationJob.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.salonDayUnlock.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.queueSession.deleteMany({ where: { entry: { tenantId: tenant.id } } });
    await prisma.queueEntry.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tryOn.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.consentLog.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  it("records the demo seed lock as off and the schema default as on", () => {
    const seed = readFileSync("prisma/seed.ts", "utf8");
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(seed.match(/tryOnsAtSalon: false/g)?.length).toBeGreaterThanOrEqual(2);
    expect(schema).toContain("@default(true)");
    expect(schema).toMatch(/tryOnsAtSalon\s+Boolean\s+@default\(true\)/);
  });

  it("blocks a joined guest on every category until Arrived, then allows the try", async () => {
    const tenant = await salon();
    const entry = await prisma.queueEntry.create({
      data: {
        tenantId: tenant.id,
        dayKey: kolkataDayKey(),
        token: 8,
        name: "Remote",
        phone: "919800011188",
        status: "WAITING",
        source: "ONLINE",
        cancelToken: `cancel-${Date.now()}-all`,
        sessionId,
        deviceId,
      },
    });
    const home = await atSalonGet(new Request(`http://localhost/api/v1/at-salon?slug=${slug}&sessionId=${sessionId}&deviceId=${deviceId}`));
    expect(home.status).toBe(200);
    expect(await home.json()).toMatchObject({ required: true, unlocked: false });

    const calls: [string, (req: Request) => Promise<Response>, Record<string, string>][] = [
      ["style", generate, { styleId: "soft-bob", tool: "style", requestId: "req-style-blocked1" }],
      ["colour", generate, { styleId: "honey", tool: "colour", requestId: "req-colour-blocked1" }],
      ["brows", generate, { styleId: "soft-arch", tool: "brows", requestId: "req-brows-blocked1" }],
      ["beard", generate, { styleId: "short", tool: "beard", requestId: "req-beard-blocked1" }],
      ["nails", generate, { styleId: "french", tool: "nails", requestId: "req-nails-blocked1" }],
      ["bridal", generate, { styleId: "bridal-look", tool: "bridal", requestId: "req-bridal-blocked1" }],
      ["mehendi", generate, { styleId: "mehendi", tool: "mehendi", requestId: "req-mehendi-blocked1" }],
      ["bridal-own", bridalOwn, { requestId: "req-own-blocked1" }],
      ["groom", groom, { requestId: "req-groom-blocked1" }],
      ["makeup", makeup, { look: JSON.stringify({ lip: "rose" }), requestId: "req-makeup-blocked1" }],
    ];
    for (const [name, route, fields] of calls) {
      const res = await post(route, fields);
      const body = await res.json();
      expect(res.status, name).toBe(403);
      expect(body.error, name).toBe("NOT_AT_SALON");
      expect(body.message, name).toBe(NOT_AT_SALON_MESSAGE);
    }
    expect(await prisma.tryOn.count({ where: { tenantId: tenant.id } })).toBe(0);

    expect((await markArrived(tenant.id, entry.id)).ok).toBe(true);
    const unlocked = await atSalonGet(new Request(`http://localhost/api/v1/at-salon?slug=${slug}&sessionId=${sessionId}&deviceId=${deviceId}`));
    expect(await unlocked.json()).toMatchObject({ required: true, unlocked: true });

    const jpeg = await sharp({ create: { width: 64, height: 80, channels: 3, background: "#c4b5a0" } }).jpeg().toBuffer();
    async function stylePost(requestId: string) {
      const form = new FormData();
      form.set("slug", slug);
      form.set("sessionId", sessionId);
      form.set("deviceId", deviceId);
      form.set("styleId", "soft-bob");
      form.set("tool", "style");
      form.set("requestId", requestId);
      form.set("photo", new File([new Uint8Array(jpeg)], "selfie.jpg", { type: "image/jpeg" }));
      return generate(new Request("http://localhost/api/v1/tryon/generate", { method: "POST", body: form }));
    }
    const allowed = await stylePost("req-style-arrived");
    expect(allowed.status, await allowed.clone().text()).toBe(200);
    const used = await prisma.tryOn.count({ where: { tenantId: tenant.id } });
    const replayRes = await stylePost("req-style-replay");
    expect(replayRes.status, await replayRes.clone().text()).toBe(200);
    expect(replayRes.headers.get("x-tryon-id")).toBe("replay");
    expect(await prisma.tryOn.count({ where: { tenantId: tenant.id } })).toBe(used);

    for (const [name, route, fields] of calls.slice(1)) {
      const res = await post(route, { ...fields, requestId: fields.requestId.replace("blocked1", "arrived") });
      const body = await res.json().catch(() => ({}));
      expect(body.error, name).not.toBe("NOT_AT_SALON");
      expect(res.status, name).not.toBe(403);
    }
  });

  it("does not replay a ready preview for a guest who has not arrived", async () => {
    const tenant = await salon();
    await prisma.tenant.update({ where: { id: tenant.id }, data: { tryOnsAtSalon: false } });
    const jpeg = await sharp({ create: { width: 64, height: 80, channels: 3, background: "#b9a08a" } }).jpeg().toBuffer();
    async function stylePost(requestId: string) {
      const form = new FormData();
      form.set("slug", slug);
      form.set("sessionId", sessionId);
      form.set("deviceId", deviceId);
      form.set("styleId", "soft-bob");
      form.set("tool", "style");
      form.set("requestId", requestId);
      form.set("photo", new File([new Uint8Array(jpeg)], "selfie.jpg", { type: "image/jpeg" }));
      return generate(new Request("http://localhost/api/v1/tryon/generate", { method: "POST", body: form }));
    }
    const opened = await stylePost("req-open-1");
    expect(opened.status, await opened.clone().text()).toBe(200);
    const used = await prisma.tryOn.count({ where: { tenantId: tenant.id } });
    await prisma.tenant.update({ where: { id: tenant.id }, data: { tryOnsAtSalon: true } });
    const blocked = await stylePost("req-open-2");
    expect((await blocked.json()).error).toBe("NOT_AT_SALON");
    expect(await prisma.tryOn.count({ where: { tenantId: tenant.id } })).toBe(used);
  });
});
