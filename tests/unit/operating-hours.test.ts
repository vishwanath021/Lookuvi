import { afterEach, describe, expect, it, vi } from "vitest";
import { PUT as saveSettings } from "@/app/api/v1/admin/settings/route";
import { POST as updateTenant } from "@/app/api/v1/super/tenants/[id]/route";
import { prisma } from "@/lib/prisma";
import { HOURS_INVALID, parseOperatingHours, requestWindow } from "@/lib/queue/hours";
import { joinQueue, saveQueueSettings, setQueueOpen } from "@/lib/queue/service";
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

function phone() {
  return `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
}

async function salon() {
  const tenant = await prisma.tenant.create({
    data: { slug: `hours-${tag()}`, name: "Hours salon", productQueue: true },
  });
  tenants.push(tenant.id);
  await prisma.queueState.create({
    data: { tenantId: tenant.id, isOpen: true, units: 1, avgMinutes: 20, alertLeadMin: -1, mode: "REQUEST", unitLabel: "chair" },
  });
  return tenant;
}

async function ownerOf(tenantId: string) {
  const user = await prisma.user.create({
    data: { email: `hours-${tag()}@example.test`, name: "Hours Owner", passwordHash: "hash" },
  });
  users.push(user.id);
  await prisma.membership.create({ data: { userId: user.id, tenantId, role: "OWNER" } });
  vi.mocked(auth).mockResolvedValue({
    user: { id: user.id, email: user.email, name: user.name, isSuperAdmin: false, tenantId, role: "OWNER" },
    expires: "2099-01-01T00:00:00.000Z",
  });
  return user;
}

afterEach(async () => {
  resetRateLimits();
  send.mockClear();
  if (tenants.length) {
    await prisma.queueEntry.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.queueState.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.membership.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.auditLog.deleteMany({ where: { target: { in: tenants } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenants.splice(0) } } });
  }
  if (users.length) await prisma.user.deleteMany({ where: { id: { in: users.splice(0) } } });
});

describe("operating hours", () => {
  it("rejects open at or after close, and treats an empty pair as unset", () => {
    expect(parseOperatingHours("", "")).toEqual({ kind: "fallback" });
    expect(parseOperatingHours(null, undefined)).toEqual({ kind: "fallback" });
    expect(parseOperatingHours("18:00", "10:00").kind).toBe("invalid");
    expect(parseOperatingHours("10:00", "10:00")).toMatchObject({ kind: "invalid", message: HOURS_INVALID });
    expect(parseOperatingHours("10:00", "").kind).toBe("invalid");
    expect(parseOperatingHours("25:00", "26:00").kind).toBe("invalid");
    expect(parseOperatingHours("10:00", "19:00")).toEqual({ kind: "custom", open: "10:00", close: "19:00" });
    expect(parseOperatingHours("10:00:00", "19:00:00")).toEqual({ kind: "custom", open: "10:00", close: "19:00" });
    expect(requestWindow("", "")).toEqual({ open: "06:00", close: "22:00" });
    expect(requestWindow("18:00", "10:00")).toEqual({ open: "06:00", close: "22:00" });
    expect(requestWindow("11:00", "20:00")).toEqual({ open: "11:00", close: "20:00" });
  });

  it("uses salon hours for REQUEST joins and the global window when hours are unset", async () => {
    const custom = await salon();
    await prisma.tenant.update({ where: { id: custom.id }, data: { openTime: "10:00", closeTime: "18:00" } });
    await expect(joinQueue({
      slug: custom.slug, name: "Early", phone: phone(), consent: true,
      requestedDate: "2099-03-01", requestedSlot: "09:59", ip: `h-${tag()}`, send,
    })).rejects.toThrow(/between 10:00 and 18:00/);
    const open = await joinQueue({
      slug: custom.slug, name: "Open", phone: phone(), consent: true,
      requestedDate: "2099-03-01", requestedSlot: "10:00", ip: `h-${tag()}`, send,
    });
    expect(open.requestedSlot).toBe("10:00");
    const close = await joinQueue({
      slug: custom.slug, name: "Close", phone: phone(), consent: true,
      requestedDate: "2099-03-01", requestedSlot: "18:00", ip: `h-${tag()}`, send,
    });
    expect(close.requestedSlot).toBe("18:00");
    await expect(joinQueue({
      slug: custom.slug, name: "Late", phone: phone(), consent: true,
      requestedDate: "2099-03-01", requestedSlot: "18:01", ip: `h-${tag()}`, send,
    })).rejects.toThrow(/between 10:00 and 18:00/);

    const fallback = await salon();
    await expect(joinQueue({
      slug: fallback.slug, name: "Night", phone: phone(), consent: true,
      requestedDate: "2099-03-02", requestedSlot: "05:59", ip: `h-${tag()}`, send,
    })).rejects.toThrow(/between 06:00 and 22:00/);
    const early = await joinQueue({
      slug: fallback.slug, name: "Dawn", phone: phone(), consent: true,
      requestedDate: "2099-03-02", requestedSlot: "06:00", ip: `h-${tag()}`, send,
    });
    expect(early.status).toBe("REQUESTED");
    const late = await joinQueue({
      slug: fallback.slug, name: "Evening", phone: phone(), consent: true,
      requestedDate: "2099-03-02", requestedSlot: "22:00", ip: `h-${tag()}`, send,
    });
    expect(late.requestedSlot).toBe("22:00");
  });

  it("keeps live open and pause independent of request hours", async () => {
    const tenant = await salon();
    await prisma.tenant.update({ where: { id: tenant.id }, data: { openTime: "10:00", closeTime: "11:00" } });
    await saveQueueSettings(tenant.id, { units: 1, avgMinutes: 20, alertLeadMin: 5, mode: "LIVE", unitLabel: "chair" });
    const joined = await joinQueue({
      slug: tenant.slug, name: "Walk up", phone: phone(), consent: true, ip: `live-${tag()}`, send,
    });
    expect(joined.status).toBe("WAITING");
    await setQueueOpen(tenant.id, false);
    await expect(joinQueue({
      slug: tenant.slug, name: "Paused", phone: phone(), consent: true, ip: `live-${tag()}`, send,
    })).rejects.toMatchObject({ code: "CLOSED" });
  });

  it("lets the owner and a super-admin save or clear hours, and rejects open >= close", async () => {
    const tenant = await salon();
    await ownerOf(tenant.id);
    const bad = await saveSettings(new Request("http://127.0.0.1/api/v1/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ openTime: "19:00", closeTime: "09:00" }),
    }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).message).toBe(HOURS_INVALID);
    expect((await prisma.tenant.findUnique({ where: { id: tenant.id } }))?.openTime).toBe("");

    const saved = await saveSettings(new Request("http://127.0.0.1/api/v1/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ openTime: "10:00", closeTime: "18:00" }),
    }));
    expect(saved.status).toBe(200);
    expect(await prisma.tenant.findUnique({ where: { id: tenant.id }, select: { openTime: true, closeTime: true } })).toEqual({
      openTime: "10:00",
      closeTime: "18:00",
    });

    vi.mocked(auth).mockResolvedValue({
      user: { id: "super-hours", email: "super-hours@example.test", name: "Super", isSuperAdmin: true },
      expires: "2099-01-01T00:00:00.000Z",
    });
    const cleared = await updateTenant(new Request("http://127.0.0.1/api/v1/super/tenants/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ openTime: "", closeTime: "" }),
    }), { params: Promise.resolve({ id: tenant.id }) });
    expect(cleared.status).toBe(200);
    expect(await prisma.tenant.findUnique({ where: { id: tenant.id }, select: { openTime: true, closeTime: true } })).toEqual({
      openTime: "",
      closeTime: "",
    });
    const audit = await prisma.auditLog.findFirst({ where: { target: tenant.id, action: "TENANT_UPDATE" }, orderBy: { createdAt: "desc" } });
    expect(audit?.meta).toContain("openTime");
  });
});
