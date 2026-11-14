import { expect, test } from "@playwright/test";

async function db() {
  process.env.DATABASE_URL = "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const prisma = await db();
  const tenant = await prisma.tenant.upsert({
    where: { slug: "family-phone" },
    update: { name: "Family Phone Salon", productQueue: true, status: "TRIAL", deletedAt: null },
    create: { slug: "family-phone", name: "Family Phone Salon", productQueue: true },
  });
  await prisma.queueState.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, isOpen: true, mode: "LIVE", units: 1, avgMinutes: 20, alertLeadMin: 5, unitLabel: "chair" },
    update: { isOpen: true, mode: "LIVE" },
  });
  await prisma.queueEntry.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.$disconnect();
});

test("a second name on the same phone is told which token already exists", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser is enough for the token message.");
  await page.goto("/s/family-phone/queue");
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByLabel("Name", { exact: true }).fill("Mom");
  await page.getByLabel("Mobile number").fill("9876501881");
  await page.getByRole("checkbox", { name: /queue updates/i }).check();
  const joined: { statusPath?: string } = {};
  let joinStatus = 0;
  await page.route("**/api/v1/queue", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const upstream = await route.fetch();
    const text = await upstream.text();
    joinStatus = upstream.status();
    Object.assign(joined, JSON.parse(text));
    await route.fulfill({ response: upstream, body: text });
  });
  await page.getByRole("button", { name: "Join the queue" }).click();
  await expect.poll(() => joinStatus).toBeGreaterThan(0);
  expect(joinStatus).toBeLessThan(400);
  await expect(async () => {
    if (!joined.statusPath || new URL(page.url()).pathname !== joined.statusPath) {
      await page.goto(joined.statusPath!, { waitUntil: "domcontentloaded" });
    }
    await expect(page.locator("[data-status='WAITING'][data-ready='yes']")).toBeVisible();
  }).toPass();
  const token = await page.locator("[data-queue-token]").getAttribute("data-queue-token");

  await page.goto("/s/family-phone/queue");
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByLabel("Name", { exact: true }).fill("Dad");
  await page.getByLabel("Mobile number").fill("9876501881");
  await page.getByRole("checkbox", { name: /queue updates/i }).check();
  await page.getByRole("button", { name: "Join the queue" }).click();
  await expect(page.getByRole("status")).toContainText(`This number already has token ${String(token).padStart(2, "0")} for Mom.`);
  await expect(page.getByRole("link", { name: "Open that token" })).toBeVisible();
  await expect(page).toHaveURL(/\/queue$/);

  const prisma = await db();
  const rows = await prisma.queueEntry.findMany({ where: { tenant: { slug: "family-phone" }, phone: "919876501881" } });
  expect(rows).toHaveLength(1);
  expect(rows[0]?.name).toBe("Mom");
  await prisma.$disconnect();
});
