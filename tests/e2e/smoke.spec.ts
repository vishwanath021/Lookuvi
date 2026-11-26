import { createHmac, randomBytes } from "node:crypto";
import { expect, test, type TestInfo } from "@playwright/test";
import { arriveDemoGuest, waitForDemoUnlock } from "./arrive-demo";
import { openLive, waitForCapture } from "./live-entry";
import { safeScreenshot } from "./safe-shot";
import { contrastRatio } from "@/lib/contrast";

function rgbToHex(rgb: string) {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) throw new Error(rgb);
  return `#${match.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`;
}

async function buttonContrast(locator: import("@playwright/test").Locator) {
  const colors = await locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return { color: style.color, background: style.backgroundColor };
  });
  return contrastRatio(rgbToHex(colors.color), rgbToHex(colors.background));
}

async function showEveryStyle(gallery: import("@playwright/test").Locator) {
  for (let step = 0; step < 8; step += 1) {
    const more = gallery.getByRole("button", { name: "Show more" });
    if (await more.count() === 0) return;
    await more.click();
  }
}

function salonModeToken(tenantId: string, nonce: string) {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const body = `${tenantId}.${nonce}.${exp}`;
  const sig = createHmac("sha256", "test-secret-not-for-production-use-32").update(body).digest("base64url");
  return Buffer.from(`${body}.${sig}`).toString("base64url");
}

async function artifact(page: import("@playwright/test").Page, testInfo: TestInfo, name: string) {
  const width = page.viewportSize()?.width ?? 0;
  const device = width >= 768 ? "desktop" : "phone";
  await safeScreenshot(page, testInfo, `${name}-${device}.png`, { fullPage: true });
}

