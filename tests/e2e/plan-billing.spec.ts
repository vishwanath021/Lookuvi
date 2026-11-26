import { test, expect } from "@playwright/test";

test("owner Plan & Billing page shows salon plan block", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@demo.agenticbuildworks.com");
  await page.getByLabel("Password").fill("DemoSalon#2026");
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin/, { timeout: 60_000 });
  await page.goto("/admin/billing");
  await expect(page.getByRole("heading", { name: /Plan .* Billing/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-plan-billing]")).toBeVisible();
  await expect(page.getByText(/Salon plan/i)).toBeVisible();
});