/**
 * Cookie-authenticated writes must come from this app.
 * Webhooks and guest try-on are not checked here.
 *
 * Browsers set Sec-Fetch-Site and scripts cannot override it. A same-origin
 * fetch is the salon desk talking to itself, even when Caddy's Host and
 * X-Forwarded-Host disagree (internal upstream vs the public name, or :443).
 * Cross-site form posts send cross-site and are still rejected.
 */

export const CSRF_MESSAGE = "This page could not confirm it was opened from Lookuvi. Refresh and try again.";

function siteHost(value: string) {
  const first = value.split(",")[0]?.trim().toLowerCase() || "";
  return first.replace(/:(?:443|80)$/, "");
}

export function csrfBlocked(req: { method: string; headers: { get(name: string): string | null }; nextUrl?: { pathname: string }; url?: string }) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return false;
  const pathname = req.nextUrl?.pathname || new URL(req.url || "http://localhost").pathname;
  const guarded = pathname.startsWith("/api/v1/admin") || pathname.startsWith("/api/v1/super") || pathname.startsWith("/api/v1/auth") || pathname.startsWith("/api/v1/account");
  if (!guarded) return false;
  const fetchSite = (req.headers.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite === "same-origin") return false;
  const origin = req.headers.get("origin");
  if (!origin) return process.env.NODE_ENV === "production";
  let originHost = "";
  try {
    originHost = siteHost(new URL(origin).host);
  } catch {
    return true;
  }
  if (!originHost) return true;
  const forwarded = siteHost(req.headers.get("x-forwarded-host") || "");
  const host = siteHost(req.headers.get("host") || "");
  return originHost !== forwarded && originHost !== host;
}
