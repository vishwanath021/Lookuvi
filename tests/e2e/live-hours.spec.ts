import { expect, test } from "@playwright/test";
import { kolkataClock } from "@/lib/queue/hours";

const SLUG = "live-hours-salon";

function closedPair(now = new Date()) {
  const [hour] = kolkataClock(now).split(":").map(Number);
  const later = (hour + 3) % 24;
  return { open: `${String(later).padStart(2, "0")}:00`, close: `${String(later).padStart(2, "0")}:30` };
}

async function db() {
  process.env.DATABASE_URL = "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

test.beforeAll(async () => {
  const prisma = await db();
  const hours = closedPair();
  const tenant = await prisma.tenant.upsert({
    where: { slug: SLUG },
    update: { name: "Live Hours Salon", productQueue: true, status: "TRIAL", deletedAt: null, openTime: hours.open, closeTime: hours.close },
    create: { slug: SLUG, name: "Live Hours Salon", productQueue: true, openTime: hours.open, closeTime: hours.close },
  });
  await prisma.queueState.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, isOpen: true, mode: "LIVE", units: 1, avgMinutes: 20, alertLeadMin: 5, unitLabel: "chair" },
    update: { isOpen: true, mode: "LIVE" },
  });
  await prisma.queueEntry.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.$disconnect();
});

test("a live join is refused outside the salon's India hours while the desk is open", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser is enough for the hours gate.");
  const hours = closedPair();
  await page.goto(`/s/${SLUG}/queue`);
  await expect(page.getByText(`from ${hours.open} to ${hours.close} India time`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Join the queue" })).toBeDisabled();
  const res = await request.post("/api/v1/queue", {
    data: { slug: SLUG, name: "Late Night", phone: "9876503301", consent: true },
  });
  expect(res.status()).toBe(403);
  expect(await res.json()).toMatchObject({ error: "CLOSED" });
  const prisma = await db();
  expect(await prisma.queueEntry.count({ where: { tenant: { slug: SLUG } } })).toBe(0);
  await prisma.$disconnect();
});
