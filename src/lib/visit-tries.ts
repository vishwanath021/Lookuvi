/** Bridal and groom previews share one visit budget. Everyday try-on does not. */
export const VISIT_TRY_KINDS = ["BRIDAL", "MEHENDI", "GROOM", "GROOM_OWN", "BRIDAL_OWN"] as const;

export const DEFAULT_VISIT_TRY_LIMIT = 3;

export const VISIT_CAP_MESSAGE = "Ask the salon to unlock more tries";

export type CachedLook = { url: string; name: string; before: string };

export function selectionKey(photoId: string, parts: Record<string, string>) {
  const body = Object.keys(parts).sort().map((key) => `${key}=${parts[key]}`).join("&");
  return `${photoId}|${body}`;
}

export function visitAllowed(used: number, limit: number, bonus = 0) {
  return used < Math.max(0, limit) + Math.max(0, bonus);
}

/** The next real try, capped at the allowance. "Try 2 of 3" means one try is already spent. */
export function tryCounterLabel(used: number, allowance: number) {
  const cap = Math.max(1, allowance);
  const next = Math.min(Math.max(0, used) + 1, cap);
  return `Try ${next} of ${cap}`;
}

export function tryButton(args: { ready: boolean; sameAsResult: boolean; atLimit: boolean; cached: boolean }) {
  if (args.sameAsResult) {
    return { label: "Try now", enabled: false, note: "", another: true };
  }
  if (args.cached && args.ready) {
    return { label: "Try now", enabled: true, note: "", another: false };
  }
  if (args.atLimit) {
    return { label: "Try now", enabled: false, note: VISIT_CAP_MESSAGE, another: false };
  }
  return { label: "Try now", enabled: args.ready, note: "", another: false };
}

/**
 * Same photo and the same selections return the saved picture.
 * The provider function runs only when there is no cache hit and the visit still has a try.
 */
export async function takePreview<T extends CachedLook>(args: {
  cache: Map<string, T>;
  key: string;
  used: number;
  allowance: number;
  generate: () => Promise<T>;
}) {
  const saved = args.cache.get(args.key);
  if (saved) return { result: saved, called: false as const, used: args.used };
  if (!visitAllowed(args.used, args.allowance, 0)) {
    return { result: null, called: false as const, used: args.used, blocked: true as const };
  }
  const result = await args.generate();
  args.cache.set(args.key, result);
  return { result, called: true as const, used: args.used + 1 };
}
