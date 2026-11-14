import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { kolkataDayKey } from "../../src/lib/queue/day";

/** Staff marked this browser Arrived at the demo salon. Call before the first navigation. */
export async function arriveDemoGuest(page: Page, slug = "demo") {
  const sessionId = randomUUID();
  const deviceId = randomUUID();
  await page.addInitScript((ids) => {
    sessionStorage.setItem("helix_session", ids.sessionId);
    localStorage.setItem("lookuvi-device", ids.deviceId);
  }, { sessionId, deviceId });
  if (page.url() !== "about:blank") {
    await page.evaluate((ids) => {
      sessionStorage.setItem("helix_session", ids.sessionId);
      localStorage.setItem("lookuvi-device", ids.deviceId);
    }, { sessionId, deviceId });
  }

  process.env.DATABASE_URL ||= "file:./dev.db";
  const prisma = new PrismaClient();
  try {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug }, select: { id: true } });
    const dayKey = kolkataDayKey();
    const now = new Date();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const tokenRow = await prisma.queueEntry.aggregate({ where: { tenantId: tenant.id, dayKey }, _max: { token: true } });
      const token = (tokenRow._max.token || 0) + 1 + attempt;
      try {
        const entry = await prisma.queueEntry.create({
          data: {
            tenantId: tenant.id,
            dayKey,
            token,
            name: "Arrived Guest",
            phone: `9${String(Date.now()).slice(-9)}`,
            status: "WAITING",
            source: "ONLINE",
            cancelToken: randomUUID().replace(/-/g, ""),
            sessionId,
            deviceId,
            consentAt: now,
            arrivedAt: now,
          },
        });
        await prisma.queueSession.create({ data: { entryId: entry.id, sessionId } });
        for (const pair of [
          { kind: "session", value: sessionId },
          { kind: "device", value: deviceId },
        ]) {
          await prisma.salonDayUnlock.upsert({
            where: { tenantId_dayKey_kind_value: { tenantId: tenant.id, dayKey, kind: pair.kind, value: pair.value } },
            create: { tenantId: tenant.id, dayKey, kind: pair.kind, value: pair.value, source: "arrived" },
            update: {},
          });
        }
        break;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  if (page.url().includes(`/s/${slug}`)) await page.reload({ waitUntil: "domcontentloaded" });
}

/** The guest page has seen today's Arrived unlock. */
export async function waitForDemoUnlock(page: Page, slug = "demo") {
  await expect.poll(async () => page.evaluate(async (salon) => {
    const sessionId = sessionStorage.getItem("helix_session") || "";
    const deviceId = localStorage.getItem("lookuvi-device") || "";
    const res = await fetch(`/api/v1/at-salon?slug=${encodeURIComponent(salon)}&sessionId=${encodeURIComponent(sessionId)}&deviceId=${encodeURIComponent(deviceId)}`);
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return Boolean(data?.unlocked);
  }, slug)).toBe(true);
}
