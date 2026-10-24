import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as generate } from "@/app/api/v1/tryon/generate/route";
import { GET as webhookGet, POST as webhook } from "@/app/api/whatsapp/webhook/route";
import { isStopText, parseCustomerImport } from "@/lib/customers/parse";
import { addCustomer, applyStop, attributeReturn, importCustomers, listCustomers, recordVisit, rememberCustomer, resumeReminders, returnStats } from "@/lib/customers/service";
import type { NotifyEnv } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { addWalkIn, finishEntry, joinQueue } from "@/lib/queue/service";
import { sendBroadcast, sweepDueReminders } from "@/lib/reminders";
import { resetRateLimits } from "@/lib/ratelimit";
import { refuseMonthlyTries } from "@/lib/try-allowance";
import { whatsAppSignature } from "@/lib/whatsapp/inbound";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => null),
}));

const ready: NotifyEnv = {
  WHATSAPP_TOKEN: "token",
  WHATSAPP_PHONE_ID: "phone",
  WHATSAPP_TEMPLATE_REMINDER: "remind",
  WHATSAPP_TEMPLATE_OFFER: "offer",
};

const send = vi.fn(async () => ({ ok: true as const, provider: "whatsapp" }));
const quiet = vi.fn(async () => ({ ok: true as const, provider: "log" }));

async function salon(slug: string, extra: Record<string, unknown> = {}) {
  return prisma.tenant.create({
    data: {
      slug,
      name: slug,
      productQueue: true,
      remindersOn: true,
      reminderDays: 28,
      whatsappMonthlyCap: 10,
      ...extra,
    },
  });
}

async function cleanup() {
  resetRateLimits();
  send.mockClear();
  const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: "return-" } }, select: { id: true } });
  const ids = tenants.map((row) => row.id);
  if (ids.length) {
    await prisma.customerReturn.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.whatsAppSend.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.salonBroadcast.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.queueEntry.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.queueState.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.tryOn.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.customer.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.whatsAppOptOut.deleteMany({ where: { phone: { startsWith: "919100" } } });
}

describe("customer import", () => {
  it("reads a phone, an optional name, and a real date", () => {
    expect(isStopText(" STOP. ")).toBe(true);
    expect(isStopText("unsubscribe")).toBe(true);
    expect(isStopText("cancel my token")).toBe(false);
    const parsed = parseCustomerImport("9876543210, Asha, 2026-09-01\nbad\nAsha Two, 9876543211\n9876543212, 2099-01-01", "2026-10-24");
    expect(parsed.tooLong).toBe(false);
    expect(parsed.invalid).toBe(1);
    expect(parsed.datesIgnored).toBe(1);
    expect(parsed.rows[0]).toMatchObject({ phone: "919876543210", name: "Asha", visitedOn: "2026-09-01" });
    expect(parsed.rows[1]).toMatchObject({ phone: "919876543211", name: "Asha Two", visitedOn: "" });
    expect(parsed.rows[2].visitedOn).toBe("");
    expect(parseCustomerImport(Array.from({ length: 501 }, () => "9876543210").join("\n")).tooLong).toBe(true);
  });
});

describe("salon customer list", () => {
  afterEach(cleanup);

  it("keeps each salon's numbers separate, counts only a finished visit, and skips the walk-in placeholder", async () => {
    const alpha = await salon("return-alpha");
    const beta = await salon("return-beta");
    await rememberCustomer({ tenantId: alpha.id, phone: "9100001111", name: "Asha" });
    await rememberCustomer({ tenantId: beta.id, phone: "9100001111", name: "Bea" });
    expect(await prisma.customer.count({ where: { phone: "919100001111" } })).toBe(2);
    const listed = await listCustomers(alpha.id, "Asha");
    expect(listed).toHaveLength(1);
    expect(listed[0].visitCount).toBe(0);
    expect(listed[0].name).toBe("Asha");
    expect(await listCustomers(beta.id, "Asha")).toHaveLength(0);

    await prisma.queueState.create({ data: { tenantId: alpha.id, isOpen: true, mode: "LIVE" } });
    await addWalkIn(alpha.id, { phone: "9100002222" }, quiet);
    const saved = await prisma.customer.findFirstOrThrow({ where: { tenantId: alpha.id, phone: "919100002222" } });
    expect(saved.name).toBe("");
    expect(saved.visitCount).toBe(0);
    const entry = await prisma.queueEntry.findFirstOrThrow({ where: { tenantId: alpha.id, phone: "919100002222" } });
    await finishEntry(alpha.id, entry.id, "NO_SHOW", quiet);
    expect((await prisma.customer.findFirstOrThrow({ where: { id: saved.id } })).visitCount).toBe(0);
    await addWalkIn(alpha.id, { name: "Neel", phone: "9100002222" }, quiet);
    const again = await prisma.queueEntry.findFirstOrThrow({ where: { tenantId: alpha.id, phone: "919100002222", status: "WAITING" } });
    await finishEntry(alpha.id, again.id, "DONE", quiet);
    const visited = await prisma.customer.findFirstOrThrow({ where: { id: saved.id } });
    expect(visited.visitCount).toBe(1);
    expect(visited.name).toBe("Neel");
    expect(visited.needsReminder).toBe(true);
  });

  it("imports a last visit without replacing a later one", async () => {
    const alpha = await salon("return-import");
    const added = await addCustomer(alpha.id, "12345", "");
    expect(added.ok).toBe(false);
    await importCustomers(alpha.id, "9100003333, Asha, 2026-08-01", new Date("2026-10-24T12:00:00+05:30"));
    const row = await prisma.customer.findFirstOrThrow({ where: { tenantId: alpha.id } });
    expect(row.visitCount).toBe(1);
    expect(row.needsReminder).toBe(true);
    await recordVisit(alpha.id, "9100003333", "Asha", new Date("2026-10-20T08:00:00+05:30"));
    await importCustomers(alpha.id, "9100003333, Asha, 2026-08-01", new Date("2026-10-24T12:00:00+05:30"));
    const kept = await prisma.customer.findFirstOrThrow({ where: { id: row.id } });
    expect(kept.lastVisitAt?.toISOString().slice(0, 10)).toBe("2026-10-20");
    expect(kept.visitCount).toBe(2);
  });
});

