/** Filename for a saved preview: salon, look, then the calendar date. */
export function lookDownloadName(slug: string, look: string, when = new Date()) {
  const day = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
  const salon = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "salon";
  const name = look.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "look";
  return `${salon}-${name}-${day}.jpg`;
}

export function lookShareMessage(kind: "bridal" | "groom", name: string, link?: string) {
  const lead = kind === "groom" ? "Look at this groom look" : "Look at this bridal look";
  return link ? `${lead}: ${name}. ${link}` : `${lead}: ${name}.`;
}

/** Full-resolution file behind the preview URL, saved as a JPEG download. */
export async function downloadLookFile(url: string, filename: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
