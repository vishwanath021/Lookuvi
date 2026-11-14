import { expect, test, type Page } from "@playwright/test";

const FACE = "tests/fixtures/live/woman-long-dark.jpg";
const OWNER = { email: "owner@demo.agenticbuildworks.com", password: "DemoSalon#2026" };

async function salonDb() {
  process.env.DATABASE_URL ||= "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

async function signIn(page: Page) {
  await page.goto("/login");
  const csrf = await page.request.get("/api/auth/csrf");
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const signed = await page.request.post("/api/auth/callback/credentials", {
    form: { csrfToken, email: OWNER.email, password: OWNER.password, callbackUrl: "/admin" },
    maxRedirects: 0,
  });
  if (!signed.ok() && signed.status() >= 400) throw new Error(`Sign-in failed (${signed.status()})`);
  await page.goto("/admin/queue");
  await expect(page.getByRole("heading", { name: "Queue" })).toBeVisible();
}

async function visit(page: Page, href: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(href, { waitUntil: "domcontentloaded" });
    } catch {
      /* WebKit can report a same-page load interrupting the new navigation. */
    }
    if (page.url().includes(href)) return;
  }
  await page.goto(href, { waitUntil: "domcontentloaded" });
}

async function expectFixedNav(page: Page) {
  const nav = page.locator("[data-guest-nav='yes']");
  await expect(nav).toBeVisible();
  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  const before = await nav.boundingBox();
  expect(before).toBeTruthy();
  expect(Math.abs(before!.y + before!.height - viewport!.height)).toBeLessThan(6);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const after = await nav.boundingBox();
  expect(after).toBeTruthy();
  expect(Math.abs(after!.y + after!.height - viewport!.height)).toBeLessThan(6);
  expect(Math.abs(before!.y - after!.y)).toBeLessThan(4);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(wide).toBeLessThan(2);
  await page.evaluate(() => window.scrollTo(0, 0));
}

let hoursBackup: { hoursOverride: string; hoursOverrideUntil: Date | null; closedDayKey: string | null } | null = null;

test.beforeAll(async () => {
  const prisma = await salonDb();
  const current = await prisma.tenant.findUniqueOrThrow({
    where: { slug: "demo" },
    select: { hoursOverride: true, hoursOverrideUntil: true, closedDayKey: true },
  });
  hoursBackup = current;
  const tenant = await prisma.tenant.update({
    where: { slug: "demo" },
    data: {
      productQueue: true,
      productTryOn: true,
      productBridal: true,
      tryOnsAtSalon: false,
      hoursOverride: "open",
      hoursOverrideUntil: new Date(Date.now() + 3 * 60 * 60 * 1000),
      closedDayKey: "",
    },
  });
  await prisma.queueState.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, isOpen: true, mode: "LIVE", units: 1, avgMinutes: 20, alertLeadMin: 5, unitLabel: "chair" },
    update: { isOpen: true, mode: "LIVE" },
  });
  await prisma.$disconnect();
});

test.afterAll(async () => {
  if (!hoursBackup) return;
  const prisma = await salonDb();
  await prisma.tenant.update({
    where: { slug: "demo" },
    data: {
      tryOnsAtSalon: false,
      hoursOverride: hoursBackup.hoursOverride,
      hoursOverrideUntil: hoursBackup.hoursOverrideUntil,
      closedDayKey: hoursBackup.closedDayKey,
    },
  });
  await prisma.$disconnect();
});

