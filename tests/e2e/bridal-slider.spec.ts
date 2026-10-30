import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const SHOTS = "/workspace/bridal-slider";
const FACE = "public/samples/portrait.jpg";

async function shot(page: Page, name: string) {
  await mkdir(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function openBridalResult(page: Page) {
  await page.goto("/s/demo");
  await page.getByRole("button", { name: "Bridal", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bridal", exact: true })).toBeVisible();
  const selfie = page.locator("#bridal-selfie");
  await selfie.locator("[data-photo='bridal']").setInputFiles(FACE);
  await expect(selfie.getByRole("img", { name: "Your selfie" })).toBeVisible();
  await selfie.getByRole("button", { name: "Try now" }).click();
  await expect(selfie.getByTestId("before-after")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-bridal='flow']")).toHaveAttribute("data-busy", "no");
  return selfie;
}

async function rangeValue(scope: ReturnType<Page["locator"]>) {
  const text = await scope.getByRole("slider", { name: /Before \/ After/i }).getAttribute("aria-valuetext");
  return Number((text || "0").replace(/[^\d]/g, ""));
}

async function clearCompare(page: Page, compare: ReturnType<Page["locator"]>) {
  await compare.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
  await page.waitForTimeout(200);
}

async function assertBarStacked(selfie: ReturnType<Page["locator"]>) {
  const save = selfie.getByRole("button", { name: "Save this look" });
  const another = selfie.getByRole("button", { name: "Try another look" });
  const counter = selfie.locator("[data-try-count='yes']");
  await expect(save).toBeVisible();
  await expect(another).toBeVisible();
  await expect(counter).toBeVisible();
  const saveBox = await save.boundingBox();
  const anotherBox = await another.boundingBox();
  const counterBox = await counter.boundingBox();
  expect(saveBox && anotherBox && counterBox).toBeTruthy();
  if (!saveBox || !anotherBox || !counterBox) return;
  expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(counterBox.y + 2);
  expect(counterBox.y + counterBox.height).toBeLessThanOrEqual(anotherBox.y + 2);
}

test.describe("bridal before/after slider", () => {
  test("dragging the compare handle and range moves the split (375px)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "android", "Mobile bridal layout check");
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 375, height: 812 });
    const selfie = await openBridalResult(page);
    const compare = selfie.getByTestId("before-after");
    const range = selfie.getByRole("slider", { name: /Before \/ After/i });
    await expect(range).toBeVisible();
    await expect(selfie.getByRole("button", { name: "Zoom photo" })).toBeVisible();
    await clearCompare(page, compare);

    const before = await rangeValue(selfie);
    expect(before).toBeGreaterThan(0);

    const box = await compare.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    // Click left side of the portrait — Zoom chip must not intercept.
    await compare.click({ position: { x: Math.round(box.width * 0.22), y: Math.round(box.height * 0.4) } });
    const afterClick = await rangeValue(selfie);
    expect(afterClick).toBeLessThan(40);

    // Drag the split rightward with the mouse / pointer path.
    await page.mouse.move(box.x + box.width * 0.22, box.y + box.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.78, box.y + box.height * 0.4, { steps: 14 });
    await page.mouse.up();
    const afterDrag = await rangeValue(selfie);
    expect(afterDrag).toBeGreaterThan(60);

    await range.fill("35");
    await expect(range).toHaveAttribute("aria-valuetext", /35/);

    await assertBarStacked(selfie);
    await shot(page, "bridal-result-375");
  });

  test("compare drag and sticky bar layout on desktop", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop bridal layout check");
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    const selfie = await openBridalResult(page);
    const compare = selfie.getByTestId("before-after");
    const range = selfie.getByRole("slider", { name: /Before \/ After/i });
    await clearCompare(page, compare);

    const box = await compare.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    await compare.click({ position: { x: Math.round(box.width * 0.8), y: Math.round(box.height * 0.4) } });
    expect(await rangeValue(selfie)).toBeGreaterThan(60);

    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.4, { steps: 14 });
    await page.mouse.up();
    expect(await rangeValue(selfie)).toBeLessThan(40);

    await range.focus();
    await range.press("End");
    expect(await rangeValue(selfie)).toBe(96);

    await assertBarStacked(selfie);
    await shot(page, "bridal-result-desktop");
  });
});
