import { hash } from "bcryptjs";
import { expect, test } from "@playwright/test";

const EMAIL = "models-super@lookuvi.test";
const PASSWORD = "ModelsSuper#2026";

async function db() {
  process.env.DATABASE_URL = "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

test.beforeAll(async () => {
  const prisma = await db();
  const passwordHash = await hash(PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, name: "Models Super", isSuperAdmin: true, totpEnabled: false },
    create: { email: EMAIL, passwordHash, name: "Models Super", isSuperAdmin: true },
  });
  await prisma.platformSetting.deleteMany({ where: { key: { in: ["guest_hairstyle_model", "guest_hairstyle_engine"] } } });
  await prisma.$disconnect();
});

test.afterAll(async () => {
  const prisma = await db();
  await prisma.platformSetting.deleteMany({ where: { key: { in: ["guest_hairstyle_model", "guest_hairstyle_engine"] } } });
  await prisma.$disconnect();
});

test("super-admin can select a guest fal model and the fal key field stays on the page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser is enough for the model dropdown.");
  await page.goto("/login");
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/super/);
  await page.goto("/super/ai");
  await expect(page.getByLabel("fal key")).toBeVisible();
  const model = page.getByLabel("Guest hairstyle model");
  await expect(model).toHaveValue("gpt-image-2.5-sunburst");
  await expect(model.locator("option")).toHaveCount(7);
  const saved = page.waitForResponse((res) => res.url().includes("/api/v1/super/ai") && res.request().method() === "PUT");
  await model.selectOption("meta/muse-image/edit");
  expect((await saved).ok()).toBeTruthy();
  await expect(page.getByRole("status").filter({ hasText: "meta/muse-image/edit is in use." })).toBeVisible();
  const prisma = await db();
  expect((await prisma.platformSetting.findUnique({ where: { key: "guest_hairstyle_model" } }))?.value).toBe("meta/muse-image/edit");
  await prisma.$disconnect();
});
