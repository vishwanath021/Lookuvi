import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PUT as saveSettings } from "@/app/api/v1/admin/settings/route";
import { POST as markRoute } from "@/app/api/v1/admin/reminders/route";
import { ReminderMethodChoice } from "@/components/admin/ReminderMethodChoice";
import { DueVisitBoard } from "@/components/admin/DueVisitBoard";
import { ownerFeatures, ownerNav } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { resetRateLimits, sharedRateLimit } from "@/lib/ratelimit";
import {
  DEFAULT_REMINDER_TEMPLATE,
  REMINDER_MARK_LIMIT,
  REMINDER_MARK_WINDOW_MS,
  cleanReminderTemplate,
  dueVisitIntro,
  renderReminderMessage,
  whatsAppAppUrl,
  whatsAppMeUrl,
  whatsAppWebUrl,
} from "@/lib/visit-reminders";
import { listDueVisits, markReminded, undoReminder } from "@/lib/visit-reminders-data";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { auth } from "@/auth";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-07T12:00:00.000Z");
const tenants: string[] = [];
const users: string[] = [];

function tag() {
  return Math.random().toString(36).slice(2, 10);
}

async function salon(name: string, extra: Record<string, unknown> = {}) {
  const tenant = await prisma.tenant.create({
    data: { slug: `due-${tag()}`, name, productQueue: true, reminderDays: 42, reminderMethod: "MANUAL", ...extra },
  });
  tenants.push(tenant.id);
  return tenant;
}

async function person(tenantId: string, phone: string, name: string, daysAgo: number, extra: Record<string, unknown> = {}) {
  return prisma.customer.create({
    data: {
      tenantId,
      phone,
      name,
      visitCount: 1,
      lastVisitAt: new Date(now.getTime() - daysAgo * DAY),
      needsReminder: true,
      ...extra,
    },
  });
}

async function ownerOf(tenantId: string, role = "OWNER") {
  const user = await prisma.user.create({
    data: { email: `due-${tag()}@lookuvi.test`, name: "Due Owner", passwordHash: "hash" },
  });
  users.push(user.id);
  await prisma.membership.create({ data: { userId: user.id, tenantId, role } });
  vi.mocked(auth).mockResolvedValue({
    user: { id: user.id, email: user.email, name: user.name, isSuperAdmin: false, tenantId, role },
    expires: "2099-01-01T00:00:00.000Z",
  } as never);
  return user;
}

afterEach(async () => {
  resetRateLimits();
  if (tenants.length) {
    await prisma.visitReminder.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.loyaltyLedger.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.whatsAppOptOut.deleteMany({ where: { phone: { startsWith: "91981" } } });
    await prisma.customer.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.membership.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenants.splice(0) } } });
  }
  if (users.length) await prisma.user.deleteMany({ where: { id: { in: users.splice(0) } } });
});

