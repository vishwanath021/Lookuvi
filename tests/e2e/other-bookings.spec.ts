import { expect, test } from "@playwright/test";

async function db() {
  process.env.DATABASE_URL = "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

async function join(page: import("@playwright/test").Page, name: string, phone: string) {
  await page.goto("/s/other-bookings/queue");
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("checkbox", { name: /queue updates/i }).check();
  await page.getByRole("button", { name: "Join the queue" }).click();
  await expect(page.locator("[data-status='WAITING'][data-ready='yes']")).toBeVisible();
}

test.beforeAll(async () => {
  const prisma = await db();
  const tenant = await prisma.tenant.upsert({
    where: { slug: "other-bookings" },
    update: { name: "Other Bookings Salon", productQueue: true, status: "TRIAL", deletedAt: null },
    create: { slug: "other-bookings", name: "Other Bookings Salon", productQueue: true },
  });
  await prisma.queueState.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, isOpen: true, mode: "LIVE", units: 1, avgMinutes: 20, alertLeadMin: 5, unitLabel: "chair" },
    update: { isOpen: true, mode: "LIVE" },
  });
  await prisma.queueEntry.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.$disconnect();
});

test("the latest ticket links back to the earlier booking on this phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser is enough for the booking list.");
  await join(page, "Priya", "9876502101");
  await expect(page.getByRole("heading", { name: "Other bookings", exact: true })).toHaveCount(0);
  await join(page, "Asha", "9876502102");
  await expect(page.getByRole("heading", { name: "Other bookings", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Priya" })).toBeVisible();
  await page.getByRole("link", { name: "Priya" }).click();
  await expect(page.locator("[data-status='WAITING']")).toBeVisible();
  await expect(page.getByRole("link", { name: "Asha" })).toBeVisible();
});
