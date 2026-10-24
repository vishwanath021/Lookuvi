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
  it("moves the daily cap with the plan only while it still matches the old plan", () => {
    expect(dailyCapAfterPlanChange(50, "LITE", "PRO")).toBe(220);
    expect(dailyCapAfterPlanChange(220, "PRO", "LITE")).toBe(50);
    expect(dailyCapAfterPlanChange(40, "LITE", "PRO")).toBe(40);
    expect(dailyCapAfterPlanChange(120, "STARTER", "STARTER")).toBe(120);
  });

  it("changes the plan without adding try-ons", async () => {
    const tenant = await prisma.tenant.create({
      data: {
        slug: `plan-${Date.now()}`,
        name: "Plan change",
        plan: "LITE",
        creditBalance: 50,
        includedCreditMark: 0,
        dailyCap: 50,
      },
    });
    const upgraded = await applyPlanChange(tenant.id, "PRO");
    expect(upgraded.creditsGranted).toBe(0);
    expect(upgraded.dailyCap).toBe(220);
    const row = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(row.plan).toBe("PRO");
    expect(row.creditBalance).toBe(50);
    expect(row.includedCreditMark).toBe(0);
    const down = await applyPlanChange(tenant.id, "LITE");
    expect(down.creditsGranted).toBe(0);
    expect(down.dailyCap).toBe(50);
    const repeat = await applyPlanChange(tenant.id, "PRO");
    expect(repeat.creditsGranted).toBe(0);
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } })).creditBalance).toBe(50);
    await prisma.tenant.update({ where: { id: tenant.id }, data: { plan: "LITE", dailyCap: 12, includedCreditMark: 0 } });
    const custom = await applyPlanChange(tenant.id, "PRO");
    expect(custom.dailyCap).toBe(12);
    expect(custom.creditsGranted).toBe(0);
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
