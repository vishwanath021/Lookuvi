import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { releaseTryReservation, reserveTryCaps, settleTryReservation, TRY_CAP_STATUSES } from "@/lib/try-allowance";

async function salon(slug: string, data: { monthlyTryAllowance?: number; dailyCap?: number } = {}) {
  return prisma.tenant.create({
    data: {
      slug: `cap-${slug}-${Date.now()}`,
      name: "Cap salon",
      productTryOn: true,
      monthlyTryAllowance: data.monthlyTryAllowance ?? 30,
      dailyCap: data.dailyCap ?? 100,
      creditBalance: 50,
    },
  });
}

describe("atomic try caps", () => {
  const ids: string[] = [];

  afterEach(async () => {
    for (const id of ids.splice(0)) {
      await prisma.tryOn.deleteMany({ where: { tenantId: id } });
      await prisma.tenant.delete({ where: { id } }).catch(() => undefined);
    }
  });

  it("lets only one of many parallel reserves through when the monthly allowance is 1", async () => {
    const tenant = await salon("race-month", { monthlyTryAllowance: 1, dailyCap: 100 });
    ids.push(tenant.id);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        reserveTryCaps({
          tenantId: tenant.id,
          monthlyAllowance: 1,
          dailyCap: 100,
          sessionId: `s-${i}`,
          kind: "STYLE",
          tier: "anon",
          actorKey: `anon:${i}`,
        }),
      ),
    );
    const ok = results.filter((row) => row.ok);
    const refused = results.filter((row) => !row.ok);
    expect(ok).toHaveLength(1);
    expect(refused.length).toBe(7);
    expect(refused.every((row) => !row.ok && row.error === "MONTHLY_CAP")).toBe(true);
    const held = await prisma.tryOn.count({
      where: { tenantId: tenant.id, status: { in: [...TRY_CAP_STATUSES] } },
    });
    expect(held).toBe(1);
  });

  it("lets only one of many parallel reserves through when the daily cap is 1", async () => {
    const tenant = await salon("race-day", { monthlyTryAllowance: 30, dailyCap: 1 });
    ids.push(tenant.id);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        reserveTryCaps({
          tenantId: tenant.id,
          monthlyAllowance: 30,
          dailyCap: 1,
          sessionId: `d-${i}`,
          kind: "STYLE",
        }),
      ),
    );
    expect(results.filter((row) => row.ok)).toHaveLength(1);
    expect(results.filter((row) => !row.ok && row.error === "DAILY_CAP")).toHaveLength(7);
  });

  it("releases a reserved slot so another request can take it", async () => {
    const tenant = await salon("release", { monthlyTryAllowance: 1, dailyCap: 10 });
    ids.push(tenant.id);
    const first = await reserveTryCaps({
      tenantId: tenant.id,
      monthlyAllowance: 1,
      dailyCap: 10,
      sessionId: "a",
      kind: "STYLE",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    await releaseTryReservation(first.id);
    const second = await reserveTryCaps({
      tenantId: tenant.id,
      monthlyAllowance: 1,
      dailyCap: 10,
      sessionId: "b",
      kind: "STYLE",
    });
    expect(second.ok).toBe(true);
  });

  it("commit keeps the slot counted as SUCCEEDED", async () => {
    const tenant = await salon("commit", { monthlyTryAllowance: 1, dailyCap: 10 });
    ids.push(tenant.id);
    const first = await reserveTryCaps({
      tenantId: tenant.id,
      monthlyAllowance: 1,
      dailyCap: 10,
      sessionId: "c",
      kind: "STYLE",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    await settleTryReservation(first.id, { status: "SUCCEEDED", credits: 1 });
    const blocked = await reserveTryCaps({
      tenantId: tenant.id,
      monthlyAllowance: 1,
      dailyCap: 10,
      sessionId: "d",
      kind: "STYLE",
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toBe("MONTHLY_CAP");
  });
});
