const BANNED = /photo|image|buffer|dataurl|base64|inlinedata|pixels|selfie|apikey|api_key|secret|cipher|authorization|token|password|otp|codeHash/i;
const PII_KEY = /^(phone|mobile|msisdn|email|name|fullName|guestName|customerName|to|from)$/i;
const KEY_TEXT = /(?:^|[^A-Za-z0-9])(?:sk-(?:proj-)?[A-Za-z0-9_\-]{8,}|AIza[0-9A-Za-z\-_]{8,})/;
/** Indian mobiles (+91 / 91 / 10 digits) and generic long digit runs that look like phones. */
const PHONE_TEXT = /(?:\+?91[\s-]?)?[6-9]\d{9}\b/g;

export function maskPhone(value: string) {
  // Collapse common phone spacing so +91 98765 43210 still masks.
  const collapsed = value.replace(/(\+?91)[\s-]?([6-9]\d{4})[\s-]?(\d{5})\b/g, "$1$2$3");
  return collapsed.replace(PHONE_TEXT, (match) => {
    const digits = match.replace(/\D/g, "");
    const tail = digits.slice(-4) || "****";
    return `***${tail}`;
  });
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return "[buffer]";
  if (value instanceof Uint8Array) return "[bytes]";
  if (typeof value === "string") {
    if (value.startsWith("data:image") || value.length > 400 || KEY_TEXT.test(value)) return "[redacted-string]";
    return maskPhone(value);
  }
  if (Array.isArray(value)) return value.map((entry) => redact(entry, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (BANNED.test(key) || PII_KEY.test(key)) {
        if (typeof entry === "string" && /phone|mobile|msisdn|to|from/i.test(key)) {
          out[key] = maskPhone(entry).includes("***") ? maskPhone(entry) : "[redacted]";
        } else {
          out[key] = "[redacted]";
        }
        continue;
      }
      out[key] = redact(entry, depth + 1);
    }
    return out;
  }
  return value;
}

export function logInfo(message: string, meta?: unknown) {
  console.info(message, meta ? redact(meta) : "");
}

/** One line per provider HTTP call. Never pass images, prompts, or keys. */
const SECRET_TEXT = /(?:sk-(?:proj-)?[A-Za-z0-9_\-]{8,}|AIza[0-9A-Za-z\-_]{8,}|Key\s+[^\s"]+)/gi;

function stripProviderValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth]";
  if (Array.isArray(value)) return value.slice(0, 6).map((entry) => stripProviderValue(entry, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (/prompt|image|url|authorization|token|key|secret|password|selfie/i.test(key)) {
        out[key] = "[redacted]";
        continue;
      }
      out[key] = stripProviderValue(entry, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") return value.length > 160 ? `${value.slice(0, 160)}…` : value;
  return value;
}

/** Short provider reply safe for logs. Drops prompts, image URLs, and keys. */
export function scrubProviderBody(body: string) {
  let text = body.replace(/\s+/g, " ").trim();
  try {
    const parsed = JSON.parse(body) as unknown;
    if (parsed && typeof parsed === "object") text = JSON.stringify(stripProviderValue(parsed));
  } catch {
    // Keep the raw reply when it is not JSON.
  }
  text = text.replace(SECRET_TEXT, "[redacted]").replace(/data:[^,\s]{0,40};base64,[A-Za-z0-9+/=]+/g, "[data]");
  return text.length > 400 ? text.slice(0, 400) : text;
}

/** One line for a failed provider HTTP call. Never pass the key or the photo. */
export function logProviderFailure(entry: {
  provider: string;
  model: string;
  salonId?: string;
  httpStatus?: number;
  body?: string;
  requestId?: string;
}) {
  logError("provider error", {
    provider: entry.provider,
    model: entry.model,
    salonId: entry.salonId || "",
    httpStatus: entry.httpStatus ?? 0,
    body: scrubProviderBody(entry.body || ""),
    requestId: (entry.requestId || "").slice(0, 128),
  });
}

export function logProviderCall(entry: {
  provider: string;
  model: string;
  salonId: string;
  status: string;
  latencyMs: number;
  costUsd?: number;
  requestId?: string;
  /** Text input count from the provider usage object. */
  textCount?: number;
  /** Image input count from the provider usage object. */
  pictureIn?: number;
  /** Image output count from the provider usage object. */
  pictureOut?: number;
}) {
  logInfo("provider call", {
    provider: entry.provider,
    model: entry.model,
    salonId: entry.salonId,
    status: entry.status,
    latencyMs: entry.latencyMs,
    costUsd: entry.costUsd ?? 0,
    textCount: entry.textCount ?? 0,
    pictureIn: entry.pictureIn ?? 0,
    pictureOut: entry.pictureOut ?? 0,
    requestId: (entry.requestId || "").slice(0, 128),
  });
}

export function logError(message: string, meta?: unknown) {
  const safe = meta ? redact(meta) : "";
  console.error(message, safe);
  void import("@/lib/sentry")
    .then((mod) => mod.captureException(message, safe))
    .catch(() => undefined);
}
