/**
 * Plain dates and times for WhatsApp prefilled text.
 * A raw ISO day such as 2026-12-20 is auto-linked as a phone number.
 * The media or status URL stays the only URL.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** `2026-12-20` → `20 December 2026`. Anything else is returned unchanged. */
export function whatsAppDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const month = MONTHS[Number(match[2]) - 1];
  const day = Number(match[3]);
  if (!month || day < 1 || day > 31) return value;
  return `${String(day).padStart(2, "0")} ${month} ${match[1]}`;
}

/** `16:30` → `4:30 PM`. Anything else is returned unchanged. */
export function whatsAppTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return value;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (hour24 > 23 || minute > 59) return value;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 || 12;
  return `${hour}:${match[2]} ${suffix}`;
}

/**
 * `2026-12-20`, `16:30`, or `2026-12-20 16:30` written for a WhatsApp message.
 * Free text that is not one of those shapes is left as the salon typed it.
 */
export function whatsAppSchedule(value: string) {
  const trimmed = value.trim();
  const both = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2}(?::\d{2})?)$/.exec(trimmed);
  if (both) {
    const date = whatsAppDate(both[1]);
    const time = whatsAppTime(both[2]);
    if (date === both[1]) return value;
    return `${date} at ${time}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return whatsAppDate(trimmed);
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(trimmed)) return whatsAppTime(trimmed);
  return value;
}
