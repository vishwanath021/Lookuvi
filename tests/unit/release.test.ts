import { describe, expect, it } from "vitest";
import { CONSENT_TEXT } from "@/data/consent";
import { clientIp, rateLimit, resetRateLimits, sharedRateLimit } from "@/lib/ratelimit";
import { deleteObject, getObject, putObject } from "@/lib/storage";

describe("release controls", () => {
  it("trusts a public client behind the proxy and ignores a private hop", () => {
    expect(clientIp("spoofed, 203.0.113.8", true)).toBe("203.0.113.8");
    expect(clientIp("203.0.113.8", true)).toBe("203.0.113.8");
    expect(clientIp("203.0.113.9, 172.18.0.4", true)).toBe("203.0.113.9");
    expect(clientIp("172.18.0.4", true)).toBe("proxy");
    expect(clientIp("spoofed, 203.0.113.8", false)).toBe("unknown");
  });

  it("keeps the in-memory limiter for single-process tests", async () => {
    resetRateLimits();
    expect(rateLimit("release", 1, 1000, 0).ok).toBe(true);
    expect(rateLimit("release", 1, 1000, 10).ok).toBe(false);
    const shared = await sharedRateLimit("release-shared", 1, 1000, 0);
    expect(shared.ok).toBe(true);
  });

  it("states that previews are stored and then deleted", () => {
    expect(CONSENT_TEXT).toMatch(/deletes it/);
    expect(CONSENT_TEXT).not.toMatch(/not written to disk/);
    expect(CONSENT_TEXT).toMatch(/data fiduciary/);
  });

  it("round-trips a private object on local disk", async () => {
    const key = `generations/test-tenant/req-1/result.jpg`;
    await putObject(key, Buffer.from("jpeg-bytes"), "image/jpeg");
    const body = await getObject(key);
    expect(body?.toString()).toBe("jpeg-bytes");
    await deleteObject(key);
    expect(await getObject(key)).toBeNull();
  });
});
