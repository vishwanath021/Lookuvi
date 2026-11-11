/** Filename for a saved preview: salon, look, then the calendar date. */
export function lookDownloadName(slug: string, look: string, when = new Date()) {
  const day = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
  const salon = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "salon";
  const name = look.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "look";
  return `ai-preview-${salon}-${name}-${day}.jpg`;
}

export function lookShareMessage(kind: "bridal" | "groom", name: string, link?: string) {
  const lead = kind === "groom" ? "Look at this groom look" : "Look at this bridal look";
  const note = "AI-generated preview";
  return link ? `${lead}: ${name} (${note}). ${link}` : `${lead}: ${name} (${note}).`;
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function dataUrlToBlob(url: string) {
  const comma = url.indexOf(",");
  if (comma < 0) throw new Error("download");
  const mime = /data:([^;,]+)/.exec(url.slice(0, comma))?.[1] || "image/jpeg";
  const binary = atob(url.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function fetchBlob(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("download");
  return response.blob();
}

/** Full-resolution file. A Blob or data URL is shared in the same tap, before any network wait. */
export async function downloadLookFile(source: Blob | string, filename: string) {
  const blob = source instanceof Blob ? source : source.startsWith("data:") ? dataUrlToBlob(source) : await fetchBlob(source);
  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
  const shareNav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (shareNav.share && shareNav.canShare?.({ files: [file] })) {
    try {
      await shareNav.share({ files: [file], title: filename });
      return;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
    }
  }
  const objectUrl = URL.createObjectURL(blob);
  if (isIos()) {
    window.open(objectUrl, "_blank", "noopener");
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}
