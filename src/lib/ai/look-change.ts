import sharp from "sharp";

/** Mean channel change in the hair band below this counts as the same photo. */
export const HAIR_UNCHANGED_DELTA = 8;
/** A sampled hair pixel counts as dyed when the colour moves this far. */
export const HAIR_PIXEL_DELTA = 20;
/** Or when the chroma channels move this far together. */
export const HAIR_CHROMA_DELTA = 12;
/** Share of sampled hair pixels that must move before a quiet mean still counts as a dye. */
export const HAIR_CHANGED_FRACTION = 0.01;

export const COLOUR_UNCHANGED_MESSAGE =
  "The colour did not show on this photo, so no credit was used. Try again.";

/**
 * Hair sits on the crown and at the sides. The centre of the face is left out
 * so a skin shift does not look like a colour, and a real dye does.
 */
export function hairSample(x: number, y: number, width: number, height: number) {
  const nx = x / Math.max(1, width);
  const ny = y / Math.max(1, height);
  if (ny < 0.38) return true;
  return ny < 0.62 && (nx < 0.22 || nx > 0.78);
}

export async function hairChange(before: Buffer, after: Buffer) {
  const size = 64;
  const [a, b] = await Promise.all([
    sharp(before, { failOn: "none" }).rotate().resize(size, size, { fit: "fill" }).removeAlpha().raw().toBuffer(),
    sharp(after, { failOn: "none" }).rotate().resize(size, size, { fit: "fill" }).removeAlpha().raw().toBuffer(),
  ]);
  let hair = 0;
  let hairN = 0;
  let changed = 0;
  let all = 0;
  let allN = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 3;
      const dr = a[i] - b[i];
      const dg = a[i + 1] - b[i + 1];
      const db = a[i + 2] - b[i + 2];
      const delta = (Math.abs(dr) + Math.abs(dg) + Math.abs(db)) / 3;
      all += delta;
      allN += 1;
      if (hairSample(x, y, size, size)) {
        hair += delta;
        hairN += 1;
        const dCb = Math.abs(-0.168736 * dr - 0.331264 * dg + 0.5 * db);
        const dCr = Math.abs(0.5 * dr - 0.418688 * dg - 0.081312 * db);
        if (delta > HAIR_PIXEL_DELTA || dCb + dCr > HAIR_CHROMA_DELTA) changed += 1;
      }
    }
  }
  const hairDelta = hairN ? hair / hairN : 0;
  const imageDelta = allN ? all / allN : 0;
  const changedFraction = hairN ? changed / hairN : 0;
  return {
    hairDelta,
    imageDelta,
    changedFraction,
    unchanged: hairDelta < HAIR_UNCHANGED_DELTA && imageDelta < HAIR_UNCHANGED_DELTA && changedFraction < HAIR_CHANGED_FRACTION,
  };
}
