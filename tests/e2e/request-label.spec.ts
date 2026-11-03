import { expect, test } from "@playwright/test";

const SLUG = "request-label-salon";

async function db() {
  process.env.DATABASE_URL = "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

test.beforeAll(async () => {
  const prisma = await db();
  const tenant = await prisma.tenant.upsert({
    where: { slug: SLUG },
    update: { name: "Request Label Salon", productQueue: true, productTryOn: true, productBridal: false, status: "TRIAL", deletedAt: null, whatsapp: "919800011122" },
    create: { slug: SLUG, name: "Request Label Salon", productQueue: true, productTryOn: true, whatsapp: "919800011122" },
  });
  await prisma.queueState.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, isOpen: true, mode: "REQUEST", units: 1, avgMinutes: 20, alertLeadMin: 5, unitLabel: "chair" },
    update: { isOpen: true, mode: "REQUEST" },
  });
  await prisma.$disconnect();
});

test("request mode says Request a time on the welcome and the try-on", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser is enough for the label.");
  await page.goto(`/s/${SLUG}/welcome`);
  await expect(page.getByRole("link", { name: "Request a time" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Join queue", exact: true })).toHaveCount(0);
  await page.goto(`/s/${SLUG}`);
  await expect(page.locator("[data-salon-actions='yes']").getByRole("link", { name: "Request a time" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Join queue", exact: true })).toHaveCount(0);
});
