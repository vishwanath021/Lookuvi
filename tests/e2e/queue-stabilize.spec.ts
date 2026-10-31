import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"], input[name="email"]', "owner@demo.agenticbuildworks.com");
  await page.fill('input[type="password"], input[name="password"]', "DemoSalon#2026");
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin/);
}

async function cookieHeader(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function admin(request: APIRequestContext, cookie: string, body?: Record<string, unknown>) {
  if (!body) {
    const res = await request.get(`${BASE}/api/v1/admin/queue`, { headers: { cookie } });
    return { status: res.status(), data: await res.json() };
  }
  const res = await request.post(`${BASE}/api/v1/admin/queue`, {
    data: body,
    headers: { cookie, "content-type": "application/json" },
  });
  return { status: res.status(), data: await res.json() };
}

async function clearLine(request: APIRequestContext, cookie: string) {
  await admin(request, cookie, { action: "settings", units: 2, avgMinutes: 30, alertLeadMin: 5, mode: "LIVE", unitLabel: "chair" });
  const desk = await admin(request, cookie);
  for (const s of desk.data.serving || []) {
    if (s.entry) await admin(request, cookie, { action: "noshow", id: s.entry.id });
  }
  for (const w of desk.data.waiting || []) {
    await admin(request, cookie, { action: "noshow", id: w.id });
  }
}

async function join(request: APIRequestContext, name: string, phone: string, extra: Record<string, unknown> = {}) {
  const res = await request.post(`${BASE}/api/v1/queue`, {
    data: { slug: "demo", name, phone, consent: true, deviceId: `e2e-${phone}-${Date.now()}`, ...extra },
  });
  const data = await res.json();
  return { status: res.status(), data };
}

test.describe("queue stabilize regressions", () => {
  test("ticket CTAs follow start, no-show, and done", async ({ page, request }) => {
    await login(page);
    const cookie = await cookieHeader(page);
    await clearLine(request, cookie);

    const { data: t } = await join(request, "StabA", "9876511001");
    await request.post(`${BASE}/api/v1/queue/visit`, { data: { slug: "demo", ref: t.ref, action: "way" } });
    await page.goto(`${BASE}/s/demo/q/${t.ref}`);
    await expect(page.locator("[data-status]")).toHaveAttribute("data-status", "WAITING");
    await expect(page.locator("[data-queue-coming]")).toBeVisible();
    await expect(page.locator("[data-queue-try]")).toBeVisible();

    const next = await admin(request, cookie, { action: "next" });
    const entry = (next.data.serving || []).find((s: { entry?: { token: number; id: string } }) => s.entry?.token === t.token)?.entry;
    expect(entry?.id).toBeTruthy();
    await admin(request, cookie, { action: "start", id: entry.id });
    await page.reload();
    await expect(page.locator("[data-status]")).toHaveAttribute("data-status", "IN_SERVICE");
    await expect(page.getByText("You are being served")).toBeVisible();
    await expect(page.locator("[data-queue-coming]")).toHaveCount(0);
    await expect(page.locator("[data-queue-try]")).toHaveCount(0);

    const { data: t2 } = await join(request, "StabB", "9876511002");
    await request.post(`${BASE}/api/v1/queue/visit`, { data: { slug: "demo", ref: t2.ref, action: "way" } });
    const desk = await admin(request, cookie);
    const waiting = (desk.data.waiting || []).find((w: { token: number }) => w.token === t2.token);
    await admin(request, cookie, { action: "noshow", id: waiting.id });
    await page.goto(`${BASE}/s/demo/q/${t2.ref}`);
    await expect(page.locator("[data-status]")).toHaveAttribute("data-status", "NO_SHOW");
    await expect(page.locator("[data-queue-coming]")).toHaveCount(0);
    await expect(page.locator("[data-queue-try]")).toHaveCount(0);

    await admin(request, cookie, { action: "done", id: entry.id });
    await page.goto(`${BASE}/s/demo/q/${t.ref}`);
    await expect(page.locator("[data-status]")).toHaveAttribute("data-status", "DONE");
    await expect(page.locator("[data-queue-try]")).toHaveCount(0);
  });

  test("request mode blocks overnight slots and on-my-way", async ({ page, request }) => {
    await login(page);
    const cookie = await cookieHeader(page);
    await admin(request, cookie, { action: "settings", units: 2, avgMinutes: 30, alertLeadMin: 5, mode: "REQUEST", unitLabel: "chair" });

    const night = await join(request, "Night", "9876511003", { requestedDate: "2026-12-01", requestedSlot: "02:00" });
    expect(night.status).toBe(400);

    const day = await join(request, "Day", "9876511004", { requestedDate: "2026-12-01", requestedSlot: "10:00" });
    expect(day.status).toBe(200);
    expect(day.data.status).toBe("REQUESTED");
    await page.goto(`${BASE}/s/demo/q/${day.data.ref}`);
    await expect(page.locator("[data-status]")).toHaveAttribute("data-status", "REQUESTED");
    await expect(page.getByRole("button", { name: /on my way/i })).toHaveCount(0);
    await expect(page.locator("[data-queue-try]")).toBeVisible();

    await page.goto(`${BASE}/admin/queue`);
    await page.getByText("Queue settings").click();
    await expect(page.getByText("Alert when the wait is under")).toHaveCount(0);
  });

  test("join memory keeps more than one booking ref", async ({ page, request }) => {
    await login(page);
    const cookie = await cookieHeader(page);
    await clearLine(request, cookie);
    const a = await join(request, "MemA", "9876511005");
    const b = await join(request, "MemB", "9876511006");
    await page.goto(`${BASE}/s/demo/queue`);
    await page.evaluate(({ refA, refB }) => {
      localStorage.setItem("lookuvi-queue:demo", JSON.stringify({
        visits: [
          { name: "MemB", phone: "9876511006", ref: refB },
          { name: "MemA", phone: "9876511005", ref: refA },
        ],
      }));
    }, { refA: a.data.ref, refB: b.data.ref });
    await page.reload();
    await expect(page.locator("[data-queue-visits]")).toHaveAttribute("data-queue-visits", "2");
    await expect(page.locator(`a[href="/s/demo/q/${a.data.ref}"]`)).toBeVisible();
    await expect(page.locator(`a[href="/s/demo/q/${b.data.ref}"]`)).toBeVisible();
  });
});
