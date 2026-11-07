import { createHash, randomBytes } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compare, hash } from "bcryptjs";
import { afterAll, describe, expect, it } from "vitest";
import { POST as resetPassword } from "@/app/api/v1/auth/reset/route";
import PrivacyPage from "@/app/privacy/page";
import { looksForEvent } from "@/data/bridal";
import { HAIR_READING_RETRY, HAIR_SUGGEST_TIMEOUT_MS } from "@/lib/ai/hair-suggest";
import { rememberGenerated, readGenerated } from "@/lib/generated-session";
import { prisma } from "@/lib/prisma";
import { remainingServiceMinutes } from "@/lib/queue/estimate";
import { sessionCloseClock, visitShouldExpire } from "@/lib/queue/expiry";
import { slotFullMessage, joinQueue } from "@/lib/queue/service";
import { clientIp, isSharedProxyAddress, resetRateLimits } from "@/lib/ratelimit";
import { VISIT_CAP_MESSAGE } from "@/lib/visit-tries";
import { existsSync } from "node:fs";

const createdUsers: string[] = [];

afterAll(async () => {
  if (createdUsers.length) await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
});

describe("qa red rows", () => {
  it("row 47: a service that has already started has less time left", () => {
    const started = new Date("2026-11-07T10:00:00.000Z");
    expect(remainingServiceMinutes(30, started, new Date(started.getTime() + 10 * 60_000))).toBe(20);
    expect(remainingServiceMinutes(30, started, new Date(started.getTime() + 40 * 60_000))).toBe(0);
    expect(remainingServiceMinutes(30, null, started)).toBe(30);
  });

  it("row 48: a reset updates only the user who owns the token", async () => {
    resetRateLimits();
    const passwordA = await hash("OwnerA-password-1", 4);
    const passwordB = await hash("OwnerB-password-1", 4);
    const tag = randomBytes(4).toString("hex");
    const userA = await prisma.user.create({
      data: { email: `reset-a-${tag}@example.test`, name: "Owner A", passwordHash: passwordA, sessionVersion: 2 },
    });
    const userB = await prisma.user.create({
      data: { email: `reset-b-${tag}@example.test`, name: "Owner B", passwordHash: passwordB, sessionVersion: 4 },
    });
    createdUsers.push(userA.id, userB.id);
    const token = randomBytes(32).toString("hex");
    await prisma.passwordReset.create({
      data: {
        email: userA.email,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    const res = await resetPassword(new Request("http://localhost/api/v1/auth/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password: "OwnerA-password-2" }),
    }));
    expect(res.status).toBe(200);
    const freshA = await prisma.user.findUniqueOrThrow({ where: { id: userA.id } });
    const freshB = await prisma.user.findUniqueOrThrow({ where: { id: userB.id } });
    expect(freshA.sessionVersion).toBe(3);
    expect(await compare("OwnerA-password-2", freshA.passwordHash)).toBe(true);
    expect(freshB.passwordHash).toBe(passwordB);
    expect(freshB.sessionVersion).toBe(4);
    const leftover = await prisma.passwordReset.count({ where: { email: userA.email, used: false } });
    expect(leftover).toBe(0);
  });

  it("row 50: mehendi, sangeet, and engagement do not share a reference", () => {
    const mehendi = looksForEvent("mehendi").map((look) => look.id);
    const sangeet = looksForEvent("sangeet").map((look) => look.id);
    const engagement = looksForEvent("engagement").map((look) => look.id);
    expect(mehendi.length).toBeGreaterThan(1);
    expect(sangeet.length).toBeGreaterThan(1);
    expect(engagement.length).toBeGreaterThan(1);
    const shared = mehendi.filter((id) => sangeet.includes(id) || engagement.includes(id));
    expect(shared).toEqual([]);
    expect(sangeet.filter((id) => engagement.includes(id))).toEqual([]);
    for (const id of [...mehendi, ...sangeet, ...engagement]) {
      expect(existsSync(`public/bridal/${id}.webp`) || existsSync(`public/bridal/${id}.jpg`)).toBe(true);
    }
  });

  it("row 52: a failed hair reading asks the guest to try again", () => {
    expect(HAIR_READING_RETRY).toMatch(/try again/i);
    expect(HAIR_READING_RETRY).not.toMatch(/RESEND|not sent again/);
    expect(HAIR_SUGGEST_TIMEOUT_MS).toBeGreaterThan(30_000);
  });

  it("row 54: the privacy cross-border line does not print the street", () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    expect(html).toContain("Hyderabad, Telangana, India");
    expect(html).toContain("admin@agenticbuildworks.com");
    expect(html).not.toContain("Kismatpur");
    expect(html).not.toContain("Om Nagar");
  });

  it("row 10: the guest cap message has no visit code", () => {
    expect(VISIT_CAP_MESSAGE).toMatch(/unlock more tries/i);
    expect(VISIT_CAP_MESSAGE).not.toMatch(/code/i);
  });

  it("row 11: a private proxy hop is not a customer address", () => {
    expect(clientIp("203.0.113.20, 172.18.0.3", true)).toBe("203.0.113.20");
    expect(isSharedProxyAddress("proxy")).toBe(true);
    expect(isSharedProxyAddress("172.18.0.3")).toBe(true);
    expect(isSharedProxyAddress("203.0.113.20")).toBe(false);
  });

  it("row 17: the full-slot message names the chair count", () => {
    expect(slotFullMessage(2)).toMatch(/2 chairs/);
    expect(slotFullMessage(1)).toMatch(/1 chair/);
  });

  it("row 57: a generated look is still there after the screen remounts", () => {
    const key = "lookuvi-generated:qa-salon";
    rememberGenerated(key, {
      id: "look-1",
      name: "Soft rose",
      before: "data:image/jpeg;base64,aaa",
      after: "data:image/jpeg;base64,bbb",
      kind: "look",
    });
    expect(readGenerated(key).map((item) => item.name)).toEqual(["Soft rose"]);
  });

  it("row 59: yesterday's token and a closed session expire; a future request does not", () => {
    const week = JSON.stringify({
      mon: [{ open: "10:00", close: "18:00" }],
      tue: [{ open: "10:00", close: "18:00" }],
      wed: [{ open: "10:00", close: "18:00" }],
      thu: [{ open: "10:00", close: "18:00" }],
      fri: [{ open: "10:00", close: "18:00" }],
      sat: [{ open: "10:00", close: "18:00" }],
      sun: [],
    });
    const source = { weeklyHours: week, openTime: "10:00", closeTime: "18:00" };
    const afternoon = new Date("2026-11-07T14:00:00.000Z");
    expect(sessionCloseClock(source, "2026-11-07")).toBe("18:00");
    expect(visitShouldExpire({
      status: "WAITING",
      dayKey: "2026-11-05",
      now: afternoon,
      source,
    })).toBe(true);
    expect(visitShouldExpire({
      status: "REQUESTED",
      dayKey: "2026-11-09",
      requestedDate: "2026-11-09",
      now: afternoon,
      source,
    })).toBe(false);
    expect(visitShouldExpire({
      status: "CONFIRMED",
      dayKey: "2026-11-07",
      requestedDate: "2026-11-07",
      now: new Date("2026-11-07T13:30:00.000Z"),
      source,
    })).toBe(true);
  });

  it("row 17: a second request for the same time is refused when there is one chair", async () => {
    resetRateLimits();
    const slug = `slot-${randomBytes(3).toString("hex")}`;
    const tenant = await prisma.tenant.create({
      data: { slug, name: "Slot salon", productQueue: true, openTime: "09:00", closeTime: "21:00" },
    });
    await prisma.queueState.create({
      data: { tenantId: tenant.id, isOpen: true, mode: "REQUEST", units: 1, avgMinutes: 30, unitLabel: "chair" },
    });
    const tomorrow = new Date(Date.now() + 36 * 60 * 60 * 1000);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(tomorrow);
    const first = await joinQueue({
      slug,
      name: "One",
      phone: "9811100101",
      consent: true,
      requestedDate: date,
      requestedSlot: "11:00",
      ip: "203.0.113.40",
      send: async () => ({ ok: true, provider: "log" }),
    });
    expect(first.status).toBe("REQUESTED");
    await expect(joinQueue({
      slug,
      name: "Two",
      phone: "9811100102",
      consent: true,
      requestedDate: date,
      requestedSlot: "11:00",
      ip: "203.0.113.41",
      send: async () => ({ ok: true, provider: "log" }),
    })).rejects.toMatchObject({ code: "FULL" });
    await prisma.queueEntry.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.queueState.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });
});
