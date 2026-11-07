/**
 * Portrait crop locked to 3:4 (width / height).
 * That is the guest camera frame (`visiblePortraitCrop`) and it lands on the
 * 1024×1360 edit canvas: 1024 / 1360 is within 2% of 3/4, which is the slack
 * `ownLookFrameSize` uses before it asks for that size.
 */
export const PORTRAIT_CROP_RATIO = 3 / 4;

export type CropRect = { x: number; y: number; width: number; height: number };
export type CropCorner = "nw" | "ne" | "sw" | "se";

export function largestPortraitCrop(imageW: number, imageH: number): CropRect {
  const w = Math.max(1, imageW);
  const h = Math.max(1, imageH);
  if (w / h > PORTRAIT_CROP_RATIO) {
    const width = h * PORTRAIT_CROP_RATIO;
    return { x: (w - width) / 2, y: 0, width, height: h };
  }
  const height = w / PORTRAIT_CROP_RATIO;
  return { x: 0, y: (h - height) / 2, width: w, height };
}

function minimumWidth(imageW: number, imageH: number) {
  const largest = largestPortraitCrop(imageW, imageH).width;
  return Math.min(largest, Math.max(48, largest * 0.2));
}

/** Keep a 3:4 box inside the photo. Position is clamped after the size is fit. */
export function fitCrop(rect: CropRect, imageW: number, imageH: number): CropRect {
  const maxW = Math.max(1, imageW);
  const maxH = Math.max(1, imageH);
  let width = Math.max(1, rect.width);
  let height = width / PORTRAIT_CROP_RATIO;
  const scale = Math.min(1, maxW / width, maxH / height);
  width *= scale;
  height = width / PORTRAIT_CROP_RATIO;
  const min = minimumWidth(maxW, maxH);
  if (width < min) {
    width = min;
    height = width / PORTRAIT_CROP_RATIO;
  }
  const x = Math.min(Math.max(0, rect.x), Math.max(0, maxW - width));
  const y = Math.min(Math.max(0, rect.y), Math.max(0, maxH - height));
  return { x, y, width, height };
}

export function moveCrop(rect: CropRect, dx: number, dy: number, imageW: number, imageH: number) {
  return fitCrop({ ...rect, x: rect.x + dx, y: rect.y + dy }, imageW, imageH);
}

/**
 * Resize from a corner. The opposite corner stays put, and the box stays 3:4.
 * pointerX/pointerY are image pixels.
 */
export function resizeCrop(
  start: CropRect,
  corner: CropCorner,
  pointerX: number,
  pointerY: number,
  imageW: number,
  imageH: number,
): CropRect {
  const anchorX = corner === "se" || corner === "ne" ? start.x : start.x + start.width;
  const anchorY = corner === "se" || corner === "sw" ? start.y : start.y + start.height;
  const widthFromX = Math.abs(pointerX - anchorX);
  const widthFromY = Math.abs(pointerY - anchorY) * PORTRAIT_CROP_RATIO;
  const width = Math.max(widthFromX, widthFromY);
  const height = width / PORTRAIT_CROP_RATIO;
  const x = corner === "nw" || corner === "sw" ? anchorX - width : anchorX;
  const y = corner === "nw" || corner === "ne" ? anchorY - height : anchorY;
  return fitCrop({ x, y, width, height }, imageW, imageH);
}
