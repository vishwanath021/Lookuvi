import sharp from "sharp";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] ?? char);
}

/** Labelled sample when no image engine is configured. Not a provider image. */
export async function demoMakeupSample(userJpeg: Buffer, styleName: string) {
  const width = 768;
  const height = 1024;
  const base = await sharp(userJpeg).rotate().resize(width, height, { fit: "cover" }).jpeg({ quality: 86 }).toBuffer();
  const title = escapeXml((styleName || "Makeup").slice(0, 28));
  const tag = Buffer.from(`<svg width="240" height="36" xmlns="http://www.w3.org/2000/svg">
    <rect width="240" height="36" rx="8" fill="#3e304b"/>
    <text x="120" y="24" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#ffffff">Sample · ${title}</text>
  </svg>`);
  return sharp(base).composite([{ input: tag, top: 16, left: 16 }]).jpeg({ quality: 84 }).toBuffer();
}
