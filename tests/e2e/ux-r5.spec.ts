import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { openLive } from "./live-entry";

const OUT = "/opt/cursor/artifacts/ux-r5";

async function salonDb() {
  process.env.DATABASE_URL ||= "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

test("stepper, swatches, and no preview before Try now", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "this test sets 360 and 1280 itself");
  test.setTimeout(180_000);
  await mkdir(OUT, { recursive: true });
  const posts: string[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && /\/api\/v1\/(tryon\/generate|groom|bridal\/own)/.test(req.url())) posts.push(req.url());
  });
  const prisma = await salonDb();
  await prisma.tenant.update({
    where: { slug: "demo" },
    data: { productBridal: true, productGroom: true, productTryOn: true, creditBalance: 900 },
  });
  await prisma.$disconnect();

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/s/demo");
  await page.getByRole("button", { name: "Bridal", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bridal", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Bridal steps" })).toBeVisible();
  await expect(page.getByRole("button", { name: "1. The event" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try now" })).toBeDisabled();
  await expect(page.locator("[data-swatch='makeup']").first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/bridal-360.png` });
  await page.locator("[data-step='makeup']").screenshot({ path: `${OUT}/bridal-360-makeup.png` });

  await page.locator("[data-photo='bridal']").setInputFiles("public/samples/portrait.jpg");
  await expect(page.getByRole("img", { name: "Your selfie" })).toBeVisible();
  await page.waitForTimeout(600);
  expect(posts).toEqual([]);
  await expect(page.getByRole("button", { name: "Try now" })).toBeEnabled();
  await page.locator("[data-photo-box='face']").screenshot({ path: `${OUT}/bridal-360-photo.png` });

  await openLive(page, "Live makeup");
  const tray = page.locator("[data-live-tray='yes']");
  await expect(tray).toBeVisible();
  const frame = await page.locator("[data-photo-box='face']").boundingBox();
  const shutter = await tray.locator(".cam-shutter").boundingBox();
  expect(frame && shutter && shutter.y >= frame.y + frame.height - 2).toBeTruthy();
  expect(frame && shutter && shutter.x >= frame.x - 4).toBeTruthy();
  await page.screenshot({ path: `${OUT}/bridal-360-live.png` });
  expect(posts).toEqual([]);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: `${OUT}/bridal-1280.png` });

  await page.getByRole("button", { name: "Groom", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Groom", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Groom steps" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try now" }).first()).toBeDisabled();
  await page.screenshot({ path: `${OUT}/groom-1280.png` });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.locator("[data-photo-box='face']").scrollIntoViewIfNeeded();
  const groomFrame = await page.locator("[data-photo-box='face']").boundingBox();
  expect(groomFrame && groomFrame.width).toBeGreaterThan(280);
  expect(groomFrame && groomFrame.width / groomFrame.height).toBeGreaterThan(0.7);
  await page.screenshot({ path: `${OUT}/groom-360.png` });
  expect(posts).toEqual([]);
});

test("a choice change after the result does not call the preview", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one viewport is enough");
  test.setTimeout(120_000);
  await shotGuard(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/s/demo");
  await page.getByRole("button", { name: "Bridal", exact: true }).click();
  await page.locator("[data-photo='bridal']").setInputFiles("public/samples/portrait.jpg");
  await page.getByRole("button", { name: "Try now" }).click();
  await expect(page.getByRole("heading", { name: "Telugu Muhurtham Classic" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Change something to try again" })).toBeDisabled();
  const calls: string[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().includes("/api/v1/tryon/generate")) calls.push(req.url());
  });
  await page.getByRole("button", { name: "Nude glow", exact: true }).click();
  await page.waitForTimeout(500);
  expect(calls).toEqual([]);
  await expect(page.getByRole("button", { name: "Try now" })).toBeEnabled();
  await page.getByRole("button", { name: "Try now" }).click();
  await expect(page.locator("[data-bridal='flow']")).toHaveAttribute("data-busy", "yes");
});

async function shotGuard(page: Page) {
  const prisma = await salonDb();
  await prisma.tenant.update({
    where: { slug: "demo" },
    data: { productBridal: true, productTryOn: true, creditBalance: 900 },
  });
  await prisma.$disconnect();
}
