import { describe, expect, it } from "vitest";
import { GET as jobGet } from "@/app/api/v1/tryon/jobs/route";
import { guestJobFailureMessage, postGuestGenerate } from "@/lib/guest-preview";
import { prisma } from "@/lib/prisma";

describe("guest job failure", () => {
  it("reads a failed message and hides a pending one", () => {
    expect(guestJobFailureMessage({ status: "FAILED", message: "The preview did not finish. It was not started again." }))
      .toBe("The preview did not finish. It was not started again.");
    expect(guestJobFailureMessage({ status: "PENDING", message: "secret" })).toBe("");
    expect(guestJobFailureMessage({ status: "FAILED", message: "" })).toMatch(/did not finish/);
  });

  it("stops generate when the job row is FAILED", async () => {
    let aborted = false;
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      if (String(url).includes("/api/v1/tryon/jobs")) {
        return new Response(JSON.stringify({
          status: "FAILED",
          message: "The preview did not finish. It was not started again.",
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as typeof fetch;
    const res = await postGuestGenerate({
      slug: "demo",
      body: new FormData(),
      requestId: "req-failed-1",
      fetchImpl,
      pollMs: 5,
    });
    expect(aborted).toBe(true);
    expect(res.status).toBe(502);
    expect((await res.json()).message).toBe("The preview did not finish. It was not started again.");
  });

  it("returns the stored failure for the salon and request id", async () => {
    const slug = `job-${Date.now()}`;
    const tenant = await prisma.tenant.create({ data: { slug, name: "Job salon" } });
    await prisma.generationJob.create({
      data: {
        tenantId: tenant.id,
        requestId: "req-failed-2",
        fingerprint: "abc",
        status: "FAILED",
        outcome: "provider",
        message: "The preview did not finish. It was not started again.",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const failed = await jobGet(new Request(`http://localhost/api/v1/tryon/jobs?slug=${slug}&requestId=req-failed-2`));
    expect(failed.status).toBe(200);
    expect(await failed.json()).toMatchObject({
      status: "FAILED",
      outcome: "provider",
      message: "The preview did not finish. It was not started again.",
    });
    await prisma.generationJob.update({
      where: { tenantId_requestId: { tenantId: tenant.id, requestId: "req-failed-2" } },
      data: { status: "PENDING", message: "hidden" },
    });
    const pending = await jobGet(new Request(`http://localhost/api/v1/tryon/jobs?slug=${slug}&requestId=req-failed-2`));
    expect(await pending.json()).toMatchObject({ status: "PENDING", message: "" });
    await prisma.generationJob.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });
});