describe("reminders, cap, and STOP", () => {
  afterEach(cleanup);

  async function due(tenantId: string, phone: string, daysAgo = 40) {
    const row = await rememberCustomer({ tenantId, phone, name: "Asha" });
    await prisma.customer.update({
      where: { id: row!.id },
      data: { visitCount: 1, lastVisitAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000), needsReminder: true },
    });
    return row!;
  }

  it("sends one reminder, then refuses a second, and stops at the cap", async () => {
    const alpha = await salon("return-remind", { whatsappMonthlyCap: 1 });
    const first = await due(alpha.id, "9100004441");
    const second = await due(alpha.id, "9100004442");
    const once = await sweepDueReminders(send, ready);
    expect(once.sent).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].body).toContain("Time for your next visit at return-remind?");
    expect(send.mock.calls[0][0].body).toContain("Reply STOP to opt out.");
    expect(send.mock.calls[0][0].body).toContain("/queue?r=");
    const again = await sweepDueReminders(send, ready);
    expect(again.sent).toBe(0);
    const reminded = await prisma.customer.findFirstOrThrow({ where: { id: first.id } });
    const waiting = await prisma.customer.findFirstOrThrow({ where: { id: second.id } });
    expect(reminded.needsReminder).toBe(false);
    expect(waiting.needsReminder).toBe(true);
    expect(await prisma.whatsAppSend.count({ where: { tenantId: alpha.id, status: "SENT" } })).toBe(1);
  });

  it("does not send or spend the cap when WhatsApp is off, and a failed send stays due", async () => {
    const alpha = await salon("return-off");
    const row = await due(alpha.id, "9100004555");
    const off = await sweepDueReminders(send, {});
    expect(off).toMatchObject({ sent: 0, reason: "OFF" });
    expect((await prisma.customer.findFirstOrThrow({ where: { id: row.id } })).needsReminder).toBe(true);
    const failing = vi.fn(async () => ({ ok: false as const, provider: "whatsapp", error: "HTTP_500" }));
    const failed = await sweepDueReminders(failing, ready);
    expect(failed.sent).toBe(0);
    expect((await prisma.customer.findFirstOrThrow({ where: { id: row.id } })).needsReminder).toBe(true);
    expect(await prisma.whatsAppSend.count({ where: { tenantId: alpha.id, status: "SENT" } })).toBe(0);
  });

  it("skips STOP and a desk stop, and the owner cannot undo STOP", async () => {
    const alpha = await salon("return-stop");
    const beta = await salon("return-stop-b");
    const row = await due(alpha.id, "9100004666");
    await rememberCustomer({ tenantId: beta.id, phone: "9100004666", name: "Asha" });
    await applyStop("9100004666");
    expect(await sweepDueReminders(send, ready)).toMatchObject({ sent: 0 });
    expect((await prisma.customer.findFirstOrThrow({ where: { id: row.id } })).optOutSource).toBe("STOP");
    expect((await resumeReminders(alpha.id, row.id)).ok).toBe(false);
    const other = await prisma.customer.findFirstOrThrow({ where: { tenantId: beta.id, phone: "919100004666" } });
    expect(other.optOutSource).toBe("STOP");
  });

  it("counts a reminder return only for the same phone and the same salon", async () => {
    const alpha = await salon("return-attr");
    const beta = await salon("return-attr-b");
    const row = await due(alpha.id, "9100004777", 10);
    await prisma.customer.update({ where: { id: row.id }, data: { needsReminder: false } });
    const sent = await prisma.whatsAppSend.create({
      data: {
        tenantId: alpha.id,
        customerId: row.id,
        phone: row.phone,
        kind: "reminder",
        status: "SENT",
        linkToken: "reminder-token-value-1",
        monthKey: "2026-10",
      },
    });
    await prisma.queueState.create({ data: { tenantId: alpha.id, isOpen: true, mode: "LIVE", alertLeadMin: -1 } });
    await prisma.queueState.create({ data: { tenantId: beta.id, isOpen: true, mode: "LIVE", alertLeadMin: -1 } });
    await joinQueue({ slug: alpha.slug, name: "Other", phone: "9100004888", consent: true, ip: "attr-other", returnToken: "reminder-token-value-1", send: quiet });
    expect(await prisma.customerReturn.count({ where: { sendId: sent.id } })).toBe(0);
    await joinQueue({ slug: beta.slug, name: "Asha", phone: "9100004777", consent: true, ip: "attr-beta", returnToken: "reminder-token-value-1", send: quiet });
    expect(await prisma.customerReturn.count()).toBe(0);
    await joinQueue({ slug: alpha.slug, name: "Asha", phone: "9100004777", consent: true, ip: "attr-alpha", returnToken: "reminder-token-value-1", send: quiet });
    await joinQueue({ slug: alpha.slug, name: "Asha", phone: "9100004777", consent: true, ip: "attr-alpha-2", returnToken: "reminder-token-value-1", send: quiet });
    expect(await prisma.customerReturn.count({ where: { tenantId: alpha.id } })).toBe(1);
    const stats = await returnStats(alpha.id);
    expect(stats.remindedCustomers).toBe(1);
    expect(stats.returnedCustomers).toBe(1);
    const offer = await prisma.whatsAppSend.create({
      data: {
        tenantId: alpha.id,
        customerId: row.id,
        phone: row.phone,
        kind: "offer",
        status: "SENT",
        linkToken: "offer-token-value-0002",
        monthKey: "2026-10",
      },
    });
    expect(await attributeReturn({ tenantId: alpha.id, phone: row.phone, linkToken: offer.linkToken || "" })).toBe(false);
  });

  it("sends an offer only up to the cap and does not clear the visit reminder", async () => {
    const alpha = await salon("return-offer", { whatsappMonthlyCap: 1 });
    const row = await due(alpha.id, "9100004991");
    await rememberCustomer({ tenantId: alpha.id, phone: "9100004992", name: "Bea" });
    const result = await sendBroadcast(alpha.id, "Wedding week, book the chair", send, ready);
    expect(result.sent).toBe(1);
    expect(result.held).toBe(1);
    expect(result.message).toContain("Sent to 1");
    expect((await prisma.customer.findFirstOrThrow({ where: { id: row.id } })).needsReminder).toBe(true);
    const second = await sendBroadcast(alpha.id, "One more offer", send, ready);
    expect(second.sent).toBe(0);
    expect(second.message).toContain("monthly limit");
    const off = await sendBroadcast(alpha.id, "Quiet offer", send, {});
    expect(off.message).toContain("not connected");
  });
});

