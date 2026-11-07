import { indianMobile } from "@/lib/queue/phone";

export const DEFAULT_REMINDER_DAYS = 42;
export const MIN_REMINDER_DAYS = 28;
export const MAX_REMINDER_DAYS = 42;
export const MAX_REMINDER_TEMPLATE = 500;
export const REMINDER_MARK_LIMIT = 60;
export const REMINDER_MARK_WINDOW_MS = 10 * 60 * 1000;
export const WHATSAPP_WINDOW = "lookuvi-wa";

export const DEFAULT_REMINDER_TEMPLATE =
  "Hi {name}, it's been a while since your last visit to {salon}! Come in for a fresh look.";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReminderMethod = "MANUAL" | "AUTO";

export type DueVisitRow = {
  id: string;
  name: string;
  phone: string;
  phoneLabel: string;
  lastVisitAt: string;
  lastVisitLabel: string;
  daysSince: number;
  points: number;
  message: string;
  meUrl: string;
  webUrl: string;
  appUrl: string;
};

export function effectiveReminderDays(days: number) {
  if (!Number.isInteger(days) || days < MIN_REMINDER_DAYS || days > MAX_REMINDER_DAYS) return DEFAULT_REMINDER_DAYS;
  return days;
}

export function dueVisitIntro(days: number) {
  const safe = effectiveReminderDays(days);
  if (safe === 42) return "Customers who haven't come back in 6 weeks.";
  if (safe % 7 === 0) {
    const weeks = safe / 7;
    return `Customers who haven't come back in ${weeks} ${weeks === 1 ? "week" : "weeks"}.`;
  }
  return `Customers who haven't come back in ${safe} days.`;
}

export function reminderCutoff(days: number, now = new Date()) {
  return new Date(now.getTime() - effectiveReminderDays(days) * DAY_MS);
}

export function daysSinceVisit(at: Date, now = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - at.getTime()) / DAY_MS));
}

export function visitDateLabel(at: Date) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(at);
}

/** Drop tags and control characters. The message is plain text. */
export function cleanReminderTemplate(input: string) {
  const text = input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
  if (text.length > MAX_REMINDER_TEMPLATE) {
    return { ok: false as const, message: "Keep the message under 500 characters." };
  }
  return { ok: true as const, text };
}

function plain(value: string) {
  return value.replace(/[<>]/g, "").replace(/[\u0000-\u001F]/g, " ").replace(/[ \t]{2,}/g, " ").trim();
}

function tidy(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n");
}

function fill(template: string, values: { name: string; salon: string; points: number; link: string }) {
  return template
    .replaceAll("{name}", values.name)
    .replaceAll("{salon}", values.salon)
    .replaceAll("{points}", String(values.points))
    .replaceAll("{link}", values.link);
}

/** Renders the owner's template. The points line is added only when the balance is above 0. */
export function renderReminderMessage(input: {
  template: string;
  name: string;
  salon: string;
  points: number;
  link: string;
}) {
  const points = Number.isFinite(input.points) ? Math.max(0, Math.floor(input.points)) : 0;
  const values = {
    name: plain(input.name) || "there",
    salon: plain(input.salon) || "the salon",
    points,
    link: plain(input.link),
  };
  const source = input.template.trim() || DEFAULT_REMINDER_TEMPLATE;
  const mentionsPoints = source.includes("{points}");
  const body = points > 0
    ? source
    : source.replace(/You have \{points\} points\.?/gi, "").replaceAll("{points}", "");
  let text = tidy(fill(body, values));
  if (!text) text = tidy(fill(DEFAULT_REMINDER_TEMPLATE, values));
  if (points > 0 && !mentionsPoints) text = `${text}\nYou have ${points} points.`;
  return text;
}

/** Digits for wa.me. Indian mobiles become 91XXXXXXXXXX. */
export function reminderPhoneDigits(phone: string) {
  return indianMobile(phone) || phone.replace(/[^\d]/g, "");
}

export function whatsAppMeUrl(phone: string, text: string) {
  return `https://wa.me/${reminderPhoneDigits(phone)}?text=${encodeURIComponent(text)}`;
}

export function whatsAppWebUrl(phone: string, text: string) {
  return `https://web.whatsapp.com/send?phone=${reminderPhoneDigits(phone)}&text=${encodeURIComponent(text)}`;
}

export function whatsAppAppUrl(phone: string, text: string) {
  return `whatsapp://send?phone=${reminderPhoneDigits(phone)}&text=${encodeURIComponent(text)}`;
}
