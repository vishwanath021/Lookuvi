import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { POST as generate } from "@/app/api/v1/tryon/generate/route";
import { claimGenerationJob, completeGenerationJob, jobFingerprint, replayReadyFingerprint } from "@/lib/ai/dedupe";
import { prisma } from "@/lib/prisma";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("@/auth", () => ({
  auth: async () => null,
}));

describe("session fingerprint replay", () => {
  afterEach(async () => {
    await prisma.generationJob.deleteMany({ where: { tenantId: "dedupe-tenant" } });
  });

  it("returns a ready image for the same session without a second job", async () => {
    await prisma.generationJob.deleteMany({ where: { tenantId: "dedupe-tenant" } });
    const photo = Buffer.from("selfie-bytes");
    const fingerprint = jobFingerprint({ photo, styleId: "pixie", tool: "style", shadeId: "", mode: "style", sessionId: "session-1" });
    const first = await claimGenerationJob({ tenantId: "dedupe-tenant", requestId: "req-cache-1", fingerprint });
    expect(first.kind).toBe("start");
    if (first.kind !== "start") return;
    await completeGenerationJob(first.id, { tenantId: "dedupe-tenant", requestId: "req-cache-1", image: Buffer.from("jpeg-bytes") });
    const hit = await replayReadyFingerprint("dedupe-tenant", fingerprint);
    expect(hit?.image.toString()).toBe("jpeg-bytes");
    const otherSession = jobFingerprint({ photo, styleId: "pixie", tool: "style", shadeId: "", mode: "style", sessionId: "session-2" });
    expect(await replayReadyFingerprint("dedupe-tenant", otherSession)).toBeNull();
    expect(await prisma.generationJob.count({ where: { tenantId: "dedupe-tenant" } })).toBe(1);
  });
});

describe("generate route does not reserve a second try", () => {
  const slug = `replay-${Date.now()}`;

  afterEach(async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (!tenant) return;
    await prisma.generationJob.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tryOn.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.consentLog.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  it("replays the same photo and style before reserving another try", async () => {
    const tenant = await prisma.tenant.create({
      data: { slug, name: slug, productTryOn: true, tryOnsAtSalon: false, monthlyTryAllowance: 30, dailyCap: 100 },
    });
    const jpeg = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#c4b5a0" } }).jpeg().toBuffer();
    const sessionId = "session-replay-12345678";

    async function post(requestId: string) {
      const form = new FormData();
      form.set("slug", slug);
      form.set("styleId", "soft-bob");
      form.set("tool", "style");
      form.set("sessionId", sessionId);
      form.set("requestId", requestId);
      form.set("photo", new File([new Uint8Array(jpeg)], "selfie.jpg", { type: "image/jpeg" }));
      return generate(new Request("http://localhost/api/v1/tryon/generate", { method: "POST", body: form }));
    }

    const first = await post("req-route-replay-1");
    expect(first.status, await first.clone().text()).toBe(200);
    const tries = await prisma.tryOn.count({ where: { tenantId: tenant.id } });
    const second = await post("req-route-replay-2");
    expect(second.status, await second.clone().text()).toBe(200);
    expect(second.headers.get("x-tryon-id")).toBe("replay");
    expect(await prisma.tryOn.count({ where: { tenantId: tenant.id } })).toBe(tries);
  });
});
