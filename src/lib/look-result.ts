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

/** Full-resolution file behind the preview URL, saved as a JPEG download. */
export async function downloadLookFile(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("download");
  const blob = await response.blob();
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
