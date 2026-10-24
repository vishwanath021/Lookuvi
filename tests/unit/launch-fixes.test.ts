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
    expect(dailyCapAfterPlanChange(300, "LITE", "PRO")).toBe(1800);
    expect(dailyCapAfterPlanChange(1800, "PRO", "LITE")).toBe(300);
    expect(dailyCapAfterPlanChange(40, "LITE", "PRO")).toBe(40);
    expect(dailyCapAfterPlanChange(900, "STARTER", "STARTER")).toBe(900);
  });

  it("grants only the gap above the mark, and does not grant it again", async () => {
    const tenant = await prisma.tenant.create({
      data: {
        slug: `plan-${Date.now()}`,
        name: "Plan change",
        plan: "LITE",
        creditBalance: 300,
        includedCreditMark: 300,
        dailyCap: 300,
      },
    });
    const upgraded = await applyPlanChange(tenant.id, "PRO");
    expect(upgraded.creditsGranted).toBe(1500);
    expect(upgraded.dailyCap).toBe(1800);
    const row = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(row.plan).toBe("PRO");
    expect(row.creditBalance).toBe(1800);
    expect(row.includedCreditMark).toBe(1800);
    const down = await applyPlanChange(tenant.id, "LITE");
    expect(down.creditsGranted).toBe(0);
    expect(down.dailyCap).toBe(300);
    const repeat = await applyPlanChange(tenant.id, "PRO");
    expect(repeat.creditsGranted).toBe(0);
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } })).creditBalance).toBe(1800);
    await prisma.tenant.update({ where: { id: tenant.id }, data: { plan: "LITE", dailyCap: 12, includedCreditMark: 300 } });
    const custom = await applyPlanChange(tenant.id, "PRO");
    expect(custom.dailyCap).toBe(12);
    expect(custom.creditsGranted).toBe(1500);
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
