import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";
import { kolkataDayKey } from "@/lib/queue/day";
import { base32Decode, totp } from "@/lib/totp";
import { PrismaClient } from "@prisma/client";

const ART = "/opt/cursor/artifacts";
const WIDE = "/tmp/qa-wide.jpg";
const FACE = "public/samples/portrait.jpg";
const OWNER = { email: "owner@demo.agenticbuildworks.com", password: "DemoSalon#2026" };

test.use({ viewport: { width: 1280, height: 800 } });
test.describe.configure({ mode: "serial" });

function db() {
  return new PrismaClient();
}

async function shot(page: Page, name: string) {
  await mkdir(ART, { recursive: true });
  await page.screenshot({ path: `${ART}/${name}.png` });
}

async function cspOf(page: Page) {
  return page.evaluate(() => (window as unknown as { __csp?: { directive: string; blocked: string; sample: string }[] }).__csp || []);
}

test.beforeAll(async () => {
  await mkdir(ART, { recursive: true });
  await sharp({
    create: { width: 1200, height: 500, channels: 3, background: { r: 180, g: 40, b: 70 } },
  }).jpeg().toFile(WIDE);
  const prisma = db();
  const tenant = await prisma.tenant.update({
    where: { slug: "demo" },
    data: {
      productBridal: true,
      productTryOn: true,
      productQueue: true,
      loyaltyOn: true,
      loyaltyPointsPerVisit: 1,
      creditBalance: 900,
      anonDailyCap: 80,
      whatsapp: "919800011122",
      tryOnsAtSalon: false,
    },
  });
  await prisma.queueState.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, isOpen: true, mode: "LIVE", units: 2, avgMinutes: 20, alertLeadMin: 5, unitLabel: "chair" },
    update: { isOpen: true, mode: "LIVE", units: 2 },
  });
  await prisma.queueEntry.deleteMany({ where: { tenantId: tenant.id, name: "QA Guest" } });
  await prisma.loyaltyLedger.deleteMany({ where: { tenantId: tenant.id, phone: "919811100199" } });
  await prisma.customer.deleteMany({ where: { tenantId: tenant.id, phone: "919800000177" } });
  await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      phone: "919800000177",
      name: "QA Due Guest",
      visitCount: 2,
      lastVisitAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
      needsReminder: true,
    },
  });
  await prisma.$disconnect();
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const list: { directive: string; blocked: string; sample: string }[] = [];
    (window as unknown as { __csp: typeof list }).__csp = list;
    document.addEventListener("securitypolicyviolation", (event) => {
      list.push({
        directive: event.violatedDirective || event.effectiveDirective,
        blocked: event.blockedURI,
        sample: (event.sample || "").slice(0, 180),
      });
    });
  });
  await page.route(/wa\.me|web\.whatsapp\.com|api\.whatsapp\.com/, (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>wa</title>",
  }));
});

async function openDemo(page: Page, width: number) {
  await page.setViewportSize({ width, height: width < 500 ? 844 : 800 });
  await page.goto("/s/demo");
  await expect(page.getByRole("heading", { level: 1, name: "Demo Salon – Bengaluru" })).toBeVisible();
}

test.afterAll(async () => {
  const prisma = db();
  await prisma.user.updateMany({
    where: { email: OWNER.email },
    data: { totpEnabled: false, totpSecretCipher: "" },
  });
  await prisma.tenant.update({
    where: { slug: "demo" },
    data: { anonDailyCap: 8, loyaltyOn: false, tryOnsAtSalon: false },
  });
  await prisma.$disconnect();
});

