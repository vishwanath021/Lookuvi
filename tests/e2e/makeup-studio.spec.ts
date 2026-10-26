import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const SHOTS = "/opt/cursor/artifacts/makeup-studio";
const PORTRAIT = "tests/fixtures/portraits/woman-pink.jpg";
const NO_FACE = "tests/fixtures/faces/no-face.jpg";

async function salonDb() {
  process.env.DATABASE_URL ||= "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

async function shot(page: Page, name: string) {
  await mkdir(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

test.afterEach(async () => {
  const prisma = await salonDb();
  await prisma.tenant.update({
    where: { slug: "demo" },
    data: { productMakeupStudio: false, productTryOn: true, productBridal: true },
  }).catch(() => undefined);
  await prisma.$disconnect();
});

test("makeup section stays hidden until the salon switch is on", async ({ page }) => {
  const prisma = await salonDb();
  await prisma.tenant.update({ where: { slug: "demo" }, data: { productMakeupStudio: false, productTryOn: true, productBridal: true } });
  await prisma.$disconnect();
  await page.goto("/s/demo");
  await expect(page.getByRole("button", { name: "Everyday", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Makeup", exact: true })).toHaveCount(0);
  if (test.info().project.name === "android") await shot(page, "01-switch-off");

  const on = await salonDb();
  await on.tenant.update({ where: { slug: "demo" }, data: { productMakeupStudio: true } });
  await on.$disconnect();
  await page.goto("/s/demo");
  await expect(page.getByRole("button", { name: "Bridal", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Makeup", exact: true }).click();
  await expect(page.locator("[data-makeup-studio='on']")).toBeVisible();
  await expect(page.getByRole("button", { name: "Take photo" }).first()).toBeVisible();
  if (test.info().project.name === "android") await shot(page, "02-switch-on-empty");
  await page.getByRole("button", { name: "Everyday", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Hair style" })).toBeVisible();
});

test("a photo is painted on the device and photoreal stays a sample", async ({ page }) => {
  test.setTimeout(180_000);
  const prisma = await salonDb();
  await prisma.tenant.update({ where: { slug: "demo" }, data: { productMakeupStudio: true, productTryOn: true, creditBalance: 0 } });
  await prisma.$disconnect();
  await page.goto("/s/demo");
  await page.getByRole("button", { name: "Makeup", exact: true }).click();
  await page.locator("[data-makeup-upload]").setInputFiles(PORTRAIT);
  await expect(page.locator("[data-makeup-status='ready']")).toBeVisible({ timeout: 90_000 });
  const canvas = page.locator("[data-makeup-canvas]");
  await expect(canvas).toBeVisible();
  const engine = await canvas.getAttribute("data-render-engine");
  expect(engine === "webgl2" || engine === "canvas2d").toBe(true);
  const first = await canvas.getAttribute("data-render-id");
  const digest = () => canvas.evaluate((node) => {
    const url = (node as HTMLCanvasElement).toDataURL();
    let hash = 0;
    for (let i = 0; i < url.length; i += 64) hash = (hash * 33 + url.charCodeAt(i)) >>> 0;
    return hash;
  });
  const before = await digest();
  expect(before).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Look: Glam" }).click();
  await expect.poll(async () => canvas.getAttribute("data-render-id")).not.toBe(first);
  const after = await digest();
  expect(after).not.toBe(before);

  const project = test.info().project.name;
  if (project === "android" || project === "desktop") {
    const prefix = project === "desktop" ? "desktop" : "mobile";
    await shot(page, `${prefix}-glam`);
    await canvas.screenshot({ path: `${SHOTS}/${prefix}-glam-face.png` });
    for (const name of ["Bridal", "Reception", "Party", "Natural", "Editorial", "Telugu bridal"]) {
      const id = name.toLowerCase().replace(/\s+/g, "-");
      const seen = await canvas.getAttribute("data-render-id");
      await page.getByRole("button", { name: `Look: ${name}` }).click();
      await expect.poll(async () => canvas.getAttribute("data-render-id"), { timeout: 10_000 }).not.toBe(seen);
      if (project === "android") {
        await shot(page, `look-${id}`);
        await canvas.screenshot({ path: `${SHOTS}/face-${id}.png` });
      }
    }
    if (project === "android") {
      const frame = page.locator("[data-makeup-canvas]");
      const box = await frame.boundingBox();
      if (box) {
        await page.mouse.move(box.x + 8, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
        await page.mouse.up();
      }
      await shot(page, "split");
      await page.getByRole("slider", { name: "Foundation" }).fill("90");
      await page.getByRole("slider", { name: "Blush" }).fill("80");
      await page.getByRole("button", { name: "Finish Matte" }).click();
      await page.getByRole("button", { name: "Quality High" }).click();
      await page.waitForTimeout(200);
      await shot(page, "controls-high");
    }
  }

  await page.getByRole("button", { name: /Photoreal/ }).click();
  const agree = page.getByRole("button", { name: "I agree, start" });
  if (await agree.isVisible().catch(() => false)) await agree.click();
  await expect(page.locator("[data-makeup-result='sample']")).toBeVisible({ timeout: 60_000 });
  if (project === "android") await shot(page, "photoreal-sample");

  await page.locator("[data-makeup-upload]").setInputFiles(NO_FACE);
  await expect(page.locator("[data-makeup-note]").filter({ visible: true })).toHaveText("No face in that photo.", { timeout: 90_000 });
  if (project === "android") await shot(page, "no-face");
});
