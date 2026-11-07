import { hash } from "bcryptjs";
import { expect, test } from "@playwright/test";

const PASSWORD = "DueVisit#2026";
const EMAIL = "due-visit-owner@lookuvi.test";
const SLUG = "due-visit-salon";
const DAY = 24 * 60 * 60 * 1000;

async function db() {
  process.env.DATABASE_URL = "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

async function seed() {
  const prisma = await db();
  const passwordHash = await hash(PASSWORD, 10);
  const tenant = await prisma.tenant.upsert({
    where: { slug: SLUG },
    update: {
      name: "Due Visit Salon",
      productQueue: true,
      status: "TRIAL",
      deletedAt: null,
      onboardingDone: true,
      reminderDays: 42,
      reminderMethod: "MANUAL",
      reminderTemplate: "",
      loyaltyOn: true,
    },
    create: {
      slug: SLUG,
      name: "Due Visit Salon",
      productQueue: true,
      onboardingDone: true,
      reminderDays: 42,
      reminderMethod: "MANUAL",
      loyaltyOn: true,
    },
  });
  const owner = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, name: "Due Owner", isSuperAdmin: false, totpEnabled: false },
    create: { email: EMAIL, passwordHash, name: "Due Owner" },
  });
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: owner.id, tenantId: tenant.id } },
    update: { role: "OWNER" },
    create: { userId: owner.id, tenantId: tenant.id, role: "OWNER" },
  });
  await prisma.visitReminder.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.loyaltyLedger.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.customer.deleteMany({ where: { tenantId: tenant.id } });
  const now = Date.now();
  await prisma.customer.createMany({
    data: [
      { tenantId: tenant.id, phone: "919800000101", name: "Sample One", visitCount: 2, lastVisitAt: new Date(now - 60 * DAY), needsReminder: true },
      { tenantId: tenant.id, phone: "919800000102", name: "Sample Two", visitCount: 1, lastVisitAt: new Date(now - 50 * DAY), needsReminder: true },
      { tenantId: tenant.id, phone: "919800000103", name: "Sample Recent", visitCount: 1, lastVisitAt: new Date(now - 3 * DAY), needsReminder: true },
    ],
  });
  await prisma.loyaltyLedger.create({
    data: { tenantId: tenant.id, phone: "919800000101", delta: 4, kind: "adjust", reason: "seed", balanceAfter: 4 },
  });
  await prisma.$disconnect();
}

test.describe.configure({ mode: "serial" });
test.beforeEach(seed);

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin/);
}

test("desktop queue sends, skips, and shows the finish counts", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop queue.");
  await page.context().route(/web\.whatsapp\.com|wa\.me/, (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "ok" }));
  await signIn(page);
  await page.getByRole("link", { name: "Due for a visit" }).click();
  await page.locator("[data-due-board][data-ready='yes']").waitFor();
  await expect(page.getByRole("heading", { name: "Due for a visit" })).toBeVisible();
  await expect(page.getByText("Customers who haven't come back in 6 weeks.")).toBeVisible();
  await expect(page.getByText("Sample Recent")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Sample One" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sample Two" })).toBeVisible();

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("checkbox", { name: "Select all" }).check();
  await page.getByRole("button", { name: "Start sending (2)" }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/web\.whatsapp\.com\/send\?phone=919800000101/);
  await expect(popup).toHaveURL(/You%20have%204%20points/);
  await expect(page.getByText("Customer 1 of 2")).toBeVisible();
  await expect(page.locator("[data-message-preview]")).toContainText("You have 4 points.");
  await expect(page.getByText("Press Enter in WhatsApp to send, then click Sent, next.")).toBeVisible();

  await page.getByRole("button", { name: "Sent, next" }).click();
  await expect(page.getByRole("status")).toContainText("Marked as reminded.");
  await expect(popup).toHaveURL(/phone=919800000102/);
  await expect(page.getByText("Customer 2 of 2")).toBeVisible();
  await expect(page.locator("[data-message-preview]")).not.toContainText("points");

  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.locator("[data-send-done]")).toHaveText("Sent 1. Skipped 1.");
  await expect(page.getByRole("heading", { name: "Sample One" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Sample Two" })).toBeVisible();
  await popup.close();
});

test("mobile one tap marks the customer and undo puts them back", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "android", "Mobile one tap.");
  await page.context().route(/web\.whatsapp\.com|wa\.me/, (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "ok" }));
  await signIn(page);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("link", { name: "Due for a visit" }).click();
  await page.locator("[data-due-board][data-ready='yes']").waitFor();
  await expect(page.getByText("Sample Recent")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start sending (0)" })).toHaveCount(0);

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Send on WhatsApp" }).first().click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/wa\.me\/919800000101\?text=/);
  await expect(page.getByRole("status")).toContainText("Marked as reminded.");
  await expect(page.getByRole("heading", { name: "Sample One" })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status")).toContainText("Undone");
  await expect(page.getByRole("heading", { name: "Sample One" })).toBeVisible();
  await popup.close();
});