async function salonDb() {
  process.env.DATABASE_URL ||= "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

test.beforeAll(async () => {
  const prisma = await salonDb();
  await prisma.tenant.update({
    where: { slug: "demo" },
    data: { anonDailyCap: 200, requireLoginToBook: false, toolBeard: true, toolNails: true },
  });
  await prisma.$disconnect();
});

test.afterAll(async () => {
  const prisma = await salonDb();
  await prisma.tenant.update({
    where: { slug: "demo" },
    data: { anonDailyCap: 8, memberDailyCap: 30, requireLoginToBook: false },
  });
  await prisma.$disconnect();
});

test("guest home layout and an owner can open the dashboard", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.goto("/s/demo");
  const salonName = page.getByRole("heading", { level: 1, name: "Demo Salon – Bengaluru" });
  await expect(salonName).toBeVisible();
  await expect(salonName).toHaveText("Demo Salon – Bengaluru");
  await expect.poll(() => salonName.evaluate((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)).toBe(false);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  const header = page.locator("header");
  for (const label of ["Book Now", "WhatsApp"]) {
    const box = await header.getByRole("link", { name: label }).boundingBox();
    expect(box).toBeTruthy();
    expect(box && box.x >= 0 && box.x + box.width <= viewportWidth + 1).toBe(true);
  }
  await expect.poll(() => page.evaluate(() => {
    const badge = document.querySelector("nextjs-portal")?.shadowRoot?.querySelector("[data-next-badge]");
    return badge?.getAttribute("data-error") ?? "absent";
  })).not.toBe("true");
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await expect(page.getByText("Demo", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/demo mode/i)).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveCount(5);
  await artifact(page, testInfo, "guest-before");
  await expect(page.getByText(/before we use a photo/i)).toHaveCount(0);
  const photo = page.getByRole("region", { name: "Photo" });
  const frame = photo.locator("div.relative").first();
  await expect(frame).toBeVisible();
  const frameBox = await frame.boundingBox();
  expect((frameBox?.height ?? 0) / (frameBox?.width ?? 1)).toBeGreaterThan(1.15);
  await expect(page.getByRole("checkbox", { name: /photo is used only/i })).toHaveCount(0);
  await expect(photo.getByRole("link", { name: "Details" })).toHaveAttribute("href", "/privacy");
  await expect(photo.getByText("Your photo is used only for this preview.")).toBeVisible();
  const gallery = page.getByRole("region", { name: "Styles" });
  await expect(page.getByRole("button", { name: "Women", exact: true })).toBeVisible();
  await showEveryStyle(gallery);
  await expect(gallery.locator("img")).toHaveCount(25);
  await expect(gallery.getByRole("button", { name: "Soft Bob" })).toBeVisible();

  await page.getByRole("button", { name: "Men", exact: true }).click();
  await showEveryStyle(gallery);
  await expect(gallery.locator("img")).toHaveCount(29);
  await expect(gallery.getByRole("button", { name: "Mid Fade" })).toBeVisible();
  await page.getByRole("button", { name: "Women", exact: true }).click();

  await gallery.getByRole("button", { name: "Soft Bob" }).click();
  await expect(page.getByText("Add your photo first")).toBeVisible();
  await expect(gallery.getByRole("button", { name: "Soft Bob" })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/s/demo/guide");
  await expect(page.getByRole("heading", { name: "Hair-colour ideas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Style ideas" })).toBeVisible();
  await page.locator("[data-ready='yes']").waitFor();
  await page.getByRole("button", { name: "Show ideas" }).first().click();
  await expect(page.getByText(/not a measurement/i)).toBeVisible({ timeout: 20_000 });
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@demo.agenticbuildworks.com");
  await page.getByLabel("Password").fill("DemoSalon#2026");
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible({ timeout: 30_000 });
  await artifact(page, testInfo, "owner-desk");

  await page.goto("/admin/leads");
  await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();

  await page.goto("/admin/billing");
  await expect(page.getByRole("heading", { name: /Plan .* Billing/i })).toBeVisible();
  await expect(page.locator("[data-plan-billing]")).toBeVisible();

  await page.goto("/admin/qr");
  await expect(page.getByRole("heading", { name: /qr and embed/i })).toBeVisible();
});

test("colour, brows, nails, and beard are on the guest page", async ({ page }) => {
  await page.goto("/s/demo");
  await expect(page.getByRole("tab", { name: "Hair style" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Hair colour" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Brows" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Nails" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Beard" })).toBeVisible();
  await page.getByRole("tab", { name: "Hair colour" }).click();
  await expect(page.locator("[data-style-grid='yes'] .look-grid button").first()).toBeVisible();
  await page.getByRole("tab", { name: "Brows" }).click();
  await expect(page.getByRole("region", { name: "Brows" })).toBeVisible();
  await page.getByRole("tab", { name: "Beard" }).click();
  await expect(page.getByRole("region", { name: "Beards" })).toBeVisible();
  await page.getByRole("tab", { name: "Nails" }).click();
  await expect(page.getByRole("region", { name: "Nails" })).toBeVisible();
});

test("camera view can switch to upload without a refresh", async ({ page }) => {
  await page.goto("/s/demo");
  const upload = page.getByRole("button", { name: "Use photo" });
  const take = page.getByRole("button", { name: "Live styling" });
  await expect(upload).toBeVisible();
  expect(await buttonContrast(upload)).toBeGreaterThanOrEqual(4.5);
  expect(await buttonContrast(take)).toBeGreaterThanOrEqual(4.5);

  await openLive(page);
  const instead = page.getByRole("button", { name: "Upload a photo instead" });
  const back = page.getByRole("button", { name: "Back" });
  await expect(page.getByRole("button", { name: "Take photo" })).toBeEnabled();
  await expect(instead).toBeVisible();
  await expect(back).toBeVisible();
  expect(await buttonContrast(instead)).toBeGreaterThanOrEqual(4.5);
  expect(await buttonContrast(back)).toBeGreaterThanOrEqual(4.5);

  await back.click();
  await expect(take).toBeVisible();
  await expect(upload).toBeVisible();
  await expect(page.getByRole("button", { name: "Take photo" })).toHaveCount(0);
  await page.waitForFunction(() => !document.querySelector("video")?.srcObject);

  await take.click();
  await expect(instead).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await instead.click();
  await (await chooser).setFiles("public/samples/portrait.jpg");
  await waitForCapture(page);
  await expect(instead).toHaveCount(0);
  await page.waitForFunction(() => !document.querySelector("video")?.srcObject);
});

test("a near-black salon brand still has readable primary button text", async ({ page }) => {
  const prisma = await salonDb();
  const before = await prisma.tenant.findUniqueOrThrow({ where: { slug: "demo" }, select: { primaryColor: true } });
  await prisma.tenant.update({ where: { slug: "demo" }, data: { primaryColor: "#111111" } });
  try {
    await page.goto("/s/demo");
    const take = page.getByRole("button", { name: "Live styling" });
    await expect(take).toBeVisible();
    expect(await buttonContrast(take)).toBeGreaterThanOrEqual(4.5);
    expect(await buttonContrast(page.getByRole("button", { name: "Use photo" }))).toBeGreaterThanOrEqual(4.5);
  } finally {
    await prisma.tenant.update({ where: { slug: "demo" }, data: { primaryColor: before.primaryColor } });
    await prisma.$disconnect();
  }
});

test("a renamed salon shows on the guest header and title", async ({ page }) => {
  test.setTimeout(120_000);
  const prisma = await salonDb();
  const before = await prisma.tenant.findUniqueOrThrow({ where: { slug: "demo" }, select: { name: true, id: true } });
  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill("owner@demo.agenticbuildworks.com");
    await page.getByLabel("Password").fill("DemoSalon#2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible({ timeout: 30_000 });
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Salon details" }).click();
    await page.getByLabel("Salon name").fill("Indiranagar Studio");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByLabel("Salon name")).toHaveValue("Indiranagar Studio");
    await page.goto("/s/demo");
    await expect(page.getByRole("heading", { level: 1, name: "Indiranagar Studio" })).toBeVisible();
    await expect(page).toHaveTitle(/Indiranagar Studio/, { timeout: 15_000 });
    await page.goto("/admin");
    const signOut = page.getByRole("button", { name: "Sign out", exact: true });
    if (!(await signOut.isVisible())) await page.getByRole("button", { name: "Menu", exact: true }).click();
    await signOut.click();
    await page.waitForURL(/\/login/);

    await page.goto("/login");
    await page.getByLabel("Email").fill("super@agenticbuildworks.com");
    await page.getByLabel("Password").fill("SuperAdmin#2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Lookuvi" })).toBeVisible();
    await page.goto("/super/salons");
    await page.getByRole("row", { name: /demo/ }).click();
    const superName = page.getByLabel("Salon name for demo");
    await superName.fill("Studio Indiranagar");
    await superName.locator("xpath=ancestor::form").getByRole("button", { name: "Save name" }).click();
    await expect(page.locator("main").getByText("Updated.", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.goto("/s/demo");
    await expect(page.getByRole("heading", { level: 1, name: "Studio Indiranagar" })).toBeVisible();
    await expect(page).toHaveTitle(/Studio Indiranagar/, { timeout: 15_000 });
    await page.goto("/s/demo/qr");
    await expect(page.getByRole("heading", { level: 1, name: "Studio Indiranagar" })).toBeVisible();
  } finally {
    await prisma.tenant.update({ where: { id: before.id }, data: { name: before.name } });
    await prisma.$disconnect();
  }
});

test("denied camera offers an upload fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" })),
      },
    });
  });
  await page.goto("/s/demo");
  await openLive(page);
  await expect(page.getByText(/Camera permission was denied/i)).toBeVisible();
  await expect(page.getByText(/address bar/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Use the phone camera" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use photo" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Styles" }).locator("img").first()).toBeVisible();
});

