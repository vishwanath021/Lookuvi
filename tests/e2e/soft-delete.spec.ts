import { hash } from "bcryptjs";
import { expect, test } from "@playwright/test";

const PASSWORD = "DeleteSuper#2026";
const EMAIL = "delete-super@lookuvi.test";
const SLUG = "delete-me-salon";
const NAME = "Delete Me Salon";

async function db() {
  process.env.DATABASE_URL = "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const prisma = await db();
  const passwordHash = await hash(PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, name: "Delete Super", isSuperAdmin: true, totpEnabled: false },
    create: { email: EMAIL, passwordHash, name: "Delete Super", isSuperAdmin: true },
  });
  await prisma.tenant.upsert({
    where: { slug: SLUG },
    update: { name: NAME, status: "TRIAL", deletedAt: null, productQueue: true },
    create: { slug: SLUG, name: NAME, productQueue: true },
  });
  await prisma.$disconnect();
});

test("super-admin confirm-delete hides the salon and the guest link is not found", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser is enough for delete and the guest 404.");

  await page.goto("/login");
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/super/);

  await page.goto("/super/salons");
  await page.getByLabel("Search salons").fill(SLUG);
  await expect(page.getByRole("link", { name: SLUG })).toBeVisible();
  await page.getByRole("button", { name: `Actions for ${SLUG}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete salon" });
  await expect(dialog.getByText(/not suspend/i)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Delete salon" })).toBeDisabled();
  await dialog.getByLabel("Type the salon link to confirm").fill(SLUG);
  await dialog.getByRole("button", { name: "Delete salon" }).click();
  await expect(page.locator("main").getByText("Guest links now return not found")).toBeVisible();
  await expect(page.getByRole("link", { name: SLUG })).toHaveCount(0);

  await page.goto(`/s/${SLUG}`);
  await expect(page.getByRole("heading", { name: "That page is not here." })).toBeVisible();

  const prisma = await db();
  const kept = await prisma.tenant.findMany({ where: { slug: SLUG } });
  expect(kept).toHaveLength(1);
  expect(kept[0]?.deletedAt).toBeTruthy();
  expect(kept[0]?.status).not.toBe("SUSPENDED");
  await prisma.$disconnect();
});
