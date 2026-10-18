import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { openLive } from "./live-entry";

const OUT = "/opt/cursor/artifacts/ux-r4";

async function shot(page: Page, name: string) {
  await mkdir(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
}

test("bridal photo step, chips, one scrollbar, and live fps", async ({ page }, testInfo) => {
  test.skip(!["android", "desktop"].includes(testInfo.project.name), "phone and laptop only");
  test.setTimeout(180_000);
  const label = testInfo.project.name === "android" ? "phone" : "laptop";
  await mkdir(OUT, { recursive: true });
  await page.goto("/s/demo");
  await page.getByRole("button", { name: "Bridal", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bridal", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bridal", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Makeup style" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Bridal looks style" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Hair style" })).toHaveCount(0);
  const makeup = page.getByRole("list", { name: "Makeup" });
  await expect(makeup.locator("img")).toHaveCount(0);
  await expect(makeup.getByRole("button", { name: "Soft rose" })).toBeVisible();
  await expect(makeup.getByRole("button", { name: "Nude glow" })).toBeVisible();
  await makeup.screenshot({ path: `${OUT}/after-${label}-makeup.png` });

  const cluster = page.locator("[data-photo-cluster='yes']");
  const slot = page.locator("[data-photo-box='face']");
  await slot.scrollIntoViewIfNeeded();
  await expect(slot.getByText("Face the light. No sunglasses.")).toBeVisible();
  const live = page.getByRole("button", { name: "Live capture", exact: true });
  const upload = page.getByRole("button", { name: "Upload", exact: true });
  await live.scrollIntoViewIfNeeded();
  await expect(live).toBeInViewport();
  await expect(upload).toBeInViewport();
  const box = await slot.boundingBox();
  expect(box && box.height).toBeGreaterThan(280);
  expect(box && box.width / box.height).toBeGreaterThan(0.7);
  expect(box && box.width / box.height).toBeLessThan(0.85);
  const gradient = await slot.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(gradient).toContain("gradient");
  await cluster.screenshot({ path: `${OUT}/after-${label}-photo.png` });

  const scroll = await page.evaluate(() => {
    const inner = document.querySelector("[data-scroll='salon']") as HTMLElement | null;
    const style = inner ? getComputedStyle(inner).overflowY : "";
    return {
      overflowY: style,
      innerScrolls: Boolean(inner && style !== "visible" && inner.scrollHeight > inner.clientHeight + 8),
      windowScrolls: document.documentElement.scrollHeight > window.innerHeight + 8,
      headerTop: Math.round((document.querySelector("header")?.getBoundingClientRect().top ?? 99)),
    };
  });
  expect(scroll.overflowY).toBe("visible");
  expect(scroll.innerScrolls).toBe(false);
  expect(scroll.windowScrolls).toBe(true);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(await page.locator("header").evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(0);
  await page.screenshot({ path: `${OUT}/after-${label}-scrolled.png` });

  await openLive(page, "Live capture");
  const canvas = page.locator("[data-makeup='live']");
  await expect(canvas).toHaveAttribute("data-makeup-state", "tracking", { timeout: 60_000 });
  await expect(canvas).toHaveAttribute("data-mode", "video");
  await expect(canvas).toHaveAttribute("data-callback", "video-frame");
  await expect.poll(async () => Number(await canvas.getAttribute("data-fps")), { timeout: 15_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1_500);
  const fps = Number(await canvas.getAttribute("data-fps"));
  const edge = await canvas.getAttribute("data-edge");
  const detectMs = await canvas.getAttribute("data-detect-ms");
  await writeFile(`${OUT}/fps-${label}.json`, JSON.stringify({
    fps,
    edge,
    detectMs,
    mode: "video",
    callback: "video-frame",
    note: "The Playwright camera file is 480x640 at 8 fps, so the measured rate cannot exceed that. A 30 fps camera keeps this same per-frame loop.",
  }, null, 2));
  await page.screenshot({ path: `${OUT}/after-${label}-live.png` });
  expect(fps).toBeGreaterThan(0);
  expect(Number(edge)).toBeLessThanOrEqual(480);
});