test("guest header, audience, filters, and fixed nav", async ({ page }) => {
  await page.goto("/s/demo");
  await expect(page.getByRole("link", { name: "Get Token" })).toBeVisible();
  const book = page.getByRole("link", { name: "Book Now" });
  const chat = page.getByRole("link", { name: "WhatsApp" });
  await expect(book).toBeVisible();
  await expect(chat).toBeVisible();
  expect(decodeURIComponent((await chat.getAttribute("href")) || "")).toContain("I'd like to know more / book an appointment.");
  expect((await book.getAttribute("href")) || "").toContain("text=");
  await expect(page.getByRole("button", { name: "Women", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Men", exact: true }).click();
  await expect(page.getByRole("button", { name: "Men", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Kids", exact: true }).click();
  await expect(page.getByRole("button", { name: "Kids", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Women", exact: true }).click();
  const filters = page.getByRole("button", { name: "Filters" });
  await expect(filters).toBeVisible();
  await filters.click();
  const dialog = page.getByRole("dialog", { name: "Filters" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Get AI suggestions" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await expectFixedNav(page);
});

test("services stay in English and the saved tab keeps the nav", async ({ page }) => {
  await page.goto("/s/demo/services");
  await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Services" })).toHaveAttribute("aria-current", "page");
  await expectFixedNav(page);
  await visit(page, "/s/demo/saved");
  await expectFixedNav(page);
  await visit(page, "/s/demo/queue");
  await expectFixedNav(page);
});

test("bridal steps sit above the photo and looks are real images", async ({ page }) => {
  await page.goto("/s/demo");
  await page.getByRole("button", { name: "Bridal", exact: true }).click();
  const steps = page.locator("#bridal-steps");
  const photo = page.locator("#bridal-selfie");
  await expect(steps).toBeVisible();
  await expect(photo).toBeVisible();
  if ((page.viewportSize()?.width || 0) < 800) {
    const stepsBox = await steps.boundingBox();
    const photoBox = await photo.boundingBox();
    expect(stepsBox && photoBox && stepsBox.y < photoBox.y).toBeTruthy();
  }
  await page.getByRole("button", { name: "Engagement", exact: true }).click();
  const pastel = page.locator("img[src='/bridal/telugu-engagement-pastel.webp']");
  await pastel.scrollIntoViewIfNeeded();
  await expect(pastel).toBeVisible();
  await expect.poll(() => pastel.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(200);
  await page.getByRole("button", { name: "Mehendi", exact: true }).click();
  const festive = page.locator("img[src='/bridal/telugu-mehendi-festive.webp']");
  await festive.scrollIntoViewIfNeeded();
  await expect(festive).toBeVisible();
  await expect.poll(() => festive.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(200);
});

test("a guest can join the queue", async ({ page }) => {
  const phone = `9${String(Date.now()).slice(-9)}`;
  await page.goto("/s/demo/queue");
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByLabel("Name", { exact: true }).fill("Regression Guest");
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("checkbox", { name: /queue updates/i }).check();
  await page.getByRole("button", { name: "Join the queue" }).click();
  const ticket = page.locator("[data-status='WAITING'][data-ready='yes']");
  const back = page.getByRole("link", { name: "See your place in line" });
  await expect(ticket.or(back)).toBeVisible({ timeout: 20_000 });
  if (!(await ticket.isVisible())) await back.click();
  await expect(ticket).toBeVisible();
  await expectFixedNav(page);
});

test("generate, compare, save, and download without a second try", async ({ page }) => {
  test.setTimeout(120_000);
  let generates = 0;
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().includes("/api/v1/tryon/generate")) generates += 1;
  });
  await page.goto("/s/demo");
  await page.locator("[data-photo='gallery']").setInputFiles(FACE);
  await expect(page.locator("section[aria-label='Photo'] img")).toBeVisible();
  const card = page.locator("[data-style-grid='yes'] .look-grid button").first();
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");
  const tryLook = page.getByRole("button", { name: "Try this look" });
  if (await page.getByText("Reading your face shape").isVisible()) {
    await expect(page.getByTestId("before-after")).toBeVisible({ timeout: 60_000 });
  } else {
    await expect(tryLook).toBeEnabled();
    await tryLook.click();
  }
  await expect(page.getByTestId("before-after")).toBeVisible({ timeout: 60_000 });
  await page.locator("[data-save-result='yes']").click();
  await expect(page.getByText("Saved to your looks")).toBeVisible();
  await page.evaluate(() => {
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    nav.canShare = () => true;
    nav.share = async (data: ShareData) => {
      (window as unknown as { sharedName?: string }).sharedName = data.files?.[0]?.name || "";
    };
  });
  const download = page.waitForEvent("download", { timeout: 5_000 }).catch(() => null);
  await page.getByRole("button", { name: "Download" }).click();
  const file = await download;
  if (file) expect(file.suggestedFilename()).toMatch(/\.jpg$/);
  else await expect.poll(() => page.evaluate(() => (window as unknown as { sharedName?: string }).sharedName || "")).toMatch(/\.jpg$/);
  await expect(page.getByRole("button", { name: "Done – pick another style" })).toBeDisabled();
  expect(generates).toBe(1);
  await page.locator("[data-style-grid='yes'] .look-grid button").nth(1).click();
  await expect(page.getByRole("button", { name: "Try this look" })).toBeEnabled();
  await page.getByRole("tab", { name: "Hair colour" }).click();
  await page.locator("[data-style-grid='yes'] .look-grid button").first().click();
  await page.getByRole("button", { name: "Try this look" }).click();
  await expect(page.getByTestId("before-after")).toBeVisible({ timeout: 60_000 });
  expect(generates).toBe(2);
});

test("a locked try-on shows the teaser and does not generate", async ({ page }) => {
  const prisma = await salonDb();
  await prisma.tenant.update({ where: { slug: "demo" }, data: { tryOnsAtSalon: true } });
  await prisma.$disconnect();
  try {
    let generates = 0;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/v1/tryon/generate")) generates += 1;
    });
    await page.goto("/s/demo");
    await page.locator("[data-style-grid='yes'] .look-grid button").first().click();
    await page.getByRole("button", { name: "Try this look" }).click();
    await expect(page.locator("[data-unlock-sheet='yes']")).toContainText("Your free AI preview unlocks when you reach the salon.");
    expect(generates).toBe(0);
  } finally {
    const restore = await salonDb();
    await restore.tenant.update({ where: { slug: "demo" }, data: { tryOnsAtSalon: false } });
    await restore.$disconnect();
  }
});

test("a queued guest cannot generate until staff mark Arrived", async ({ page }) => {
  test.setTimeout(120_000);
  const prisma = await salonDb();
  await prisma.tenant.update({ where: { slug: "demo" }, data: { tryOnsAtSalon: true } });
  await prisma.$disconnect();
  try {
    let generates = 0;
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/api\/v1\/(tryon\/generate|bridal\/own|groom|makeup-studio\/render)/.test(req.url())) generates += 1;
    });
    const phone = `9${String(Date.now()).slice(-9)}`;
    const guestName = `Lock ${phone.slice(-4)}`;
    await page.goto("/s/demo/queue");
    await page.locator("form[data-ready='yes']").waitFor();
    await page.getByLabel("Name", { exact: true }).fill(guestName);
    await page.getByLabel("Mobile number").fill(phone);
    await page.getByRole("checkbox", { name: /queue updates/i }).check();
    await page.getByRole("button", { name: "Join the queue" }).click();
    const ticket = page.locator("[data-status='WAITING'][data-ready='yes']");
    const back = page.getByRole("link", { name: "See your place in line" });
    await expect(ticket.or(back)).toBeVisible({ timeout: 20_000 });
    if (!(await ticket.isVisible())) await back.click();
    await expect(ticket).toBeVisible();
    await visit(page, "/s/demo");
    const card = page.locator("[data-style-grid='yes'] .look-grid button").first();
    await expect(card).toBeVisible();
    await expect(async () => {
      await card.click();
      await expect(card).toHaveAttribute("aria-pressed", "true");
    }).toPass();
    await page.getByRole("button", { name: "Try this look" }).click();
    await expect(page.locator("[data-unlock-sheet='yes']")).toContainText("Your free AI preview unlocks when you reach the salon.");
    await page.locator("[data-unlock-sheet='yes']").locator("xpath=..").click({ position: { x: 8, y: 8 } });
    await expect(page.locator("[data-unlock-sheet='yes']")).toBeHidden();
    await page.getByRole("tab", { name: "Hair colour" }).click();
    await page.locator("[data-style-grid='yes'] .look-grid button").first().click();
    await expect(page.locator("[data-unlock-sheet='yes']")).toBeVisible();
    await page.locator("[data-unlock-sheet='yes']").locator("xpath=..").click({ position: { x: 8, y: 8 } });
    await page.getByRole("button", { name: "Bridal", exact: true }).click();
    await page.getByRole("button", { name: "Try now" }).first().click();
    await expect(page.locator("[data-unlock-sheet='yes']")).toBeVisible();
    expect(generates).toBe(0);

    await signIn(page);
    const row = page.locator("[data-queue-row]").filter({ hasText: guestName }).first();
    await row.getByRole("button", { name: "Arrived", exact: true }).click();
    await expect(row.getByText("Arrived ✓")).toBeVisible();
    await page.goto("/s/demo");
    await page.locator("[data-photo='gallery']").setInputFiles(FACE);
    await page.locator("[data-style-grid='yes'] .look-grid button").first().click();
    await page.getByRole("button", { name: "Try this look" }).click();
    await expect(page.getByTestId("before-after")).toBeVisible({ timeout: 60_000 });
    expect(generates).toBe(1);
  } finally {
    const restore = await salonDb();
    await restore.tenant.update({ where: { slug: "demo" }, data: { tryOnsAtSalon: false } });
    await restore.$disconnect();
  }
});

test("removing a saved look takes the card off the list", async ({ page }) => {
  await page.goto("/s/demo");
  await page.evaluate(() => {
    localStorage.setItem("lookuvi-saved:demo", JSON.stringify([{ tool: "style", id: "soft-bob", name: "Soft Bob" }]));
  });
  await page.goto("/s/demo/saved");
  await expect(page.getByText("Soft Bob")).toBeVisible();
  await page.getByRole("button", { name: "Remove this look" }).click();
  await expect(page.getByText("Soft Bob")).toHaveCount(0);
  await expect(page.locator(".is-removed")).toHaveCount(0);
});

test("owner queue, settings, and leads", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/queue");
  const pending = page.locator("[data-queue-row]").filter({ hasText: "Regression Guest" }).filter({ has: page.getByRole("button", { name: "Arrived", exact: true }) });
  if (await pending.count()) await pending.first().getByRole("button", { name: "Arrived", exact: true }).click();
  await expect(page.locator("[data-queue-row]").filter({ hasText: "Regression Guest" }).getByText("Arrived ✓").first()).toBeVisible();
  const chairs = await page.getByRole("region", { name: "Chairs" }).boundingBox();
  const waiting = await page.getByRole("region", { name: "Waiting" }).boundingBox();
  expect(chairs && waiting).toBeTruthy();
  if ((page.viewportSize()?.width || 0) >= 768) {
    expect(chairs!.x + chairs!.width).toBeLessThanOrEqual(waiting!.x + 4);
    expect(chairs!.width).toBeLessThan((await page.locator(".queue-floor").boundingBox())!.width * 0.5);
  } else {
    expect(waiting!.y).toBeLessThan(chairs!.y);
  }
  const icon = page.locator(".queue-icon svg").first();
  if (await icon.count()) {
    const box = await icon.boundingBox();
    if (box) expect(Math.round(box.width)).toBe(22);
  }
  await page.goto("/admin/settings", { waitUntil: "networkidle" });
  if ((page.viewportSize()?.width || 0) < 800) {
    const details = page.getByRole("button", { name: "Salon details" });
    await details.click();
    if ((await details.getAttribute("aria-current")) !== "page") await details.click();
    await expect(details).toHaveAttribute("aria-current", "page");
  }
  await expect(page.getByRole("heading", { name: "Salon details" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Opening hours" })).toBeVisible();
  await visit(page, "/admin/leads");
  await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
  const empty = page.getByText("No booking taps yet");
  if (await empty.count()) {
    await expect(empty).toBeVisible();
  } else if ((page.viewportSize()?.width || 0) < 800) {
    await expect(page.locator("article.card").first()).toBeVisible();
  } else {
    await expect(page.locator("table")).toBeVisible();
  }
});
