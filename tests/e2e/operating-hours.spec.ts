import { hash } from "bcryptjs";
import { expect, test } from "@playwright/test";

const PASSWORD = "HoursOwner#2026";
const EMAIL = "hours-owner@lookuvi.test";
const SLUG = "hours-salon";

async function db() {
  process.env.DATABASE_URL = "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const prisma = await db();
  const passwordHash = await hash(PASSWORD, 10);
  const tenant = await prisma.tenant.upsert({
    where: { slug: SLUG },
    update: { name: "Hours Salon", productQueue: true, openTime: "", closeTime: "", status: "TRIAL" },
    create: { slug: SLUG, name: "Hours Salon", productQueue: true },
  });
  const owner = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, name: "Hours Owner", isSuperAdmin: false, totpEnabled: false },
    create: { email: EMAIL, passwordHash, name: "Hours Owner" },
  });
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: owner.id, tenantId: tenant.id } },
    update: { role: "OWNER" },
    create: { userId: owner.id, tenantId: tenant.id, role: "OWNER" },
  });
  await prisma.queueState.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, isOpen: true, mode: "REQUEST", units: 1, avgMinutes: 20, alertLeadMin: 5, unitLabel: "chair" },
    update: { isOpen: true, mode: "REQUEST" },
  });
  await prisma.queueEntry.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.$disconnect();
});

test("owner hours limit request joins and clearing them restores 06:00–22:00", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser is enough for the hours flow.");

  await page.goto("/login");
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin/);

  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("textbox", { name: "Opens", exact: true }).fill("10:00");
  await page.getByRole("textbox", { name: "Closes", exact: true }).fill("18:00");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();

  await page.goto(`/s/${SLUG}/queue`);
  await page.locator("form[data-ready='yes']").waitFor();
  const time = page.getByLabel("Preferred time");
  await expect(time).toHaveAttribute("min", "10:00");
  await expect(time).toHaveAttribute("max", "18:00");
  await time.evaluate((input: HTMLInputElement) => {
    input.min = "00:00";
    input.max = "23:59";
  });
  await page.getByLabel("Name", { exact: true }).fill("Early Guest");
  await page.getByLabel("Mobile number").fill("9876501711");
  await page.getByLabel("Preferred date").fill("2099-06-15");
  await time.fill("09:00");
  await page.getByRole("checkbox", { name: /queue updates/i }).check();
  await page.getByRole("button", { name: "Request a time" }).click();
  await expect(page.getByText("Choose a time between 10:00 and 18:00.")).toBeVisible();

  await page.getByLabel("Mobile number").fill("9876501712");
  await time.fill("11:00");
  await page.getByRole("button", { name: "Request a time" }).click();
  await expect(page.locator("[data-status='REQUESTED'][data-ready='yes']")).toBeVisible();

  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "Clear hours" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();

  await page.goto(`/s/${SLUG}/queue`);
  await page.locator("form[data-ready='yes']").waitFor();
  await expect(page.getByLabel("Preferred time")).toHaveAttribute("min", "06:00");
  await page.getByLabel("Name", { exact: true }).fill("Dawn Guest");
  await page.getByLabel("Mobile number").fill("9876501713");
  await page.getByLabel("Preferred date").fill("2099-06-16");
  await page.getByLabel("Preferred time").fill("07:00");
  await page.getByRole("checkbox", { name: /queue updates/i }).check();
  await page.getByRole("button", { name: "Request a time" }).click();
  await expect(page.locator("[data-status='REQUESTED'][data-ready='yes']")).toBeVisible();
});
