import { mkdirSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";

const base = process.env.QA_BASE || "http://127.0.0.1:3000";
const out = "docs/product-guide/screenshots";
mkdirSync(out, { recursive: true });

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(name);
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.locator("input[type=email]").fill(email);
  await page.locator("input[type=password]").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(admin|super)/, { timeout: 20000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const guest = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await guest.goto(`${base}/login`, { waitUntil: "networkidle" });
  await shot(guest, "login");
  await guest.goto(`${base}/s/demo`, { waitUntil: "networkidle" });
  await guest.waitForTimeout(1500);
  await shot(guest, "guest-tryon");
  await guest.goto(`${base}/s/demo/queue`, { waitUntil: "networkidle" });
  await shot(guest, "guest-queue");
  await guest.goto(`${base}/s/demo/welcome`, { waitUntil: "networkidle" });
  await shot(guest, "guest-welcome");
  await guest.goto(`${base}/privacy`, { waitUntil: "networkidle" });
  await shot(guest, "privacy");
  await guest.setViewportSize({ width: 390, height: 844 });
  await guest.goto(`${base}/s/demo/queue`, { waitUntil: "networkidle" });
  await shot(guest, "guest-queue-phone");
  await guest.close();

  const owner = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await signIn(owner, "owner@demo.agenticbuildworks.com", "DemoSalon#2026");
  await owner.waitForTimeout(800);
  await shot(owner, "owner-queue");
  for (const [path, name] of [
    ["/admin/customers", "owner-customers"],
    ["/admin/leads", "owner-leads"],
    ["/admin/settings", "owner-settings"],
    ["/admin/styles", "owner-styles"],
    ["/admin/services", "owner-services"],
    ["/admin/qr", "owner-qr"],
    ["/admin/billing", "owner-billing"],
  ] as const) {
    await owner.goto(`${base}${path}`, { waitUntil: "networkidle" });
    await owner.waitForTimeout(600);
    await shot(owner, name);
  }
  await owner.close();

  const staff = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await signIn(staff, "staff@demo.agenticbuildworks.com", "DemoStaff#2026");
  await staff.waitForTimeout(800);
  await shot(staff, "staff-queue");
  await staff.close();

  const admin = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await signIn(admin, "super@agenticbuildworks.com", "SuperAdmin#2026");
  await admin.waitForTimeout(800);
  await shot(admin, "super-overview");
  for (const [path, name] of [
    ["/super/salons", "super-salons"],
    ["/super/ai", "super-ai"],
    ["/super/costs", "super-costs"],
  ] as const) {
    await admin.goto(`${base}${path}`, { waitUntil: "networkidle" });
    await admin.waitForTimeout(700);
    await shot(admin, name);
  }
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
