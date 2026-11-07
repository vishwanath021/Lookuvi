import { afterEach, describe, expect, it, vi } from "vitest";
import { lapseCutoff, lapseSummary, listLapsed } from "@/lib/customers/lapsed";
import type { NotifyEnv } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { sendComeBack } from "@/lib/reminders";

const ready: NotifyEnv = {
  WHATSAPP_TOKEN: "token",
  WHATSAPP_PHONE_ID: "phone",
  WHATSAPP_TEMPLATE_REMINDER: "remind",
  WHATSAPP_TEMPLATE_OFFER: "offer",
};

const send = vi.fn(async () => ({ ok: true as const, provider: "whatsapp" }));

async function cleanup() {
  send.mockClear();
  const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: "lapsed-" } }, select: { id: true } });
  const ids = tenants.map((row) => row.id);
  if (!ids.length) return;
  await prisma.whatsAppSend.deleteMany({ where: { tenantId: { in: ids } } });
  await prisma.customer.deleteMany({ where: { tenantId: { in: ids } } });
  await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
}

describe("customers not back yet", () => {
  afterEach(cleanup);

  it("groups last visits into 6 weeks, 2 months, and 3 months", async () => {
    const now = new Date("2026-11-07T06:30:00.000Z");
    const tenant = await prisma.tenant.create({
      data: { slug: `lapsed-group-${Date.now()}`, name: "Lapsed", productQueue: true },
    });
    const rows = [
      { phone: "919100000001", name: "Recent", at: "2026-10-20T06:30:00.000Z" },
      { phone: "919100000002", name: "Six", at: "2026-09-20T06:30:00.000Z" },
      { phone: "919100000003", name: "Two", at: "2026-08-20T06:30:00.000Z" },
      { phone: "919100000004", name: "Three", at: "2026-07-01T06:30:00.000Z" },
    ];
    for (const row of rows) {
      await prisma.customer.create({
        data: {
          tenantId: tenant.id,
          phone: row.phone,
          name: row.name,
          visitCount: 2,
          lastVisitAt: new Date(row.at),
        },
      });
    }
    const listed = await listLapsed(tenant.id, now);
    expect(lapseCutoff("weeks6", now).toISOString().slice(0, 10)).toBe("2026-09-26");
    expect(listed.summary).toBe(lapseSummary(3));
    expect(listed.weeks6.map((row) => row.name).sort()).toEqual(["Six", "Three", "Two"]);
    expect(listed.months2.map((row) => row.name).sort()).toEqual(["Three", "Two"]);
    expect(listed.months3.map((row) => row.name)).toEqual(["Three"]);
    expect(listed.weeks6[0].phoneLabel).toBe("91000 00004");
    expect(listed.weeks6.every((row) => row.visitCount === 2)).toBe(true);
  });

  it("does not send to opted-out numbers and stops at the monthly cap", async () => {
    const tenant = await prisma.tenant.create({
      data: { slug: `lapsed-send-${Date.now()}`, name: "Send", productQueue: true, whatsappMonthlyCap: 1 },
    });
    const opted = await prisma.customer.create({
      data: { tenantId: tenant.id, phone: "919100000011", name: "Stopped", optedOutAt: new Date(), optOutSource: "STOP", visitCount: 1, lastVisitAt: new Date("2026-07-01") },
    });
    const first = await prisma.customer.create({
      data: { tenantId: tenant.id, phone: "919100000012", name: "One", visitCount: 1, lastVisitAt: new Date("2026-07-01") },
    });
    const second = await prisma.customer.create({
      data: { tenantId: tenant.id, phone: "919100000013", name: "Two", visitCount: 1, lastVisitAt: new Date("2026-07-01") },
    });
    const sent = await sendComeBack(tenant.id, [opted.id, first.id, second.id], send, ready);
    expect(sent.ok).toBe(true);
    expect(sent.sent).toBe(1);
    expect(sent.skipped).toBeGreaterThanOrEqual(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).not.toBe(opted.phone);
    const sentPhone = send.mock.calls[0][0].to as string;
    const other = sentPhone === first.phone ? second : first;
    const again = await sendComeBack(tenant.id, [other.id], send, ready);
    expect(again.ok).toBe(false);
    expect(again.message).toMatch(/monthly/i);
    expect(await prisma.whatsAppSend.count({ where: { tenantId: tenant.id, status: "SENT" } })).toBe(1);

    const missing = await sendComeBack(tenant.id, [second.id], send, { WHATSAPP_TOKEN: "token", WHATSAPP_PHONE_ID: "phone" });
    expect(missing.ok).toBe(false);
    expect(missing.message).toMatch(/template/i);
    expect(await prisma.whatsAppSend.count({ where: { tenantId: tenant.id, status: "SENT" } })).toBe(1);
  });
});
