import { describe, expect, it } from "vitest";
import { CSRF_MESSAGE, csrfBlocked } from "@/lib/http/csrf";
import { DESK_FORBIDDEN_MESSAGE, DESK_STALE_MESSAGE, deskFailure } from "@/lib/queue/desk-client";

function req(method: string, headers: Record<string, string>, pathname = "/api/v1/admin/queue") {
  return {
    method,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    nextUrl: { pathname },
  };
}

describe("owner desk responses", () => {
  it("sends a signed-out owner to login", () => {
    expect(deskFailure(401, { error: "UNAUTHENTICATED" })).toEqual({ type: "login" });
    expect(deskFailure(200, { error: "UNAUTHENTICATED" })).toEqual({ type: "login" });
  });

  it("keeps the list and asks for a retry on CSRF or any other 403", () => {
    expect(deskFailure(403, { error: "CSRF" })).toEqual({ type: "retry", message: CSRF_MESSAGE });
    expect(deskFailure(403, { error: "CSRF", message: "Refresh and try again." })).toEqual({ type: "retry", message: "Refresh and try again." });
    expect(deskFailure(403, { error: "OWNER_ONLY", message: "Only the owner can do that." })).toEqual({
      type: "retry",
      message: "Only the owner can do that.",
    });
    expect(deskFailure(403, {})).toEqual({ type: "retry", message: DESK_FORBIDDEN_MESSAGE });
  });

  it("marks any other failed refresh stale and does not treat a snapshot as failed", () => {
    expect(deskFailure(500, {})).toEqual({ type: "stale", message: DESK_STALE_MESSAGE });
    expect(deskFailure(400, { message: "Enter a 10-digit Indian mobile number, or leave the phone empty." })?.type).toBe("stale");
    expect(deskFailure(200, {})).toEqual({ type: "stale", message: DESK_STALE_MESSAGE });
    expect(deskFailure(200, { state: { isOpen: true } })).toBeNull();
  });
});

describe("admin CSRF behind the proxy", () => {
  const production = process.env.NODE_ENV;

  function withProduction(run: () => void) {
    process.env.NODE_ENV = "production";
    try {
      run();
    } finally {
      process.env.NODE_ENV = production;
    }
  }

  it("lets a same-origin desk write through even when the proxy host header is the upstream", () => {
    const blocked = csrfBlocked(req("POST", {
      origin: "https://lookuvi.agenticbuildworks.com",
      host: "app:3000",
      "x-forwarded-host": "app:3000",
      "sec-fetch-site": "same-origin",
    }));
    expect(blocked).toBe(false);
  });

  it("accepts the public host on either header and ignores a default port", () => {
    expect(csrfBlocked(req("POST", {
      origin: "https://lookuvi.agenticbuildworks.com",
      host: "app:3000",
      "x-forwarded-host": "lookuvi.agenticbuildworks.com:443",
    }))).toBe(false);
    expect(csrfBlocked(req("POST", {
      origin: "https://lookuvi.agenticbuildworks.com",
      host: "Lookuvi.agenticbuildworks.com",
    }))).toBe(false);
  });

  it("still blocks a cross-site post and a production post with no origin", () => {
    expect(csrfBlocked(req("POST", {
      origin: "https://evil.example",
      host: "lookuvi.agenticbuildworks.com",
      "sec-fetch-site": "cross-site",
    }))).toBe(true);
    withProduction(() => {
      expect(csrfBlocked(req("POST", { host: "lookuvi.agenticbuildworks.com" }))).toBe(true);
    });
    expect(csrfBlocked(req("GET", { host: "app:3000" }))).toBe(false);
    expect(csrfBlocked(req("POST", { origin: "https://evil.example", host: "lookuvi.agenticbuildworks.com" }, "/api/v1/queue"))).toBe(false);
  });
});
