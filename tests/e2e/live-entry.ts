import { expect, type Page } from "@playwright/test";

/** The photo sheet shows once per browser session, before the camera opens. */
export async function agreeIfAsked(page: Page) {
  const sheet = page.getByRole("dialog", { name: "Before we use a photo" });
  const legacy = page.getByRole("button", { name: "I agree, start" });
  const camera = page.getByRole("button", { name: "Take photo" });
  const which = await Promise.race([
    sheet.waitFor({ state: "visible", timeout: 8_000 }).then(() => "sheet" as const),
    legacy.waitFor({ state: "visible", timeout: 8_000 }).then(() => "legacy" as const),
    camera.waitFor({ state: "visible", timeout: 8_000 }).then(() => "camera" as const),
  ]).catch(() => "none" as const);
  if (which === "legacy") {
    await legacy.click();
    return;
  }
  if (which === "sheet") {
    await page.getByRole("checkbox", { name: /18 or older/ }).check();
    await page.getByRole("button", { name: /I agree/ }).click();
  }
}

export async function openLive(page: Page, name = "Live styling") {
  await page.getByRole("button", { name, exact: true }).click();
  await agreeIfAsked(page);
}

/** The live camera has its own Retake control. A finished capture is the studio closing. */
export async function waitForCapture(page: Page) {
  await expect(page.locator("[data-studio='live']")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retake" })).toBeVisible();
}
