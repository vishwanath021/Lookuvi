const SENSITIVE = /(key_secret|razorpay_key_secret|webhook_secret|razorpay_signature|signature|card|cvv|vpa|upi)/i;

/** Strip secrets and card/UPI fields from log payloads. */
export function redactForLog(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length > 64 && /^[a-f0-9]+$/i.test(value)) return "[redacted-signature]";
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => redactForLog(item));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE.test(key)) out[key] = "[redacted]";
      else out[key] = redactForLog(val);
    }
    return out;
  }
  return value;
}