describe("come-back message", () => {
  it("adds the points line only when the balance is above zero, and encodes the WhatsApp link", () => {
    const quiet = renderReminderMessage({
      template: "",
      name: "Sample One",
      salon: "Demo Salon",
      points: 0,
      link: "",
    });
    expect(quiet).toBe("Hi Sample One, it's been a while since your last visit to Demo Salon! Come in for a fresh look.");
    expect(quiet.toLowerCase()).not.toContain("points");
    expect(DEFAULT_REMINDER_TEMPLATE).toContain("{name}");

    const withPoints = renderReminderMessage({
      template: DEFAULT_REMINDER_TEMPLATE,
      name: "Sample One",
      salon: "Demo Salon",
      points: 4,
      link: "https://example.test/s/demo/queue",
    });
    expect(withPoints).toBe(`${quiet}\nYou have 4 points.`);
    expect(withPoints.match(/points/gi)).toHaveLength(1);

    const custom = renderReminderMessage({
      template: "Hi {name}. You have {points} points.\n{link}",
      name: "Sample One",
      salon: "Demo Salon",
      points: 0,
      link: "",
    });
    expect(custom).toBe("Hi Sample One.");

    const linked = renderReminderMessage({
      template: "Hi {name}\n{link}",
      name: "<b>Sample</b>",
      salon: "Demo Salon",
      points: 2,
      link: "https://example.test/join",
    });
    expect(linked).not.toContain("<");
    expect(linked).toContain("https://example.test/join");
    expect(linked).toContain("You have 2 points.");

    const me = whatsAppMeUrl("9800000101", withPoints);
    const web = whatsAppWebUrl("+91 98000 00101", withPoints);
    const app = whatsAppAppUrl("919800000101", withPoints);
    expect(me).toBe(`https://wa.me/919800000101?text=${encodeURIComponent(withPoints)}`);
    expect(web).toBe(`https://web.whatsapp.com/send?phone=919800000101&text=${encodeURIComponent(withPoints)}`);
    expect(app.startsWith("whatsapp://send?phone=919800000101&text=")).toBe(true);
    expect(decodeURIComponent(me.split("text=")[1])).toBe(withPoints);
    expect(me).toContain(encodeURIComponent("it's been"));
    expect(me).toContain("You%20have%204%20points.");
    expect(me).toContain("%0A");

    const cleaned = cleanReminderTemplate("<script>alert(1)</script>Hello");
    expect(cleaned.ok).toBe(true);
    if (cleaned.ok) {
      expect(cleaned.text).not.toContain("<");
      expect(cleaned.text).not.toContain(">");
    }
    expect(cleanReminderTemplate("a".repeat(501)).ok).toBe(false);
    expect(dueVisitIntro(42)).toBe("Customers who haven't come back in 6 weeks.");
  });

  it("shows the free choice selected and keeps automatic sending disabled", () => {
    const html = renderToStaticMarkup(createElement(ReminderMethodChoice, { value: "MANUAL", onChange: () => undefined }));
    expect(html).toContain("How do you want to send come-back reminders?");
    expect(html).toMatch(/I(?:&#x27;|')ll send them myself \(Free\)/);
    expect(html).toContain("Lookuvi gets the message ready, you tap Send in your WhatsApp.");
    expect(html).toContain("Coming soon");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("Turns on after WhatsApp Business approval.");
    const empty = renderToStaticMarkup(createElement(DueVisitBoard, { initialRows: [], days: 42 }));
    expect(empty).toContain("Everyone has visited recently. Nothing to send today.");
    expect(empty).toContain("Customers who haven");
  });
});

describe("customers due for a visit", () => {
  it("uses the day threshold, skips people already reminded, and stays inside this salon", async () => {
    const home = await salon("Home Salon");
    const other = await salon("Other Salon");
    expect(home.reminderDays).toBe(42);
    expect(home.reminderMethod).toBe("MANUAL");

    const due = await person(home.id, "919810000001", "Sample One", 42);
    const recent = await person(home.id, "919810000002", "Sample Recent", 41);
    const reminded = await person(home.id, "919810000003", "Sample Reminded", 60);
    await person(home.id, "919810000006", "Sample Already", 70, { lastRemindedVisitAt: new Date(now.getTime() - 70 * DAY) });
    const again = await person(home.id, "919810000004", "Sample Again", 50);
    const stopped = await person(home.id, "919810000005", "Sample Stopped", 80, { optedOutAt: now, optOutSource: "STOP" });
    await person(other.id, "919810000001", "Other Salon Person", 90);
    await prisma.loyaltyLedger.create({
      data: { tenantId: home.id, phone: due.phone, delta: 4, kind: "adjust", balanceAfter: 4, reason: "seed" },
    });
    await prisma.visitReminder.create({
      data: { tenantId: home.id, phone: reminded.phone, visitAt: reminded.lastVisitAt!, sentAt: now, method: "MANUAL", userId: "owner" },
    });
    await prisma.visitReminder.create({
      data: {
        tenantId: home.id,
        phone: again.phone,
        visitAt: new Date(now.getTime() - 80 * DAY),
        sentAt: new Date(now.getTime() - 80 * DAY),
        method: "MANUAL",
        userId: "owner",
      },
    });

    const listed = await listDueVisits(home, now);
    const names = listed.customers.map((row) => row.name);
    expect(names).toEqual(["Sample Again", "Sample One"]);
    expect(names).not.toContain("Sample Recent");
    expect(names).not.toContain("Sample Reminded");
    expect(names).not.toContain("Sample Already");
    expect(names).not.toContain("Sample Stopped");
    expect(names).not.toContain("Other Salon Person");
    expect(listed.customers.find((row) => row.id === due.id)?.points).toBe(4);
    expect(listed.customers.find((row) => row.id === due.id)?.message).toContain("You have 4 points.");
    expect(listed.customers.find((row) => row.id === again.id)?.message.toLowerCase()).not.toContain("points");
    expect(listed.customers.find((row) => row.id === due.id)?.daysSince).toBe(42);
    expect(listed.customers.find((row) => row.id === due.id)?.phoneLabel).toBe("98100 00001");
    expect(listed.customers.find((row) => row.id === due.id)?.meUrl).toContain("https://wa.me/919810000001?text=");

    const otherList = await listDueVisits(other, now);
    expect(otherList.customers.map((row) => row.name)).toEqual(["Other Salon Person"]);

    const marked = await markReminded({ tenantId: home.id, customerId: due.id, userId: "owner-1", now });
    expect(marked.ok).toBe(true);
    if (!marked.ok) return;
    expect((await listDueVisits(home, now)).customers.map((row) => row.name)).toEqual(["Sample Again"]);
    const row = await prisma.visitReminder.findFirstOrThrow({ where: { id: marked.reminderId } });
    expect(row.method).toBe("MANUAL");
    expect(row.phone).toBe("919810000001");
    expect(row.tenantId).toBe(home.id);
    expect((await prisma.customer.findFirstOrThrow({ where: { id: due.id } })).needsReminder).toBe(false);

    const leaked = await undoReminder({ tenantId: other.id, reminderId: marked.reminderId });
    expect(leaked.ok).toBe(false);
    expect((await undoReminder({ tenantId: home.id, reminderId: marked.reminderId })).ok).toBe(true);
    expect((await listDueVisits(home, now)).customers.map((row) => row.name)).toContain("Sample One");
    expect(stopped.id).toBeTruthy();
  });

  it("keeps the mark endpoint to the owner and rate limits it", async () => {
    const home = await salon("Rate Salon");
    const elsewhere = await salon("Elsewhere");
    const guest = await person(elsewhere.id, "919810000009", "Not Here", 50);
    const staff = await ownerOf(home.id, "STAFF");
    const denied = await markRoute(new Request("http://localhost/api/v1/admin/reminders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "mark", id: guest.id }),
    }));
    expect(denied.status).toBe(403);

    const owner = await ownerOf(home.id, "OWNER");
    const foreign = await markRoute(new Request("http://localhost/api/v1/admin/reminders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "mark", id: guest.id }),
    }));
    expect(foreign.status).toBe(404);
    expect(await prisma.visitReminder.count({ where: { tenantId: elsewhere.id } })).toBe(0);

    const auto = await saveSettings(new Request("http://localhost/api/v1/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reminderMethod: "AUTO" }),
    }));
    expect(auto.status).toBe(400);
    expect((await auto.json()).message).toMatch(/not available/i);

    const tooLong = await saveSettings(new Request("http://localhost/api/v1/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reminderTemplate: "a".repeat(501) }),
    }));
    expect(tooLong.status).toBe(400);

    const saved = await saveSettings(new Request("http://localhost/api/v1/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reminderDays: 42, reminderMethod: "MANUAL", reminderTemplate: "Hi {name} <b>there</b>" }),
    }));
    expect(saved.status).toBe(200);
    const updated = await prisma.tenant.findUniqueOrThrow({ where: { id: home.id } });
    expect(updated.reminderTemplate).toBe("Hi {name} there");
    expect(updated.reminderMethod).toBe("MANUAL");
    expect(updated.reminderDays).toBe(42);

    for (let i = 0; i < REMINDER_MARK_LIMIT; i += 1) {
      await sharedRateLimit(`remind-mark:${owner.id}:direct`, REMINDER_MARK_LIMIT, REMINDER_MARK_WINDOW_MS);
    }
    const limited = await markRoute(new Request("http://localhost/api/v1/admin/reminders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "mark", id: guest.id }),
    }));
    expect(limited.status).toBe(429);
    expect(staff.id).toBeTruthy();
    const labels = ownerNav({ role: "OWNER", slug: home.slug, productTryOn: true, productQueue: true, features: ownerFeatures({}) }).map((link) => link.label);
    expect(labels).toContain("Due for a visit");
    const staffNav = ownerNav({ role: "STAFF", slug: home.slug, productTryOn: true, productQueue: true, features: ownerFeatures({}) }).map((link) => link.label);
    expect(staffNav).not.toContain("Due for a visit");
  });
});
