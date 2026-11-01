import { createHash, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { POST as requestMagic } from "@/app/api/v1/auth/magic/route";
import { MAGIC_LINK_REJECTED, homeForUser, interpretMagicResult } from "@/lib/auth/magic-destination";
import { redeemMagicLink } from "@/lib/auth/magic-link";
import { prisma } from "@/lib/prisma";

const createdUsers: string[] = [];
const createdLinks: string[] = [];
const createdResets: string[] = [];

function tag() {
  return Math.random().toString(36).slice(2, 10);
}

async function user(extra?: { isSuperAdmin?: boolean; totpEnabled?: boolean }) {
  const email = `magic-${tag()}@example.test`;
  const row = await prisma.user.create({
    data: {
      email,
      name: "Magic Tester",
      passwordHash: "not-a-password",
      isSuperAdmin: extra?.isSuperAdmin ?? false,
      totpEnabled: extra?.totpEnabled ?? false,
    },
  });
  createdUsers.push(row.id);
  return row;
}

async function linkFor(email: string, opts?: { used?: boolean; expiresAt?: Date; token?: string }) {
  const token = opts?.token ?? randomBytes(32).toString("hex");
  const row = await prisma.magicLink.create({
    data: {
      email,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: opts?.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000),
      used: opts?.used ?? false,
    },
  });
  createdLinks.push(row.id);
  return { token, row };
}

afterEach(async () => {
  if (createdLinks.length) await prisma.magicLink.deleteMany({ where: { id: { in: createdLinks.splice(0) } } });
  if (createdResets.length) await prisma.passwordReset.deleteMany({ where: { id: { in: createdResets.splice(0) } } });
  if (createdUsers.length) {
    await prisma.membership.deleteMany({ where: { userId: { in: createdUsers } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUsers.splice(0) } } });
  }
});