test("anonymous daily cap explains the limit and salon mode lifts it", async ({ page }) => {
  test.setTimeout(180_000);
  const prisma = await salonDb();
  await prisma.tenant.update({ where: { slug: "demo" }, data: { anonDailyCap: 0 } });
  try {
    await arriveDemoGuest(page);
    await page.goto("/s/demo");
    await waitForDemoUnlock(page);
    await expect(page.getByLabel("Password")).toHaveCount(0);
    await page.locator('input[data-photo="gallery"]').setInputFiles("public/samples/portrait.jpg");
    await waitForCapture(page);
    await waitForCapture(page);
    const pixie = page.getByRole("region", { name: "Styles" }).getByRole("button", { name: "Pixie" });
    await expect(pixie).toBeEnabled();
    const capped = page.waitForResponse(
      (res) => res.url().includes("/api/v1/tryon/generate") && res.request().method() === "POST",
      { timeout: 90_000 },
    );
    await pixie.click();
    expect((await capped).status()).toBe(429);
    await expect(page.getByText(/today's previews used up/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Phone code" })).toHaveCount(0);

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "demo" } });
    const nonce = randomBytes(9).toString("base64url");
    await prisma.tenant.update({ where: { id: tenant.id }, data: { salonNonce: nonce } });
    const token = salonModeToken(tenant.id, nonce);
    await page.goto(`/s/demo?salon=${encodeURIComponent(token)}&tool=style`);
    await expect(page.locator("[data-salon-mode='yes']")).toBeVisible();
    await page.locator('input[data-photo="gallery"]').setInputFiles("public/samples/portrait.jpg");
    await page.getByRole("region", { name: "Styles" }).getByRole("button", { name: "Pixie" }).click();
    await expect(page.getByRole("heading", { name: "Pixie" })).toBeVisible({ timeout: 90_000 });
  } finally {
    await prisma.tenant.update({ where: { slug: "demo" }, data: { anonDailyCap: 200 } });
    await prisma.$disconnect();
  }
});

