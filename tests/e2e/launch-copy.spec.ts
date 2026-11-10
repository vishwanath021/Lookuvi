import { hash } from "bcryptjs";
import { expect, test } from "@playwright/test";

const SLUG = "copy-salon";
const EMAIL = "copy-owner@lookuvi.test";
const PASSWORD = "CopyOwner#2026";

async function db() {
  process.env.DATABASE_URL = "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

test.beforeAll(async () => {
  const prisma = await db();
  const passwordHash = await hash(PASSWORD, 10);
  const tenant = await prisma.tenant.upsert({
    where: { slug: SLUG },
    update: { name: "Copy Salon", productQueue: true, productBridal: true, status: "TRIAL", deletedAt: null },
    create: { slug: SLUG, name: "Copy Salon", productQueue: true, productBridal: true },
  });
  const owner = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, name: "Copy Owner", isSuperAdmin: false, totpEnabled: false },
    create: { email: EMAIL, passwordHash, name: "Copy Owner" },
  });
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: owner.id, tenantId: tenant.id } },
    update: { role: "OWNER" },
    create: { userId: owner.id, tenantId: tenant.id, role: "OWNER" },
  });
  await prisma.queueState.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, isOpen: true, mode: "LIVE", units: 1, avgMinutes: 20, alertLeadMin: 5, unitLabel: "chair" },
    update: { isOpen: true, mode: "LIVE" },
  });
  await prisma.queueEntry.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.$disconnect();
});

test("visit-code help is on settings and the ninth join names the hourly cap", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser is enough for the copy.");
  await page.goto("/login");
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin/);
  await page.goto("/admin/settings");
  await expect(page.getByText("Guest short code from the try-on limit screen")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Import customers" })).toBeVisible();

  const deviceId = "copy-salon-device-1";
  for (let i = 0; i < 8; i += 1) {
    const res = await request.post("/api/v1/queue", {
      data: { slug: SLUG, name: `Guest ${i}`, phone: `9876506${String(i).padStart(3, "0")}`, consent: true, deviceId },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  }
  const blocked = await request.post("/api/v1/queue", {
    data: { slug: SLUG, name: "Guest over", phone: "9876506999", consent: true, deviceId },
  });
  expect(blocked.status()).toBe(429);
  expect(await blocked.json()).toMatchObject({ error: "RATE", message: expect.stringContaining("not about free chairs") });
});
