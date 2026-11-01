import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as saveConsent } from "@/app/api/v1/consent/route";
import { POST as updateTenant } from "@/app/api/v1/super/tenants/[id]/route";
import { prisma } from "@/lib/prisma";
import { joinQueue } from "@/lib/queue/service";
import { loadTenantBySlug } from "@/lib/salon";
import { requireMembership } from "@/lib/session";
import { loadSalons } from "@/lib/super/directory";
import { resetRateLimits } from "@/lib/ratelimit";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { auth } from "@/auth";

const send = vi.fn(async () => ({ ok: true as const, provider: "log" }));
const tenants: string[] = [];
const users: string[] = [];

function tag() {
  return Math.random().toString(36).slice(2, 10);
}

async function salon() {
  const row = await prisma.tenant.create({
    data: { slug: `gone-${tag()}`, name: "Gone salon", productQueue: true, status: "TRIAL" },
  });
  tenants.push(row.id);
  await prisma.queueState.create({
    data: { tenantId: row.id, isOpen: true, mode: "LIVE", units: 1, avgMinutes: 20, alertLeadMin: -1, unitLabel: "chair" },
  });
  await prisma.service.create({ data: { tenantId: row.id, key: "cut", name: "Cut", priceInr: 200 } });
  return row;
}

function asSuper() {
  vi.mocked(auth).mockResolvedValue({
    user: { id: "super-delete", email: "super-delete@example.test", name: "Super", isSuperAdmin: true },
    expires: "2099-01-01T00:00:00.000Z",
  });
}

afterEach(async () => {
  resetRateLimits();
  if (tenants.length) {
    await prisma.queueEntry.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.queueState.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.service.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.membership.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.auditLog.deleteMany({ where: { target: { in: tenants } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenants.splice(0) } } });
  }
  if (users.length) await prisma.user.deleteMany({ where: { id: { in: users.splice(0) } } });
});

describe("salon soft delete", () => {
  it("hides the salon, keeps its rows, writes an audit entry, and leaves suspend alone", async () => {
    const tenant = await salon();
    asSuper();
    const suspended = await updateTenant(new Request("http://127.0.0.1/api/v1/super/tenants/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "SUSPENDED" }),
    }), { params: Promise.resolve({ id: tenant.id }) });
    expect(suspended.status).toBe(200);
    const paused = await prisma.tenant.findMany({ where: { id: tenant.id } });
    expect(paused[0]?.status).toBe("SUSPENDED");
    expect(paused[0]?.deletedAt).toBeNull();
    expect(await prisma.tenant.findUnique({ where: { id: tenant.id } })).toBeTruthy();
    expect((await loadSalons()).some((row) => row.id === tenant.id)).toBe(true);

    await prisma.tenant.update({ where: { id: tenant.id }, data: { status: "TRIAL" } });
    const removed = await updateTenant(new Request("http://127.0.0.1/api/v1/super/tenants/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ remove: true }),
    }), { params: Promise.resolve({ id: tenant.id }) });
    expect(removed.status).toBe(200);
    const kept = await prisma.tenant.findMany({ where: { id: tenant.id } });
    expect(kept).toHaveLength(1);
    expect(kept[0]?.deletedAt).toBeTruthy();
    expect(kept[0]?.status).toBe("TRIAL");
    expect(await prisma.service.count({ where: { tenantId: tenant.id } })).toBe(1);
    expect(await prisma.tenant.findUnique({ where: { id: tenant.id } })).toBeNull();
    expect(await prisma.tenant.findUnique({ where: { id: tenant.id }, select: { id: true } })).toBeNull();
    expect(await loadTenantBySlug(tenant.slug)).toBeNull();
    expect((await loadSalons()).some((row) => row.id === tenant.id)).toBe(false);

    const audit = await prisma.auditLog.findFirst({ where: { target: tenant.id, action: "SALON_DELETE" } });
    expect(audit?.meta).toContain(tenant.slug);
    const again = await updateTenant(new Request("http://127.0.0.1/api/v1/super/tenants/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ remove: true }),
    }), { params: Promise.resolve({ id: tenant.id }) });
    expect(again.status).toBe(404);
  });

  it("returns the same not-found class as a missing salon for queue and consent, and blocks the owner", async () => {
    const tenant = await salon();
    const user = await prisma.user.create({
      data: { email: `gone-${tag()}@example.test`, name: "Owner", passwordHash: "hash" },
    });
    users.push(user.id);
    await prisma.membership.create({ data: { userId: user.id, tenantId: tenant.id, role: "OWNER" } });
    asSuper();
    expect((await updateTenant(new Request("http://127.0.0.1/api/v1/super/tenants/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ remove: true }),
    }), { params: Promise.resolve({ id: tenant.id }) })).status).toBe(200);

    await expect(joinQueue({
      slug: tenant.slug, name: "Guest", phone: "9876501999", consent: true, ip: `del-${tag()}`, send,
    })).rejects.toMatchObject({ code: "PRODUCT", status: 404 });
    await expect(joinQueue({
      slug: "missing-salon-slug", name: "Guest", phone: "9876501998", consent: true, ip: `miss-${tag()}`, send,
    })).rejects.toMatchObject({ code: "PRODUCT", status: 404 });

    const body = { sessionId: "session-1", lang: "en", accepted: true, ageGate: true };
    const deleted = await saveConsent(new Request("http://127.0.0.1/api/v1/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, slug: tenant.slug }),
    }));
    const missing = await saveConsent(new Request("http://127.0.0.1/api/v1/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, slug: "missing-salon-slug" }),
    }));
    expect(deleted.status).toBe(missing.status);
    expect(await deleted.json()).toEqual(await missing.json());

    vi.mocked(auth).mockResolvedValue({
      user: { id: user.id, email: user.email, name: user.name, isSuperAdmin: false, tenantId: tenant.id, role: "OWNER" },
      expires: "2099-01-01T00:00:00.000Z",
    });
    const access = await requireMembership();
    expect("error" in access && access.error).toBeTruthy();
    if ("error" in access && access.error) expect(access.error.status).toBe(403);
  });
});
