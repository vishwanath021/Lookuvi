import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as generate } from "@/app/api/v1/tryon/generate/route";
import { POST as suggest } from "@/app/api/v1/tryon/suggest/route";
import { auth } from "@/auth";
import { deskUserId } from "@/lib/at-salon-gate";
import { t } from "@/data/i18n";
import {
  ASK_WAIT_MS,
  askMoreTries,
  blockPaidVisit,
  dismissAsk,
  grantTries,
  markArrived,
  NOT_AT_SALON_MESSAGE,
  refuseAtSalon,
  tryAddAmount,
  visitBudget,
} from "@/lib/at-salon";
import { AI_PREVIEW_KINDS } from "@/lib/preview-access";
import { prisma } from "@/lib/prisma";
import { kolkataDayKey } from "@/lib/queue/day";
import { reserveTryCaps } from "@/lib/try-allowance";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => null),
}));

async function salon(slug: string, extra: Record<string, unknown> = {}) {
  return prisma.tenant.create({
    data: {
      slug,
      name: slug,
      productTryOn: true,
      productQueue: true,
      tryOnsAtSalon: true,
      visitTryLimit: 1,
      monthlyTryAllowance: 30,
      dailyCap: 100,
      ...extra,
    },
  });
}

async function cleanup() {
  const tenants = await prisma.tenant.findMany({
    where: { OR: [{ slug: { startsWith: "salon-lock-" } }, { slug: "demo" }] },
    select: { id: true },
  });
  const ids = tenants.map((row) => row.id);
  if (!ids.length) return;
  await prisma.salonDayUnlock.deleteMany({ where: { tenantId: { in: ids } } });
  await prisma.queueSession.deleteMany({ where: { entry: { tenantId: { in: ids } } } });
  await prisma.queueEntry.deleteMany({ where: { tenantId: { in: ids } } });
  await prisma.visitGrant.deleteMany({ where: { tenantId: { in: ids } } });
  await prisma.tryOn.deleteMany({ where: { tenantId: { in: ids } } });
  await prisma.membership.deleteMany({ where: { tenantId: { in: ids } } });
  await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
}