describe("monthly try-on allowance", () => {
  afterEach(cleanup);

  it("refuses the next preview when this month's included tries are used", async () => {
    const alpha = await salon("return-tries", { monthlyTryAllowance: 1, productTryOn: true });
    expect(await refuseMonthlyTries(alpha.id, 1)).toBeNull();
    await prisma.tryOn.create({ data: { tenantId: alpha.id, sessionId: "session-12", kind: "STYLE", status: "SUCCEEDED" } });
    expect((await refuseMonthlyTries(alpha.id, 1))?.error).toBe("MONTHLY_CAP");
    const form = new FormData();
    form.set("slug", alpha.slug);
    form.set("styleId", "pixie");
    form.set("sessionId", "session-12");
    form.set("tool", "style");
    form.set("photo", new File([new Uint8Array([1, 2, 3])], "selfie.jpg", { type: "image/jpeg" }));
    const res = await generate(new Request("http://localhost/api/v1/tryon/generate", { method: "POST", body: form }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("MONTHLY_CAP");
  });
});

describe("WhatsApp STOP webhook", () => {
  afterEach(async () => {
    delete process.env.WHATSAPP_APP_SECRET;
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    await cleanup();
  });

  it("rejects an unsigned body and opts the phone out when the signature matches", async () => {
    process.env.WHATSAPP_APP_SECRET = "app-secret";
    const alpha = await salon("return-hook");
    await rememberCustomer({ tenantId: alpha.id, phone: "9100005555", name: "Asha" });
    const payload = JSON.stringify({
      entry: [{ changes: [{ value: { messages: [{ from: "919100005555", type: "text", text: { body: "STOP" } }] } }] }],
    });
    const denied = await webhook(new Request("http://localhost/api/whatsapp/webhook", { method: "POST", body: payload }));
    expect(denied.status).toBe(403);
    const signed = await webhook(new Request("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      body: payload,
      headers: { "x-hub-signature-256": whatsAppSignature(payload, "app-secret") },
    }));
    expect(signed.status).toBe(200);
    expect((await prisma.customer.findFirstOrThrow({ where: { tenantId: alpha.id } })).optOutSource).toBe("STOP");
    process.env.WHATSAPP_VERIFY_TOKEN = "verify-me";
    const ok = await webhookGet(new Request("http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=ok"));
    expect(await ok.text()).toBe("ok");
    const deniedGet = await webhookGet(new Request("http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=ok"));
    expect(deniedGet.status).toBe(403);
  });
});
