const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const prev = (buckets.get(key) ?? []).filter((ts) => now - ts < windowMs);
  if (prev.length >= limit) {
    buckets.set(key, prev);
    return { ok: false as const, remaining: 0, retryAfterMs: Math.max(0, windowMs - (now - prev[0])) };
  }
  prev.push(now);
  buckets.set(key, prev);
  return { ok: true as const, remaining: limit - prev.length, retryAfterMs: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}

/**
 * Addresses that belong to a reverse proxy, a Docker bridge, or a loopback hop.
 * They are not a customer. Using one of them as a rate-limit key puts every guest in one bucket.
 */
export function isPrivateOrLocalIp(value: string) {
  const ip = value.trim().toLowerCase().replace(/^::ffff:/, "");
  if (!ip || ip === "::1" || ip === "localhost") return true;
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/** True when this value must not be a shared public rate-limit key. */
export function isSharedProxyAddress(ip: string) {
  return !ip || ip === "unknown" || ip === "direct" || ip === "proxy" || isPrivateOrLocalIp(ip);
}

function publicIp(value: string) {
  const ip = value.trim().replace(/^::ffff:/i, "");
  if (!ip || ip.length > 64 || /\s/.test(ip)) return "";
  if (isPrivateOrLocalIp(ip)) return "";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
  if (ip.includes(":") && /^[0-9a-fA-F:]+$/.test(ip)) return ip;
  return "";
}

/**
 * Trust X-Forwarded-For only when the app is behind the known reverse proxy (TRUST_PROXY).
 * Caddy overwrites the header with the connecting client and may leave a private hop on the right.
 * Walk from the right and skip private/proxy hops so customers are not collapsed onto the proxy address.
 * The left-most value is never preferred: a caller can spoof it. Without TRUST_PROXY the header is ignored.
 */
export function clientIp(headerValue: string | null, trustProxy = process.env.TRUST_PROXY === "true") {
  if (!headerValue || !trustProxy) return "unknown";
  const parts = headerValue.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return "unknown";
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const ip = publicIp(parts[index]);
    if (ip) return ip;
  }
  return "proxy";
}

export function requestClientIp(
  req: { headers: { get(name: string): string | null } },
  env: NodeJS.ProcessEnv = process.env,
) {
  if (env.TRUST_PROXY !== "true") return "direct";
  if (env.TRUST_CF_HEADER === "true") {
    const cf = publicIp(req.headers.get("cf-connecting-ip") || "");
    if (cf) return cf;
  }
  return clientIp(req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"), true);
}

/** Memory in dev and tests. Postgres in production. Redis when REDIS_URL is set. */
export async function sharedRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  if (process.env.REDIS_URL && process.env.NODE_ENV === "production") {
    try {
      const { redisIncrement } = await import("@/lib/redis-limit");
      const hits = await redisIncrement(key, windowMs);
      if (hits <= limit) return { ok: true as const, remaining: limit - hits, retryAfterMs: 0 };
      return { ok: false as const, remaining: 0, retryAfterMs: windowMs };
    } catch {
      // Fall through to the database so a Redis blip does not open the gate.
    }
  }
  const database = process.env.DATABASE_URL || "";
  const useDb = process.env.RATE_LIMIT_STORE === "database" || (process.env.NODE_ENV === "production" && database.startsWith("postgres"));
  if (useDb) {
    const { prisma } = await import("@/lib/prisma");
    const { createHash } = await import("node:crypto");
    const bucket = Math.floor(now / windowMs);
    const id = createHash("sha256").update(`${key}:${bucket}`).digest("hex");
    const resetAt = new Date((bucket + 1) * windowMs);
    await prisma.rateBucket.upsert({ where: { id }, create: { id, hits: 0, resetAt }, update: {} });
    const updated = await prisma.rateBucket.updateMany({ where: { id, hits: { lt: limit } }, data: { hits: { increment: 1 } } });
    if (updated.count === 1) return { ok: true as const, remaining: 0, retryAfterMs: 0 };
    return { ok: false as const, remaining: 0, retryAfterMs: Math.max(0, resetAt.getTime() - now) };
  }
  return rateLimit(key, limit, windowMs, now);
}
