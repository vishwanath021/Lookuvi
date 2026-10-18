/**
 * Client helpers for the "your own look" uploads. Phone cameras write 3–8 MB photos.
 * Sent as-is, a selfie and a few pieces pass the 2 MB per-photo cap and the request
 * body limit, so the preview fails. Every photo is shrunk on the phone first.
 */

/** Long edge for an item photo (saree, blouse, jewellery). The server shrinks again per slot. */
export const OWN_ITEM_EDGE = 1024;
/** Long edge for the selfie. The server frames it on 1024x1536 at most. */
export const OWN_SELFIE_EDGE = 1536;
export const OWN_JPEG_QUALITY = 0.8;
/** Per-photo cap the server applies (OWN_LOOK_MAX_BYTES / GROOM_MAX_BYTES). */
export const OWN_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
/** Stay well under the server body limit, including multipart overhead. */
export const OWN_BODY_LIMIT_BYTES = 9 * 1024 * 1024;
/** The server stops the provider call at 100 s. The phone waits a little longer. */
export const OWN_CLIENT_TIMEOUT_MS = 130_000;

export function fitInside(width: number, height: number, edge: number) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const scale = Math.min(1, edge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

type Drawable = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(blob: Blob): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      /* Older Safari cannot take options. Fall back to an <img>. */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/**
 * Resize a photo to fit `edge` and re-encode as JPEG. EXIF orientation is applied.
 * When the browser cannot decode the file (for example HEIC on desktop Chrome) the
 * original is returned and the server decides.
 */
export async function shrinkPhoto(blob: Blob, edge: number, quality = OWN_JPEG_QUALITY): Promise<Blob> {
  if (typeof document === "undefined") return blob;
  let drawable: Drawable;
  try {
    drawable = await decode(blob);
  } catch {
    return blob;
  }
  try {
    const size = fitInside(drawable.width, drawable.height, edge);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.drawImage(drawable.source, 0, 0, size.width, size.height);
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!out || out.size === 0) return blob;
    return out.size < blob.size || blob.type !== "image/jpeg" ? out : blob;
  } finally {
    drawable.close();
  }
}

/** A message for the guest when the photos cannot be sent, or "" when they can. */
export function payloadProblem(photos: { label: string; size: number }[]) {
  const big = photos.find((photo) => photo.size > OWN_PHOTO_MAX_BYTES);
  if (big) return `The ${big.label} photo is too large. Take it again or pick a smaller photo.`;
  const total = photos.reduce((sum, photo) => sum + photo.size, 0);
  if (total > OWN_BODY_LIMIT_BYTES) return "These photos are too large together. Remove a piece and try again.";
  return "";
}

/** What the guest sees when the preview request fails. Never empty. */
export function previewFailureMessage(status: number, data: { error?: string; message?: string } | null | undefined) {
  if (data?.message) return data.message;
  if (status === 413) return "These photos are too large together. Remove a piece and try again. No try was used.";
  if (status === 429) return "Too many tries right now. Please wait a minute and try again.";
  if (status === 504 || status === 502) return "The preview took too long and stopped. No try was used. Please try again.";
  return "That preview did not finish. No try was used. Please try again.";
}

export class PreviewFailure extends Error {
  constructor(message: string, readonly status: number, readonly data: Record<string, unknown> = {}) {
    super(message);
    this.name = "PreviewFailure";
  }
}

/**
 * POST a preview form. Resolves with an ok image response. Every other outcome
 * (HTTP error, JSON error body, dropped connection, timeout) throws a PreviewFailure
 * whose message is safe to show.
 */
export async function postPreview(url: string, body: FormData, timeoutMs = OWN_CLIENT_TIMEOUT_MS, fetcher: typeof fetch = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetcher(url, { method: "POST", body, signal: controller.signal });
  } catch (error) {
    const aborted = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
    throw new PreviewFailure(
      aborted
        ? "The preview is taking too long. Please check your connection and try again."
        : "The connection dropped before the preview finished. Please check your internet and try again.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok || contentType.includes("json") || contentType.includes("text/html")) {
    const data = contentType.includes("json") ? ((await res.json().catch(() => ({}))) as Record<string, unknown>) : {};
    const status = res.ok ? 500 : res.status;
    throw new PreviewFailure(previewFailureMessage(status, data as { message?: string }), status, data);
  }
  return res;
}
