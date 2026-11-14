import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { expect, test } from "@playwright/test";
import { arriveDemoGuest, waitForDemoUnlock } from "./arrive-demo";

test.use({ viewport: { width: 375, height: 812 } });

const OUT = "/opt/cursor/artifacts/gen-ux-r2";
const FACE = "tests/fixtures/live/woman-long-dark.jpg";

test("the bridal photo shows the loading sweep, then a crossfade", async ({ page }) => {
  test.setTimeout(120_000);
  await mkdir(OUT, { recursive: true });
  const reveal = await sharp(FACE).modulate({ saturation: 1.08, brightness: 1.02 }).jpeg({ quality: 90 }).toBuffer();
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/tryon/generate", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await gate;
    await route.fulfill({
      status: 200,
      contentType: "image/jpeg",
      body: reveal,
    });
  });

  await page.clock.install();
  await arriveDemoGuest(page);
  await page.goto("/s/demo");
  await waitForDemoUnlock(page);
  await page.getByRole("button", { name: "Bridal", exact: true }).click();
  await page.locator("[data-photo='bridal']").setInputFiles(FACE);
  await expect(page.getByRole("img", { name: "Your selfie" })).toBeVisible();
  await page.getByRole("button", { name: "Try now" }).click();
  const box = page.locator("#bridal-selfie [data-photo-box='face']");
  const veil = page.locator("[data-generating='yes']");
  await expect(veil).toBeVisible();
  await expect(page.getByRole("button", { name: "Almost ready..." })).toHaveCount(0);
  await expect(page.getByText("Almost ready...")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Live capture" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use photo" })).toHaveCount(0);
  await expect(veil).toHaveAttribute("data-stage", "Reading your face shape…");
  const photo = await box.boundingBox();
  const bar = await box.locator(".gen-bar").boundingBox();
  const stage = box.locator(".gen-stage");
  const stageBox = await stage.boundingBox();
  expect(photo && bar && stageBox).toBeTruthy();
  expect(bar!.y).toBeGreaterThan(photo!.y + photo!.height * 0.7);
  expect(bar!.width).toBeGreaterThan(80);
  const ink = await stage.evaluate((el) => getComputedStyle(el).color);
  expect(ink).toBe("rgb(41, 35, 48)");
  await box.screenshot({ path: `${OUT}/loading-1.png` });

  await page.clock.fastForward(7_000);
  await expect(veil).toHaveAttribute("data-stage", "Styling your hair…");
  await box.screenshot({ path: `${OUT}/loading-2.png` });

  await page.clock.fastForward(8_000);
  await expect(veil).toHaveAttribute("data-stage", "Adding final touches…");
  await box.screenshot({ path: `${OUT}/loading-3.png` });

  release?.();
  await expect(page.getByRole("heading", { name: "Telugu Muhurtham Classic" })).toBeVisible();
  await expect(veil).toHaveCount(0);
  await expect(box.locator("img.gen-reveal")).toBeVisible();
  await box.screenshot({ path: `${OUT}/reveal.png` });
});
