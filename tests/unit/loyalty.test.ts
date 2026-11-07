import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { kolkataDayKey } from "@/lib/queue/day";
import { applyDelta, changePoints, earnVisitPoints, POINTS_REMINDER_TEMPLATE, pointsBalanceLine, rewardProgress } from "@/lib/loyalty";
import { finishEntry, joinQueue, redeemOnEntry } from "@/lib/queue/service";
import { sendComeBack } from "@/lib/reminders";
import { resetRateLimits } from "@/lib/ratelimit";

const send = vi.fn(async () => ({ ok: true as const, provider: "whatsapp" }));
const tenants: string[] = [];

function tag() {
  return Math.random().toString(36).slice(2, 10);
}

function phone() {
  return `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
}

async function salon() {
  const tenant = await prisma.tenant.create({
    data: { slug: `loyal-${tag()}`, name: "Demo Salon", productQueue: true, loyaltyOn: true, loyaltyPointsPerVisit: 1 },
  });
  tenants.push(tenant.id);
  await prisma.queueState.create({
    data: { tenantId: tenant.id, isOpen: true, units: 1, avgMinutes: 20, alertLeadMin: -1, mode: "LIVE", unitLabel: "chair" },
  });
  return tenant;
}

afterEach(async () => {
  resetRateLimits();
  send.mockClear();
  if (tenants.length) {
    await prisma.loyaltyLedger.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.loyaltyReward.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.queueEntry.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.queueState.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.customer.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.whatsAppSend.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenants.splice(0) } } });
  }
});

describe("loyalty points", () => {
  it("rejects a balance below zero and names the next reward", () => {
    expect(applyDelta(7, -8)).toMatchObject({ ok: false });
    expect(applyDelta(7, -7)).toEqual({ ok: true, next: 0 });
    expect(applyDelta(7, 0).ok).toBe(false);
    expect(pointsBalanceLine(7, "Demo Salon")).toBe("You have 7 points at Demo Salon.");
    expect(rewardProgress(7, [{ name: "₹50 off", cost: 10 }, { name: "Free beard trim", cost: 15 }])).toBe("3 more for ₹50 off.");
    expect(rewardProgress(15, [{ name: "Free beard trim", cost: 15 }])).toBe("You can redeem Free beard trim.");
  });

  it("earns one point when a visit is finished, and not twice for the same visit", async () => {
    const tenant = await salon();
    const mobile = phone();
    const joined = await joinQueue({
      slug: tenant.slug, name: "Nila", phone: mobile, consent: true, ip: `p-${tag()}`, send,
    });
    const entry = await prisma.queueEntry.findFirstOrThrow({ where: { tenantId: tenant.id, phone: `91${mobile}` } });
    await prisma.queueEntry.update({ where: { id: entry.id }, data: { status: "IN_SERVICE" } });
    const desk = await finishEntry(tenant.id, entry.id, "DONE", send, "staff-1");
    expect(desk.waiting).toHaveLength(0);
    const earned = await prisma.loyaltyLedger.findMany({ where: { tenantId: tenant.id } });
    expect(earned).toHaveLength(1);
    expect(earned[0]).toMatchObject({ kind: "earn", delta: 1, reason: "Visit finished", staffId: "staff-1", visitId: entry.id, balanceAfter: 1 });
    await earnVisitPoints({ tenantId: tenant.id, phone: entry.phone, visitId: entry.id, staffId: "staff-1", points: 1 });
    expect(await prisma.loyaltyLedger.count({ where: { tenantId: tenant.id, kind: "earn" } })).toBe(1);
    expect(joined.status).toBe("WAITING");
  });

  it("does not earn when loyalty is off, the visit has no phone, or it is a no-show", async () => {
    const tenant = await salon();
    await prisma.tenant.update({ where: { id: tenant.id }, data: { loyaltyOn: false } });
    const mobile = phone();
    await joinQueue({ slug: tenant.slug, name: "Nila", phone: mobile, consent: true, ip: `p-${tag()}`, send });
    const entry = await prisma.queueEntry.findFirstOrThrow({ where: { tenantId: tenant.id } });
    await finishEntry(tenant.id, entry.id, "DONE", send, "staff-1");
    expect(await prisma.loyaltyLedger.count({ where: { tenantId: tenant.id } })).toBe(0);

    await prisma.tenant.update({ where: { id: tenant.id }, data: { loyaltyOn: true } });
    const blank = await prisma.queueEntry.create({
      data: { tenantId: tenant.id, dayKey: "2099-01-01", token: 9, name: "Walk-in", phone: "", status: "IN_SERVICE", source: "WALKIN", cancelToken: `blank-${tag()}` },
    });
    await finishEntry(tenant.id, blank.id, "DONE", send, "staff-1");
    const missed = await prisma.queueEntry.create({
      data: { tenantId: tenant.id, dayKey: "2099-01-01", token: 8, name: "Late", phone: "919111111111", status: "CALLED", source: "WALKIN", cancelToken: `miss-${tag()}` },
    });
    await finishEntry(tenant.id, missed.id, "NO_SHOW", send, "staff-1");
    expect(await prisma.loyaltyLedger.count({ where: { tenantId: tenant.id } })).toBe(0);
  });

  it("redeems a reward and refuses to go below zero", async () => {
    const tenant = await salon();
    const mobile = `91${phone()}`;
    const reward = await prisma.loyaltyReward.create({ data: { tenantId: tenant.id, name: "Free beard trim", cost: 15, sort: 0 } });
    await changePoints({ tenantId: tenant.id, phone: mobile, delta: 7, kind: "adjust", reason: "Opening balance", staffId: "staff-1" });
    const entry = await prisma.queueEntry.create({
      data: { tenantId: tenant.id, dayKey: kolkataDayKey(), token: 3, name: "Nila", phone: mobile, status: "WAITING", source: "ONLINE", cancelToken: `red-${tag()}` },
    });
    await expect(redeemOnEntry(tenant.id, entry.id, reward.id, "staff-2")).rejects.toThrow(/below 0/);
    expect(await prisma.loyaltyLedger.count({ where: { tenantId: tenant.id, kind: "redeem" } })).toBe(0);
    await changePoints({ tenantId: tenant.id, phone: mobile, delta: 8, kind: "adjust", reason: "Goodwill", staffId: "staff-1" });
    const desk = await redeemOnEntry(tenant.id, entry.id, reward.id, "staff-2");
    expect(desk.waiting[0]?.points).toBe(0);
    const row = await prisma.loyaltyLedger.findFirstOrThrow({ where: { tenantId: tenant.id, kind: "redeem" } });
    expect(row).toMatchObject({ delta: -15, reason: "Free beard trim", staffId: "staff-2", visitId: entry.id, rewardId: reward.id, balanceAfter: 0 });
  });

  it("does not send a come-back reminder when points are waiting on a new template", async () => {
    const tenant = await salon();
    const person = await prisma.customer.create({
      data: { tenantId: tenant.id, phone: "919100000077", name: "Nila", visitCount: 1, lastVisitAt: new Date("2026-07-01") },
    });
    await changePoints({ tenantId: tenant.id, phone: person.phone, delta: 7, kind: "earn", reason: "Visit finished", staffId: "staff-1" });
    const result = await sendComeBack(tenant.id, [person.id], send, {
      WHATSAPP_TOKEN: "token",
      WHATSAPP_PHONE_ID: "phone",
      WHATSAPP_TEMPLATE_REMINDER: "remind",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("You have {{2}} points at {{1}}");
    expect(result.message).toContain(POINTS_REMINDER_TEMPLATE);
    expect(send).not.toHaveBeenCalled();
    expect(await prisma.whatsAppSend.count({ where: { tenantId: tenant.id } })).toBe(0);
  });
});
