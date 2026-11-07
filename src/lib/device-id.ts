export const DEVICE_KEY = "lookuvi-device";

/** One id for this phone, kept across tabs so Arrived unlocks the try-on. */
export function guestDeviceId() {
  try {
    const saved = localStorage.getItem(DEVICE_KEY) || "";
    if (saved.length >= 8 && saved.length <= 80) return saved;
    const next = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, next);
    return next;
  } catch {
    return "";
  }
}
