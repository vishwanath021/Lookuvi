import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { dailyCapAfterPlanChange } from "@/lib/billing/plan-assign";
import { applyPlanChange } from "@/lib/billing/plan-assign";
import { prisma } from "@/lib/prisma";
import { kolkataDayStart } from "@/lib/queue/day";

describe("Asia/Kolkata day boundary", () => {
  it("starts the day at 00:00 IST, which is 18:30 the previous UTC day", () => {
    expect(kolkataDayStart(new Date("2026-10-23T18:29:00.000Z")).toISOString()).toBe("2026-10-22T18:30:00.000Z");
    expect(kolkataDayStart(new Date("2026-10-23T18:30:00.000Z")).toISOString()).toBe("2026-10-23T18:30:00.000Z");
    expect(kolkataDayStart(new Date("2026-10-24T12:00:00.000Z")).toISOString()).toBe("2026-10-23T18:30:00.000Z");
  });
});

describe("plan change", () => {
  it("moves the daily cap with the plan only while it still matches the old plan, and grants no credits", () => {
    expect(dailyCapAfterPlanChange(300, "LITE", "PRO")).toBe(1800);
    expect(dailyCapAfterPlanChange(1800, "PRO", "LITE")).toBe(300);
    expect(dailyCapAfterPlanChange(40, "LITE", "PRO")).toBe(40);
    expect(dailyCapAfterPlanChange(900, "STARTER", "STARTER")).toBe(900);
  });

  it("does not add credits when a super-admin changes the plan", async () => {
    const tenant = await prisma.tenant.create({
      data: { slug: `plan-${Date.now()}`, name: "Plan change", plan: "LITE", creditBalance: 300, dailyCap: 300 },
    });
    const upgraded = await applyPlanChange(tenant.id, "PRO");
    expect(upgraded.creditsGranted).toBe(0);
    expect(upgraded.dailyCap).toBe(1800);
    const row = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(row.plan).toBe("PRO");
    expect(row.creditBalance).toBe(300);
    expect(row.dailyCap).toBe(1800);
    await prisma.tenant.update({ where: { id: tenant.id }, data: { dailyCap: 12 } });
    const again = await applyPlanChange(tenant.id, "LITE");
    expect(again.dailyCap).toBe(12);
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } })).creditBalance).toBe(300);
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });
});

describe("new salon queue default", () => {
  it("turns the queue on when the column is omitted", async () => {
    const tenant = await prisma.tenant.create({ data: { slug: `queue-default-${Date.now()}`, name: "Queue default" } });
    expect(tenant.productQueue).toBe(true);
    expect(readFileSync("prisma/schema.prisma", "utf8")).toContain("productQueue        Boolean   @default(true)");
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