describe("at-salon try-ons", () => {
  afterEach(cleanup);

  it("keeps the unlocked copy singular for one try", () => {
    expect(t("en", "atSalonLocked")).toBe("Your free try-on opens when you reach the salon. Browse and save styles now; staff will unlock it when you arrive.");
    expect(t("en", "atSalonUnlockedOne")).toBe("You're in! You have 1 free try-on");
    expect(t("en", "atSalonUnlockedMany", { count: 2 })).toBe("You're in! You have 2 free try-ons");
    expect(t("hi", "atSalonLocked")).not.toBe("atSalonLocked");
    expect(t("kn", "askMoreTries")).not.toBe("askMoreTries");
    expect(t("ta", "staffAddedOne")).not.toBe("staffAddedOne");
    expect(t("te", "atSalonUnlockedOne")).not.toBe("atSalonUnlockedOne");
    expect(t("mr", "staffAddedMany", { count: 2 })).toContain("2");
  });

  it("blocks a guest at home, then unlocks the linked session after Arrived", async () => {
    const tenant = await salon(`salon-lock-home-${Date.now()}`);
    const sessionId = "session-home-12345678";
    const deviceId = "device-home-12345678";
    expect(await refuseAtSalon({ tenant, sessionId, deviceId })).toMatchObject({
      error: "NOT_AT_SALON",
      message: NOT_AT_SALON_MESSAGE,
    });
    const entry = await prisma.queueEntry.create({
      data: {
        tenantId: tenant.id,
        dayKey: kolkataDayKey(),
        token: 1,
        name: "Asha",
        phone: "919800011122",
        status: "WAITING",
        source: "ONLINE",
        cancelToken: `cancel-${Date.now()}-home`,
        sessionId,
        deviceId,
      },
    });
    await prisma.queueSession.create({ data: { entryId: entry.id, sessionId } });
    expect(await refuseAtSalon({ tenant, sessionId, deviceId })).not.toBeNull();
    const arrived = await markArrived(tenant.id, entry.id);
    expect(arrived.ok).toBe(true);
    expect(await refuseAtSalon({ tenant, sessionId, deviceId })).toBeNull();
    expect(await refuseAtSalon({ tenant, sessionId: "someone-else-session", deviceId: "someone-else-device" })).not.toBeNull();
  });

  it("lets staff and a salon with the lock off through, and still enforces the visit and monthly caps", async () => {
    const locked = await salon(`salon-lock-cap-${Date.now()}`);
    const open = await salon(`salon-lock-open-${Date.now()}`, { tryOnsAtSalon: false });
    const demo = await salon("demo", { tryOnsAtSalon: false });
    const sessionId = "session-cap-12345678";
    expect(await refuseAtSalon({ tenant: open, sessionId })).toBeNull();
    expect(await refuseAtSalon({ tenant: demo, sessionId })).toBeNull();
    expect(await blockPaidVisit({
      tenant: locked,
      sessionId,
      bypass: true,
      countsAsTry: true,
      legacyVisit: false,
    })).toBeNull();

    const entry = await prisma.queueEntry.create({
      data: {
        tenantId: locked.id,
        dayKey: kolkataDayKey(),
        token: 4,
        name: "Asha",
        phone: "919800011133",
        status: "WAITING",
        source: "ONLINE",
        cancelToken: `cancel-${Date.now()}-cap`,
        sessionId,
      },
    });
    await markArrived(locked.id, entry.id);
    await prisma.tryOn.create({
      data: { tenantId: locked.id, sessionId, kind: "STYLE", status: "SUCCEEDED" },
    });
    const blocked = await blockPaidVisit({
      tenant: locked,
      sessionId,
      countsAsTry: true,
      legacyVisit: false,
    });
    expect(blocked).toMatchObject({ error: "VISIT_CAP", status: 429 });

    const monthly = await reserveTryCaps({
      tenantId: locked.id,
      monthlyAllowance: 0,
      dailyCap: 10,
      sessionId,
      kind: "STYLE",
    });
    expect(monthly.ok).toBe(false);
    if (!monthly.ok) expect(monthly.error).toBe("MONTHLY_CAP");
  });

  it("adds 1, 2, 3, or a custom 1 to 9, and rejects anything else", async () => {
    expect(tryAddAmount(1)).toBe(1);
    expect(tryAddAmount(9)).toBe(9);
    expect(tryAddAmount(2)).toBe(2);
    expect(tryAddAmount(3)).toBe(3);
    expect(tryAddAmount(10)).toBeNull();
    expect(tryAddAmount(0)).toBeNull();
    expect(tryAddAmount(1.5)).toBeNull();
    expect(tryAddAmount("4")).toBe(4);
    expect(tryAddAmount("10")).toBeNull();

    const tenant = await salon(`salon-lock-add-${Date.now()}`);
    const sessionId = "session-add-12345678";
    const entry = await prisma.queueEntry.create({
      data: {
        tenantId: tenant.id,
        dayKey: kolkataDayKey(),
        token: 5,
        name: "Asha",
        phone: "919800011144",
        status: "WAITING",
        source: "WALKIN",
        cancelToken: `cancel-${Date.now()}-add`,
        sessionId,
      },
    });
    expect((await grantTries(tenant.id, entry.id, 2)).ok).toBe(false);
    await markArrived(tenant.id, entry.id);
    expect((await grantTries(tenant.id, entry.id, 10)).message).toMatch(/1 to 9/);
    expect((await grantTries(tenant.id, entry.id, 2)).ok).toBe(true);
    expect((await grantTries(tenant.id, entry.id, 9)).ok).toBe(true);
    const budget = await visitBudget({
      tenantId: tenant.id,
      sessionId,
      limit: 1,
      kinds: AI_PREVIEW_KINDS,
    });
    expect(budget.allowance).toBe(12);
    expect(budget.remaining).toBe(12);
  });

  it("flags a token when the guest asks, rate-limits the ask, and clears it on dismiss", async () => {
    const tenant = await salon(`salon-lock-ask-${Date.now()}`);
    const sessionId = "session-ask-12345678";
    const deviceId = "device-ask-12345678";
    const now = new Date();
    const entry = await prisma.queueEntry.create({
      data: {
        tenantId: tenant.id,
        dayKey: kolkataDayKey(now),
        token: 6,
        name: "Asha",
        phone: "919800011155",
        status: "WAITING",
        source: "ONLINE",
        cancelToken: `cancel-${Date.now()}-ask`,
        sessionId,
        deviceId,
      },
    });
    expect((await askMoreTries(tenant.id, sessionId, deviceId, now)).ok).toBe(false);
    await markArrived(tenant.id, entry.id, now);
    expect((await askMoreTries(tenant.id, sessionId, deviceId, now)).ok).toBe(true);
    const again = await askMoreTries(tenant.id, sessionId, deviceId, new Date(now.getTime() + 30_000));
    expect(again).toMatchObject({ ok: false, error: "WAIT", status: 429 });
    expect(ASK_WAIT_MS).toBe(120_000);
    const later = await askMoreTries(tenant.id, sessionId, deviceId, new Date(now.getTime() + ASK_WAIT_MS + 1000));
    expect(later.ok).toBe(true);
    expect((await prisma.queueEntry.findUnique({ where: { id: entry.id } }))?.wantsTriesAt).toBeTruthy();
    expect((await dismissAsk(tenant.id, entry.id)).ok).toBe(true);
    expect((await prisma.queueEntry.findUnique({ where: { id: entry.id } }))?.wantsTriesAt).toBeNull();
  });

  it("treats a signed-in staff member as a bypass for the lock", async () => {
    const tenant = await salon(`salon-lock-staff-${Date.now()}`);
    const user = await prisma.user.create({
      data: { email: `staff-${Date.now()}@example.com`, name: "Staff", passwordHash: "x" },
    });
    await prisma.membership.create({ data: { userId: user.id, tenantId: tenant.id, role: "STAFF" } });
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id, isSuperAdmin: false } } as never);
    expect(await deskUserId(tenant.id)).toBe(user.id);
    vi.mocked(auth).mockResolvedValue(null as never);
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("refuses a paid preview on the generate route before any try is reserved", async () => {
    const tenant = await salon(`salon-lock-route-${Date.now()}`);
    const form = new FormData();
    form.set("slug", tenant.slug);
    form.set("styleId", "pixie");
    form.set("sessionId", "session-route-12345678");
    form.set("tool", "style");
    form.set("photo", new File([Uint8Array.from([1, 2, 3])], "selfie.jpg", { type: "image/jpeg" }));
    const res = await generate(new Request("http://localhost/api/v1/tryon/generate", { method: "POST", body: form }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("NOT_AT_SALON");
    expect(await prisma.tryOn.count({ where: { tenantId: tenant.id } })).toBe(0);
    const suggestForm = new FormData();
    suggestForm.set("slug", tenant.slug);
    suggestForm.set("sessionId", "session-route-12345678");
    suggestForm.set("gender", "women");
    suggestForm.set("photo", new File([Uint8Array.from([1, 2, 3])], "selfie.jpg", { type: "image/jpeg" }));
    await prisma.tenant.update({ where: { id: tenant.id }, data: { hairSuggestOn: true, toolStyle: true } });
    const suggested = await suggest(new Request("http://localhost/api/v1/tryon/suggest", { method: "POST", body: suggestForm }));
    expect(suggested.status).toBe(403);
    expect((await suggested.json()).error).toBe("NOT_AT_SALON");
  });
});
