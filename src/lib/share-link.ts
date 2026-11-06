import { signObjectKey, verifyObjectSig } from "@/lib/storage";

const ID = /^[A-Za-z0-9_-]{1,64}$/;

function resultKey(tenantId: string, requestId: string) {
  return `generations/${tenantId}/${requestId}/result.jpg`;
}

function appBase() {
  return (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Short customer-facing link: `/l/<opaque>.<exp>.<sig>`. No storage key or query string in the text a guest shares. */
export function lookShareLink(tenantId: string, requestId: string, ttlSeconds: number) {
  if (!ID.test(tenantId) || !ID.test(requestId)) return "";
  const exp = Date.now() + ttlSeconds * 1000;
  const sig = signObjectKey(resultKey(tenantId, requestId), exp);
  const id = Buffer.from(`${tenantId}:${requestId}`).toString("base64url");
  return `${appBase()}/l/${id}.${exp.toString(36)}.${sig}`;
}

/** Parses and verifies a share token. Returns the storage key or "". */
export function verifyShareToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return "";
  const [id, exp36, sig] = parts;
  let decoded = "";
  try {
    decoded = Buffer.from(id, "base64url").toString("utf8");
  } catch {
    return "";
  }
  const [tenantId, requestId, extra] = decoded.split(":");
  if (extra !== undefined || !tenantId || !requestId || !ID.test(tenantId) || !ID.test(requestId)) return "";
  const exp = parseInt(exp36, 36);
  const key = resultKey(tenantId, requestId);
  return verifyObjectSig(key, exp, sig) ? key : "";
}

/** True when the value is a share link this app issued (signature checked). */
export function isShareLink(value: string) {
  try {
    const url = new URL(value);
    if (url.origin !== new URL(appBase()).origin) return false;
    const match = /^\/l\/([^/]+)$/.exec(url.pathname);
    return Boolean(match && !url.search && verifyShareToken(match[1]));
  } catch {
    return false;
  }
}