describe("redeemMagicLink", () => {
  it("signs in a fresh token once and keeps the super-admin flag", async () => {
    const account = await user({ isSuperAdmin: true });
    const { token, row } = await linkFor(account.email);
    const first = await redeemMagicLink(token, "");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.user.id).toBe(account.id);
    expect(first.user.email).toBe(account.email);
    expect(first.user.isSuperAdmin).toBe(true);
    expect(first.user.sessionVersion).toBe(0);
    const stored = await prisma.magicLink.findUnique({ where: { id: row.id } });
    expect(stored?.used).toBe(true);
    const second = await redeemMagicLink(token, "");
    expect(second).toEqual({ ok: false, reason: "used" });
  });

  it("rejects an unknown, short, expired, or already used token without marking an expired row used", async () => {
    const account = await user();
    expect(await redeemMagicLink("short-token", "")).toEqual({ ok: false, reason: "invalid" });
    expect(await redeemMagicLink("a".repeat(40), "")).toEqual({ ok: false, reason: "invalid" });

    const expired = await linkFor(account.email, { expiresAt: new Date(Date.now() - 60_000) });
    expect(await redeemMagicLink(expired.token, "")).toEqual({ ok: false, reason: "expired" });
    expect((await prisma.magicLink.findUnique({ where: { id: expired.row.id } }))?.used).toBe(false);

    const used = await linkFor(account.email, { used: true });
    expect(await redeemMagicLink(used.token, "")).toEqual({ ok: false, reason: "used" });
  });

  it("does not consume the link when an authenticator code is required or wrong", async () => {
    const account = await user({ totpEnabled: true });
    const pending = await linkFor(account.email);
    expect(await redeemMagicLink(pending.token, "")).toEqual({ ok: false, reason: "totp_required" });
    expect(await redeemMagicLink(pending.token, "000000")).toEqual({ ok: false, reason: "totp_invalid" });
    expect((await prisma.magicLink.findUnique({ where: { id: pending.row.id } }))?.used).toBe(false);
  });

  it("does not treat a password-reset token as a magic link", async () => {
    const account = await user();
    const token = randomBytes(32).toString("hex");
    const reset = await prisma.passwordReset.create({
      data: {
        email: account.email,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    createdResets.push(reset.id);
    expect(await redeemMagicLink(token, "")).toEqual({ ok: false, reason: "invalid" });
    expect((await prisma.passwordReset.findUnique({ where: { id: reset.id } }))?.used).toBe(false);
  });

  it("attaches the salon membership when the account has one", async () => {
    const account = await user();
    const tenant = await prisma.tenant.create({ data: { slug: `magic-${tag()}`, name: "Magic Salon" } });
    await prisma.membership.create({ data: { userId: account.id, tenantId: tenant.id, role: "OWNER" } });
    const { token } = await linkFor(account.email);
    const result = await redeemMagicLink(token, "");
    expect(result.ok && result.user.tenantId).toBe(tenant.id);
    expect(result.ok && result.user.role).toBe("OWNER");
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });
});

describe("magic link request route", () => {
  const previous: Record<string, string | undefined> = {};
  const keys = ["ALLOW_DEV_MAGIC_LINK", "NODE_ENV", "RESEND_API_KEY", "SMTP_URL", "APP_BASE_URL"] as const;

  afterEach(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
      delete previous[key];
    }
  });

  function setEnv(values: Partial<Record<(typeof keys)[number], string | undefined>>) {
    for (const key of keys) {
      if (!(key in previous)) previous[key] = process.env[key];
    }
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  it("returns a dev link only when the flag allows it, and that link redeems", async () => {
    setEnv({
      ALLOW_DEV_MAGIC_LINK: "true",
      NODE_ENV: "test",
      RESEND_API_KEY: undefined,
      SMTP_URL: undefined,
      APP_BASE_URL: "http://127.0.0.1:3000",
    });
    const account = await user();
    const res = await requestMagic(new Request("http://127.0.0.1:3000/api/v1/auth/magic", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: account.email }),
    }));
    const body = await res.json() as { devUrl?: string; message?: string };
    expect(res.status).toBe(200);
    expect(body.devUrl).toMatch(/\/login\?token=/);
    const token = new URL(body.devUrl || "").searchParams.get("token") || "";
    const row = await prisma.magicLink.findFirst({ where: { email: account.email } });
    expect(row).toBeTruthy();
    if (row) createdLinks.push(row.id);
    const redeemed = await redeemMagicLink(token, "");
    expect(redeemed.ok).toBe(true);
  });

  it("does not return a dev link when the flag is off", async () => {
    setEnv({ ALLOW_DEV_MAGIC_LINK: undefined, NODE_ENV: "test", RESEND_API_KEY: undefined, SMTP_URL: undefined });
    const account = await user();
    const res = await requestMagic(new Request("http://127.0.0.1:3000/api/v1/auth/magic", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: account.email }),
    }));
    expect(res.status).toBe(503);
    const body = await res.json() as { devUrl?: string };
    expect(body.devUrl).toBeUndefined();
    const row = await prisma.magicLink.findFirst({ where: { email: account.email } });
    if (row) createdLinks.push(row.id);
  });
});

describe("login token handling", () => {
  it("sends super-admins to /super and everyone else to /admin", () => {
    expect(homeForUser({ isSuperAdmin: true })).toBe("/super");
    expect(homeForUser({ isSuperAdmin: false })).toBe("/admin");
    expect(homeForUser(null)).toBe("/admin");
  });

  it("treats a failed magic sign-in as signed out, and keeps authenticator prompts distinct", () => {
    expect(interpretMagicResult(null)).toEqual({ kind: "rejected" });
    expect(interpretMagicResult({ error: "CredentialsSignin", ok: false, code: "credentials" })).toEqual({ kind: "rejected" });
    expect(interpretMagicResult({ ok: false, error: "CredentialsSignin", code: "totp_required" })).toEqual({ kind: "totp", invalid: false });
    expect(interpretMagicResult({ ok: false, error: "CredentialsSignin", code: "totp_invalid" })).toEqual({ kind: "totp", invalid: true });
    expect(interpretMagicResult({ ok: true, error: null })).toEqual({ kind: "signed-in" });
    expect(MAGIC_LINK_REJECTED).toMatch(/invalid, already used, or has expired/i);
    expect(MAGIC_LINK_REJECTED.toLowerCase()).not.toContain("magic link");
  });
});
