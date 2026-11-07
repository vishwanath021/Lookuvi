import { hash } from "bcryptjs";
import { expect, test } from "@playwright/test";
import { kolkataDayKey } from "@/lib/queue/day";

const PASSWORD = "LoyaltyOwner#2026";
const EMAIL = "loyalty-owner@lookuvi.test";
const SLUG = "loyalty-salon";
const PHONE = "9876504411";

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
    update: {
      name: "Loyalty Salon",
      productQueue: true,
      status: "TRIAL",
      deletedAt: null,
      loyaltyOn: true,
      loyaltyPointsPerVisit: 1,
      openTime: "",
      closeTime: "",
      weeklyHours: "",
      hoursOverride: "",
      closedDayKey: "",
    },
    create: { slug: SLUG, name: "Loyalty Salon", productQueue: true, loyaltyOn: true, loyaltyPointsPerVisit: 1 },
  });
  const owner = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, name: "Loyalty Owner", isSuperAdmin: false, totpEnabled: false },
    create: { email: EMAIL, passwordHash, name: "Loyalty Owner" },
  });
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: owner.id, tenantId: tenant.id } },
    update: { role: "OWNER" },
    create: { userId: owner.id, tenantId: tenant.id, role: "OWNER" },
  });
  await prisma.queueState.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, isOpen: true, mode: "LIVE", units: 1, avgMinutes: 20, alertLeadMin: 5, unitLabel: "chair" },
    update: { isOpen: true, mode: "LIVE", units: 1 },
  });
  await prisma.loyaltyLedger.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.loyaltyReward.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.loyaltyReward.create({ data: { tenantId: tenant.id, name: "Free beard trim", cost: 1, sort: 0 } });
  await prisma.queueEntry.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.queueEntry.create({
    data: {
      tenantId: tenant.id,
      dayKey: kolkataDayKey(),
      token: 4,
      name: "Nila",
      phone: `91${PHONE}`,
      status: "WAITING",
      source: "ONLINE",
      cancelToken: "loyalty-nila-token",
    },
  });
  await prisma.$disconnect();
});

test("Finish earns a point and Redeem spends it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser is enough for the points flow.");

  await page.goto("/login");
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin/);

  await page.goto("/admin/queue");
  await page.locator("[data-queue-mode][data-ready='yes']").waitFor();
  await page.locator("[data-call-next='yes']:visible").click();
  await page.getByRole("button", { name: "Seated" }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByText("Nila")).toHaveCount(0);

  await page.goto(`/s/${SLUG}/queue`);
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByLabel("Name", { exact: true }).fill("Nila");
  await page.getByLabel("Mobile number").fill(PHONE);
  await page.getByRole("checkbox", { name: /queue updates/i }).check();
  await page.getByRole("button", { name: "Join the queue" }).click();
  await page.waitForURL(/\/s\/loyalty-salon\/q\//);
  await expect(page.getByText("You have 1 point at Loyalty Salon.")).toBeVisible();

  await page.goto("/admin/queue");
  await page.locator("[data-queue-mode][data-ready='yes']").waitFor();
  await page.getByRole("button", { name: "More actions" }).click();
  await expect(page.locator("[data-points='1']")).toHaveText("Points: 1");
  await page.getByRole("button", { name: "Redeem" }).click();
  await page.getByRole("button", { name: "Confirm redeem" }).click();
  await expect(page.locator("[data-points='0']")).toHaveText("Points: 0");
});