test("CSP, crop, zoom, booking, and the regression paths", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser covers 390px and 1280px.");
  test.setTimeout(300_000);
  page.setDefaultTimeout(20_000);

  await openDemo(page, 390);
  await page.waitForTimeout(500);
  const phoneCsp = await cspOf(page);
  const evalHits = phoneCsp.filter((row) => /script-src/.test(row.directive) && /eval/.test(`${row.blocked} ${row.directive} ${row.sample}`));
  expect(evalHits, JSON.stringify(phoneCsp)).toEqual([]);
  const header = await page.request.get("/s/demo");
  const policy = header.headers()["content-security-policy"] || "";
  expect(policy).toContain("script-src");
  expect(policy).not.toMatch(/script-src[^;]*'unsafe-eval'/);
  expect(policy).toContain("'wasm-unsafe-eval'");

  await expect(page.getByRole("button", { name: "Everyday", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bridal", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Everyday", exact: true }).click();
  for (const tab of ["Hair style", "Hair colour", "Brows", "Nails", "Beard"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
  }
  await page.getByRole("tab", { name: "Hair style" }).click();

  await page.locator('input[data-photo="gallery"]').setInputFiles(WIDE);
  const crop = page.getByRole("button", { name: "Crop", exact: true });
  await expect(crop).toBeVisible();
  const beforeSrc = await page.locator('section[aria-label="Photo"] img').first().getAttribute("src");
  await crop.click();
  const dialog = page.locator("[data-crop='open']");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Drag the box to move it")).toBeVisible();
  const handle = dialog.getByRole("button", { name: "Resize crop from the bottom right" });
  const handleBox = await handle.boundingBox();
  expect(handleBox).toBeTruthy();
  if (handleBox) {
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x - 70, handleBox.y - 90, { steps: 8 });
    await page.mouse.up();
  }
  const box = dialog.locator(".crop-box");
  const boxAt = await box.boundingBox();
  expect(boxAt).toBeTruthy();
  if (boxAt) {
    await page.mouse.move(boxAt.x + boxAt.width / 2, boxAt.y + 24);
    await page.mouse.down();
    await page.mouse.move(boxAt.x + boxAt.width / 2 + 36, boxAt.y + 48, { steps: 6 });
    await page.mouse.up();
  }
  await shot(page, "crop-390");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('section[aria-label="Photo"] img').first()).toHaveAttribute("src", beforeSrc || "");

  await crop.click();
  await expect(dialog).toBeVisible();
  const se = dialog.getByRole("button", { name: "Resize crop from the bottom right" });
  const seBox = await se.boundingBox();
  if (seBox) {
    await page.mouse.move(seBox.x + seBox.width / 2, seBox.y + seBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(seBox.x - 80, seBox.y - 100, { steps: 8 });
    await page.mouse.up();
  }
  await dialog.getByRole("button", { name: "Apply crop" }).click();
  await expect(dialog).toHaveCount(0);
  const ratio = await page.locator('section[aria-label="Photo"] img').first().evaluate((img: HTMLImageElement) => img.naturalWidth / img.naturalHeight);
  expect(ratio).toBeGreaterThan(0.72);
  expect(ratio).toBeLessThan(0.78);

  await page.getByRole("button", { name: "Retake" }).click();
  const agree = page.getByRole("button", { name: "I agree, start" });
  if (await agree.isVisible().catch(() => false)) await agree.click();
  await expect(page.locator("[data-studio='live']")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Take photo" }).click();
  await expect(page.locator("[data-studio='live']")).toHaveCount(0, { timeout: 20_000 });

  const wolf = page.getByRole("button", { name: "Wolf Cut" });
  await wolf.scrollIntoViewIfNeeded();
  await wolf.click();
  const tryThis = page.getByRole("button", { name: "Try this look" });
  if (await tryThis.isVisible().catch(() => false)) await tryThis.click();
  await expect(page.getByRole("heading", { name: "Wolf Cut" })).toBeVisible({ timeout: 45_000 });
  const compare = page.getByTestId("before-after");
  await compare.scrollIntoViewIfNeeded();
  const compareBox = await compare.boundingBox();
  expect(compareBox).toBeTruthy();
  if (compareBox) {
    const y = compareBox.y + compareBox.height * 0.45;
    await page.mouse.move(compareBox.x + compareBox.width * 0.2, y);
    await page.mouse.down();
    await page.mouse.move(compareBox.x + compareBox.width * 0.8, y, { steps: 12 });
    await page.mouse.up();
  }
  const split = await page.getByRole("slider", { name: /Before \/ After/i }).getAttribute("aria-valuetext");
  expect(Number((split || "0").replace(/[^\d]/g, ""))).toBeGreaterThan(60);
  await shot(page, "slider-390");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Bridal", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bridal", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sleek low bun" })).toBeVisible();
  await page.getByRole("button", { name: "Haldi", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pellikuthuru Haldi" })).toBeVisible();
  await page.getByRole("button", { name: "Wedding", exact: true }).click();
  const bridalFile = page.locator("[data-photo='bridal']");
  await bridalFile.setInputFiles(WIDE);
  await expect(page.getByRole("img", { name: "Your selfie" })).toBeVisible();
  await page.getByRole("button", { name: "Crop", exact: true }).click();
  await expect(page.locator("[data-crop='open']")).toBeVisible();
  await page.getByRole("button", { name: "Apply crop" }).click();
  await expect(page.locator("[data-crop='open']")).toHaveCount(0);
  const bridalRatio = await page.getByRole("img", { name: "Your selfie" }).evaluate((img: HTMLImageElement) => img.naturalWidth / img.naturalHeight);
  expect(bridalRatio).toBeGreaterThan(0.72);
  expect(bridalRatio).toBeLessThan(0.78);
  await page.getByRole("button", { name: "Try now" }).click();
  await expect(page.getByRole("heading", { name: "Telugu Muhurtham Classic" })).toBeVisible({ timeout: 45_000 });
  await page.reload();
  await page.getByRole("button", { name: "Bridal", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Telugu Muhurtham Classic" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Zoom photo" }).click();
  const zoom = page.locator("[data-zoom='open']");
  await expect(zoom).toBeVisible();
  const zoomBox = await zoom.boundingBox();
  expect(zoomBox).toBeTruthy();
  if (zoomBox) {
    await page.mouse.move(zoomBox.x + zoomBox.width * 0.78, zoomBox.y + zoomBox.height * 0.32);
    await page.mouse.wheel(0, -500);
  }
  await expect.poll(async () => zoom.getAttribute("data-zoom-scale")).not.toBe("1.00");
  const focal = await zoom.locator("img").evaluate((img) => img.getAttribute("style") || "");
  expect(focal).not.toMatch(/translate\(0px,\s*0px\)/);
  if (zoomBox) {
    const start = await zoom.locator("img").evaluate((img) => img.getAttribute("style") || "");
    await page.mouse.move(zoomBox.x + zoomBox.width / 2, zoomBox.y + zoomBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(zoomBox.x + zoomBox.width / 2 - 70, zoomBox.y + zoomBox.height / 2 - 30, { steps: 8 });
    await page.mouse.up();
    const panned = await zoom.locator("img").evaluate((img) => img.getAttribute("style") || "");
    expect(panned).not.toBe(start);
  }
  if (zoomBox) await page.mouse.dblclick(zoomBox.x + zoomBox.width / 2, zoomBox.y + zoomBox.height / 2);
  await expect.poll(async () => zoom.getAttribute("data-zoom-scale")).toBe("1.00");
  await zoom.getByRole("button", { name: "Reset" }).click();
  await zoom.getByRole("button", { name: "Close" }).click();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Zoom photo" }).click();
  const zoomDesk = page.locator("[data-zoom='open']");
  const desk = await zoomDesk.boundingBox();
  if (desk) {
    await page.mouse.move(desk.x + desk.width * 0.72, desk.y + desk.height * 0.35);
    await page.mouse.wheel(0, -400);
    const client = await page.context().newCDPSession(page);
    const cx = desk.x + desk.width * 0.5;
    const cy = desk.y + desk.height * 0.45;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: cx - 40, y: cy }, { x: cx + 40, y: cy }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: cx - 120, y: cy }, { x: cx + 120, y: cy }],
    });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await expect.poll(async () => zoomDesk.getAttribute("data-zoom-scale")).not.toBe("1.00");
  await shot(page, "zoom-1280");
  await zoomDesk.getByRole("button", { name: "Reset" }).click();
  await expect(zoomDesk).toHaveAttribute("data-zoom-scale", "1.00");
  await zoomDesk.getByRole("button", { name: "Close" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Change photo" }).click();
  await page.getByRole("button", { name: "Live capture" }).click();
  if (await agree.isVisible().catch(() => false)) await agree.click();
  const lips = page.getByRole("group", { name: "Live makeup" });
  await expect(lips).toBeVisible({ timeout: 15_000 });
  const canScroll = await lips.evaluate((el) => el.scrollWidth > el.clientWidth + 8);
  expect(canScroll).toBe(true);
  await lips.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  const scrolled = await lips.evaluate((el) => el.scrollLeft > 8);
  expect(scrolled).toBe(true);
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("tab", { name: "My looks" }).click();
  const date = page.getByLabel("Event date");
  await expect(date).toHaveAttribute("min", kolkataDayKey());
  const past = await page.request.post("/api/v1/bridal/book", {
    data: {
      slug: "demo",
      sessionId: "qa-session-01",
      name: "Past Guest",
      eventId: "wedding",
      eventDate: "2026-10-05",
      lookIds: ["telugu-muhurtham"],
    },
  });
  expect(past.status()).toBe(400);
  expect((await past.json()).message).toBe("Choose today or a later date.");

  await page.getByLabel("Your name").fill("QA Bride");
  await date.fill("2026-12-20");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Book bridal trial" }).click();
  const popup = await popupPromise;
  const text = new URL(popup.url()).searchParams.get("text") || "";
  expect(text).toContain("20 December 2026");
  expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  expect(text.match(/https?:\/\//g)).toHaveLength(1);
  await popup.close();
  await expect(page.getByRole("status")).toHaveText("Sent to the Salon on WhatsApp");
  await shot(page, "booking-copy");

  await page.goto("/s/demo/queue");
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByLabel("Name", { exact: true }).fill("QA Guest");
  await page.getByLabel("Mobile number").fill("9811100199");
  await page.getByRole("checkbox", { name: /queue updates/i }).check();
  await page.getByRole("button", { name: "Join the queue" }).click();
  await page.waitForURL(/\/s\/demo\/q\//);
  const ticket = page.url();

  await page.goto("/login");
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin/);
  await page.goto("/admin/queue");
  await page.locator("[data-queue-mode][data-ready='yes']").waitFor();
  await page.locator("[data-call-next='yes']:visible").click();
  await page.getByRole("button", { name: "Seated" }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  await page.goto(ticket);
  await expect(page.getByText(/1 point/)).toBeVisible({ timeout: 20_000 });
  await shot(page, "queue-points");

  await page.goto("/admin/reminders");
  await expect(page.getByRole("heading", { name: "QA Due Guest" })).toBeVisible();

  await page.goto("/admin/security");
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  const secret = (await page.getByText(/type this secret:/).textContent() || "").split("secret:")[1]?.trim() || "";
  expect(secret.length).toBeGreaterThan(10);
  const code = totp(base32Decode(secret));
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Confirm and show recovery codes" }).click();
  await expect(page.getByText("Authenticator is on.")).toBeVisible();
  await page.goto("/login");
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByLabel("Authenticator or recovery code")).toBeVisible();
  await page.getByLabel("Authenticator or recovery code").fill("000000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That authenticator code was not accepted.")).toBeVisible();
  await page.getByLabel("Authenticator or recovery code").fill(totp(base32Decode(secret)));
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin/);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/s/demo");
  await page.waitForTimeout(400);
  const deskCsp = await cspOf(page);
  const deskEval = deskCsp.filter((row) => row.blocked === "eval" || /unsafe-eval/.test(row.sample));
  expect(deskEval, JSON.stringify(deskCsp)).toEqual([]);
});
