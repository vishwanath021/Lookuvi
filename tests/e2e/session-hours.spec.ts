import { hash } from "bcryptjs";
import { expect, test } from "@playwright/test";
import { kolkataDayKey } from "@/lib/queue/day";
import { kolkataClock } from "@/lib/queue/hours";
import { serializeWeek, weekFromPair, type Session, type WeekSchedule } from "@/lib/queue/schedule";

const PASSWORD = "SessionHours#2026";
const EMAIL = "session-hours@lookuvi.test";
const SLUG = "session-hours";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function shiftMinutes(minutes: number) {
  const [hour, minute] = kolkataClock().split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return { dayShift: Math.floor(total / 1440), hhmm: `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}` };
}

/** A session that contains now, plus a later one today when it still fits. */
function aroundNow(): { week: WeekSchedule; openUntil: string; nextOpen: string } {
  const start = shiftMinutes(-30);
  const end = shiftMinutes(40);
  const laterStart = shiftMinutes(70);
  const laterEnd = shiftMinutes(130);
  const today: Session[] = [];
  if (start.dayShift === 0 && end.dayShift === 0 && start.hhmm < end.hhmm) {
    today.push({ open: start.hhmm, close: end.hhmm });
  } else {
    today.push({ open: "00:00", close: "23:59" });
  }
  let nextOpen = "tomorrow 9:00 AM";
  if (laterStart.dayShift === 0 && laterEnd.dayShift === 0 && laterStart.hhmm > today[0].close && laterStart.hhmm < laterEnd.hhmm) {
    today.push({ open: laterStart.hhmm, close: laterEnd.hhmm });
    const [hour, minute] = laterStart.hhmm.split(":").map(Number);
    const suffix = hour >= 12 ? "PM" : "AM";
    const h = hour % 12 || 12;
    nextOpen = `${h}:${pad(minute)} ${suffix}`;
  }
  const week = weekFromPair("09:00", "13:00");
  const names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const index = new Date(`${kolkataDayKey()}T12:00:00+05:30`).getUTCDay();
  week[names[index]] = today;
  const [closeHour, closeMinute] = today[0].close.split(":").map(Number);
  const suffix = closeHour >= 12 ? "PM" : "AM";
  const h = closeHour % 12 || 12;
  return { week, openUntil: `${h}:${pad(closeMinute)} ${suffix}`, nextOpen };
}

async function db() {
  process.env.DATABASE_URL = "file:./dev.db";
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const prisma = await db();
  const plan = aroundNow();
  const passwordHash = await hash(PASSWORD, 10);
  const tenant = await prisma.tenant.upsert({
    where: { slug: SLUG },
    update: {
      name: "Session Hours",
      productQueue: true,
      status: "TRIAL",
      deletedAt: null,
      openTime: "",
      closeTime: "",
      weeklyHours: serializeWeek(plan.week),
      hoursOverride: "",
      hoursOverrideUntil: null,
      closedDayKey: "",
    },
    create: {
      slug: SLUG,
      name: "Session Hours",
      productQueue: true,
      weeklyHours: serializeWeek(plan.week),
    },
  });
  const owner = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, name: "Session Owner", isSuperAdmin: false, totpEnabled: false },
    create: { email: EMAIL, passwordHash, name: "Session Owner" },
  });
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: owner.id, tenantId: tenant.id } },
    update: { role: "OWNER" },
    create: { userId: owner.id, tenantId: tenant.id, role: "OWNER" },
  });
  await prisma.queueState.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, isOpen: true, mode: "LIVE", units: 1, avgMinutes: 20, alertLeadMin: 5, unitLabel: "chair" },
    update: { isOpen: true, mode: "LIVE" },
  });
  await prisma.queueEntry.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.$disconnect();
});

test("the desk shows the session, an early close, a late open, and closed today", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser is enough for the desk states.");
  const plan = aroundNow();

  await page.goto("/login");
  await page.locator("form[data-ready='yes']").waitFor();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin/);

  await page.goto("/admin/queue");
  await page.locator("[data-queue-mode][data-ready='yes']").waitFor();
  await expect(page.locator("[data-hours-label]")).toHaveAttribute("data-hours-label", `Open until ${plan.openUntil}`);

  await page.getByRole("switch", { name: "Queue is open" }).click();
  await page.getByRole("button", { name: "Close queue" }).click();
  await expect(page.locator("[data-hours-label]")).toHaveAttribute("data-hours-label", `Closed · opens ${plan.nextOpen}`);

  await page.getByRole("switch", { name: "Queue is closed" }).click();
  await expect(page.locator("[data-hours-label]")).toHaveAttribute("data-hours-label", `Open until ${plan.openUntil}`);

  const prisma = await db();
  const [hour] = kolkataClock().split(":").map(Number);
  const gap = weekFromPair("09:00", "12:00");
  const names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const index = new Date(`${kolkataDayKey()}T12:00:00+05:30`).getUTCDay();
  const later = hour < 18;
  gap[names[index]] = later ? [{ open: "18:00", close: "21:00" }] : [{ open: "09:00", close: "12:00" }];
  await prisma.tenant.update({
    where: { slug: SLUG },
    data: { weeklyHours: serializeWeek(gap), hoursOverride: "", hoursOverrideUntil: null, closedDayKey: "" },
  });
  await prisma.$disconnect();
  await page.reload();
  await page.locator("[data-queue-mode][data-ready='yes']").waitFor();
  await expect(page.locator("[data-hours-label]")).toHaveAttribute("data-hours-label", later ? "Closed · opens 6:00 PM" : "Closed · opens tomorrow 9:00 AM");
  await page.getByRole("switch", { name: "Queue is closed" }).click();
  await expect(page.locator("[data-hours-label]")).toHaveAttribute("data-hours-label", "Open late (you)");

  await page.getByRole("button", { name: "Closed today" }).click();
  await expect(page.locator("[data-hours-label]")).toHaveAttribute("data-hours-label", "Closed today");
  await page.goto(`/s/${SLUG}/queue`);
  await expect(page.locator("[data-today-hours='Closed']")).toBeVisible();
  await expect(page.getByRole("button", { name: "Join the queue" })).toBeDisabled();
  await expect(page.getByText(/closed today/i)).toBeVisible();

  await page.goto("/admin/queue");
  await page.locator("[data-queue-mode][data-ready='yes']").waitFor();
  await page.getByRole("button", { name: "Undo closed today" }).click();
  await expect(page.locator("[data-hours-label]")).toHaveAttribute("data-hours-label", "Open late (you)");
});
