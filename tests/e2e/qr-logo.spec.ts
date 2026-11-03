import { expect, test } from "@playwright/test";

const SLUG = "qr-logo-salon";
const LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";

async function db() {
  process.env.DATABASE_URL = "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

test.beforeAll(async () => {
  const prisma = await db();
  await prisma.tenant.upsert({
    where: { slug: SLUG },
    update: { name: "QR Logo Salon", productQueue: true, productTryOn: true, status: "TRIAL", deletedAt: null, logoUrl: LOGO },
    create: { slug: SLUG, name: "QR Logo Salon", productQueue: true, productTryOn: true, logoUrl: LOGO },
  });
  await prisma.$disconnect();
});

test("the printable standee shows the salon logo", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser is enough for the standee.");
  await page.goto(`/s/${SLUG}/qr`);
  await expect(page.getByRole("heading", { name: "QR Logo Salon" })).toBeVisible();
  await expect(page.locator("[data-salon-logo='yes']")).toHaveAttribute("src", LOGO);
  await expect(page.getByText("Join the queue or try a look", { exact: true })).toBeVisible();
});
