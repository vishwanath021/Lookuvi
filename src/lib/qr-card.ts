import QRCode from "qrcode";

/** Text the printed card shows under the QR: the salon's customer website without scheme or /welcome. */
export function cardDisplayUrl(welcomeUrl: string) {
  try {
    return new URL(welcomeUrl).host;
  } catch {
    return welcomeUrl.replace(/^https?:\/\//, "").replace(/\/welcome$/, "");
  }
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[ch] as string);
}

/**
 * A clean printable card: salon name, QR, customer website. Nothing else.
 * Size is A6-ish portrait (105 x 148 mm) so it prints sharply at any scale.
 */
export async function qrCardSvg(input: { name: string; url: string }) {
  const width = 1050;
  const height = 1480;
  const qrSize = 760;
  const qrX = (width - qrSize) / 2;
  const qrY = 330;
  const qrSvg = await QRCode.toString(input.url, { type: "svg", margin: 0, color: { dark: "#12312e", light: "#ffffff" } });
  const viewBox = /viewBox="([^"]+)"/.exec(qrSvg)?.[1] || "0 0 33 33";
  const inner = qrSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const name = escapeXml(input.name);
  const display = escapeXml(cardDisplayUrl(input.url));
  const nameSize = input.name.length > 26 ? 56 : 72;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="105mm" height="148mm" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <text x="${width / 2}" y="210" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${nameSize}" font-weight="700" fill="#12312e">${name}</text>
  <svg x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" viewBox="${viewBox}" shape-rendering="crispEdges">${inner}</svg>
  <text x="${width / 2}" y="${qrY + qrSize + 140}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="44" fill="#12312e">${display}</text>
</svg>`;
}