test("booking asks for a phone code only when the salon requires it", async ({ page }) => {
  test.setTimeout(150_000);
  process.env.DATABASE_URL ||= "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  await prisma.tenant.update({ where: { slug: "demo" }, data: { requireLoginToBook: true, anonDailyCap: 40 } });
  try {
    await page.goto("/s/demo/me?book=1&look=French%20Bob");
  await page.getByLabel("Mobile number").fill("9800099111");
    await page.getByRole("button", { name: "Send code" }).click();
    const dev = page.getByTestId("dev-otp");
    await expect(dev).toBeVisible();
    const code = (await dev.innerText()).match(/\d{6}/)?.[0];
    expect(code).toBeTruthy();
    await page.getByRole("textbox", { name: "Code", exact: true }).fill(code || "");
    await page.getByRole("button", { name: "Verify" }).click();
    await page.getByLabel("Your name").fill("Asha Rao");
    await page.getByLabel("Date of birth").fill("1992-04-12");
    await page.getByRole("radio", { name: "Women" }).check();
    await page.getByLabel("Hair length").selectOption("shoulder");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Request a time" })).toBeVisible();
    await page.getByLabel("Preferred date").fill("2026-10-20");
    await page.getByRole("button", { name: "Request a time" }).click();
    await expect(page.getByText("Request sent. The salon will confirm.")).toBeVisible();
    await expect(page.getByText("Pending").first()).toBeVisible();

    await page.goto("/login");
    await page.getByLabel("Email").fill("owner@demo.agenticbuildworks.com");
    await page.getByLabel("Password").fill("DemoSalon#2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin/, { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible({ timeout: 45_000 });
    await page.goto("/admin/bookings");
    await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("Asha Rao")).toBeVisible();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Confirm" }).first().click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(/919800099111/);
    await popup.close();
  } finally {
    await prisma.tenant.update({ where: { slug: "demo" }, data: { requireLoginToBook: false, anonDailyCap: 200 } });
    await prisma.customer.deleteMany({ where: { phone: "919800099111" } });
    await prisma.$disconnect();
  }
});

test("super admin chooses the salon hairstyle model without calling a provider", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill("super@agenticbuildworks.com");
  await page.getByLabel("Password").fill("SuperAdmin#2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Lookuvi" })).toBeVisible();
  await page.goto("/super/ai");
  await expect(page.getByText("In use").first()).toBeVisible();
  await expect(page.getByLabel("Guest hairstyle model").getByText("Meta Muse Image")).toBeVisible();
  await expect(page.getByText("₹3.13")).toBeVisible();
  await artifact(page, testInfo, "super-provider");
  await page.goto("/s/demo");
  await expect(page.getByText("Reference mode")).toHaveCount(0);
  await expect(page.getByText("Hair texture")).toHaveCount(0);
  await expect(page.getByText(/one paid call/i)).toHaveCount(0);
  await page.goto("/super/ai");
  await page.getByRole("button", { name: "Use" }).click();
  await expect(page.getByText("fal is in use.")).toBeVisible();
  await page.getByRole("button", { name: "Use" }).click();
  await expect(page.getByText("OpenAI is in use.")).toBeVisible();
});

test("super admin sees assumed COGS", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("super@agenticbuildworks.com");
  await page.getByLabel("Password").fill("SuperAdmin#2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/assumption/i)).toHaveCount(0);
  await expect(page.getByText("Try-ons this month")).toBeVisible();
  await page.goto("/super/costs");
  await expect(page.getByRole("heading", { name: "Spend & costs" })).toBeVisible();
  await expect(page.getByText("Month spend")).toBeVisible();
  await expect(page.getByText("Average ₹/image")).toBeVisible();
  await page.goto("/super/costs/log");
  await expect(page.getByRole("heading", { name: "Image costs" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sync real cost from fal" })).toHaveCount(0);
});
