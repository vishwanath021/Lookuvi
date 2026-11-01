import { hash } from "bcryptjs";
import { expect, test, type Browser } from "@playwright/test";

const PASSWORD = "MagicLink#2026";
const OWNER_EMAIL = "magic-owner@lookuvi.test";
const SUPER_EMAIL = "magic-super@lookuvi.test";
const SLUG = "magic-link-salon";

async function db() {
  process.env.DATABASE_URL = "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

async function devLink(request: import("@playwright/test").APIRequestContext, email: string) {
  const res = await request.post("/api/v1/auth/magic", { data: { email } });
  expect(res.ok(), await res.text()).toBe(true);
  const body = await res.json() as { devUrl?: string };
  expect(body.devUrl).toBeTruthy();
  const token = new URL(body.devUrl || "").searchParams.get("token");
  expect(token && token.length >= 20).toBeTruthy();
  return `/login?token=${token}`;
}

async function openFresh(browser: Browser, path: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(path);
  return { context, page };
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const prisma = await db();
  const passwordHash = await hash(PASSWORD, 10);
  const tenant = await prisma.tenant.upsert({
    where: { slug: SLUG },
    update: { name: "Magic Link Salon", productQueue: true, status: "TRIAL" },
    create: { slug: SLUG, name: "Magic Link Salon", productQueue: true },
  });
  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: { passwordHash, name: "Magic Owner", isSuperAdmin: false, totpEnabled: false },
    create: { email: OWNER_EMAIL, passwordHash, name: "Magic Owner" },
  });
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: owner.id, tenantId: tenant.id } },
    update: { role: "OWNER" },
    create: { userId: owner.id, tenantId: tenant.id, role: "OWNER" },
  });
  await prisma.user.upsert({
    where: { email: SUPER_EMAIL },
    update: { passwordHash, name: "Magic Super", isSuperAdmin: true, totpEnabled: false },
    create: { email: SUPER_EMAIL, passwordHash, name: "Magic Super", isSuperAdmin: true },
  });
  await prisma.$disconnect();
});

test("a fresh magic link signs the owner in and a super-admin lands on /super", async ({ request, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser is enough for the redirect.");
  const ownerPath = await devLink(request, OWNER_EMAIL);
  const owner = await openFresh(browser, ownerPath);
  await owner.page.waitForURL(/\/admin/);
  await expect(owner.page).not.toHaveURL(/\/login/);
  await owner.context.close();

  const superPath = await devLink(request, SUPER_EMAIL);
  const platform = await openFresh(browser, superPath);
  await platform.page.waitForURL(/\/super/);
  await expect(platform.page.getByRole("heading", { name: "Lookuvi" })).toBeVisible();
  await platform.context.close();
});

test("an invalid, expired, or used magic link shows an error and stays signed out", async ({ page, request, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser is enough for the error states.");

  await page.goto("/login?token=this-token-does-not-exist-0123456789abcdef");
  await expect(page.getByText(/invalid, already used, or has expired/i)).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("link", { name: "Forgot password" })).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);

  const prisma = await db();
  const token = "expired-magic-token-0123456789abcdef0123456789abcdef";
  const { createHash } = await import("node:crypto");
  await prisma.magicLink.create({
    data: {
      email: OWNER_EMAIL,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() - 60_000),
      used: false,
    },
  });
  await prisma.$disconnect();
  const expired = await openFresh(browser, `/login?token=${token}`);
  await expect(expired.page.getByText(/invalid, already used, or has expired/i)).toBeVisible();
  await expired.page.goto("/admin");
  await expect(expired.page).toHaveURL(/\/login/);
  await expired.context.close();

  const usedPath = await devLink(request, OWNER_EMAIL);
  const first = await openFresh(browser, usedPath);
  await first.page.waitForURL(/\/admin/);
  await first.context.close();
  const second = await openFresh(browser, usedPath);
  await expect(second.page.getByText(/invalid, already used, or has expired/i)).toBeVisible();
  await second.page.goto("/admin");
  await expect(second.page).toHaveURL(/\/login/);
  await second.context.close();
});

test("password sign-in still reaches the salon desk", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser is enough for the password path.");
  await page.goto("/login");
  await page.locator("form[data-ready='yes']").waitFor();
  await expect(page.getByText(/invalid, already used, or has expired/i)).toHaveCount(0);
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin/);
});
