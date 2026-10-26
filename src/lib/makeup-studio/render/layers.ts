import { faceWidthPx } from "@/lib/makeup-studio/core/geometry";
import { paintRecipe, qualitySpec } from "@/lib/makeup-studio/core/params";
import { BLUSH_HEX, LINER_HEX, SHEEN_HEX } from "@/lib/makeup-studio/core/palette";
import {
  BROW_LEFT,
  BROW_RIGHT,
  CHEEK_LEFT,
  CHEEK_RIGHT,
  CHIN,
  EYE_OPEN_LEFT,
  EYE_OPEN_RIGHT,
  FOREHEAD,
  LASH_LOWER_LEFT,
  LASH_LOWER_RIGHT,
  LASH_UPPER_LEFT,
  LASH_UPPER_RIGHT,
  LIP_INNER,
  LIP_LOWER,
  LIP_OUTER,
  NOSE_BRIDGE,
  NOSE_TIP,
  SHADOW_LEFT,
  SHADOW_RIGHT,
  SKIN_OVAL,
} from "@/lib/makeup-studio/core/regions";
import type { FacePoint, LookParams } from "@/lib/makeup-studio/core/types";
import type { PaintRecipe } from "@/lib/makeup-studio/core/params";

/** MediaPipe selfie multiclass labels. Face skin is 3, body skin is 2. */
export const FACE_SKIN_CLASS = 3;
export const BODY_SKIN_CLASS = 2;

export type MakeupLayers = {
  width: number;
  height: number;
  photo: HTMLCanvasElement;
  blurred: HTMLCanvasElement;
  skin: HTMLCanvasElement;
  blush: HTMLCanvasElement;
  eyes: HTMLCanvasElement;
  lips: HTMLCanvasElement;
  sheen: HTMLCanvasElement;
  detail: HTMLCanvasElement;
  recipe: PaintRecipe;
};

type Bag = MakeupLayers & { scratch: HTMLCanvasElement };

let bag: Bag | null = null;

function fresh(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function lease(width: number, height: number): Bag {
  if (!bag || bag.width !== width || bag.height !== height) {
    bag = {
      width,
      height,
      photo: fresh(width, height),
      blurred: fresh(width, height),
      skin: fresh(width, height),
      blush: fresh(width, height),
      eyes: fresh(width, height),
      lips: fresh(width, height),
      sheen: fresh(width, height),
      detail: fresh(width, height),
      scratch: fresh(width, height),
      recipe: paintRecipe({ foundation: 0, blush: 0, intensity: 0, lip: "nude", eyes: "natural", finish: "satin", quality: "balanced", gloss: false }, 1),
    };
  }
  return bag;
}

function ctx2d(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  return ctx;
}

function clear(canvas: HTMLCanvasElement) {
  const ctx = ctx2d(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

type Px = { x: number; y: number };

function ring(points: readonly FacePoint[], indexes: readonly number[], width: number, height: number): Px[] {
  const out: Px[] = [];
  for (const index of indexes) {
    const point = points[index];
    if (!point) continue;
    out.push({ x: point.x * width, y: point.y * height });
  }
  return out;
}

function trace(ctx: CanvasRenderingContext2D, poly: Px[], close = true) {
  if (poly.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i].x, poly[i].y);
  if (close) ctx.closePath();
}

function fillRing(ctx: CanvasRenderingContext2D, poly: Px[]) {
  if (poly.length < 3) return;
  trace(ctx, poly);
  ctx.fill();
}

function sourceSize(image: CanvasImageSource) {
  if (image instanceof HTMLVideoElement) return { width: image.videoWidth, height: image.videoHeight };
  if (image instanceof HTMLImageElement) return { width: image.naturalWidth, height: image.naturalHeight };
  if (image instanceof HTMLCanvasElement) return { width: image.width, height: image.height };
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) return { width: image.width, height: image.height };
  return { width: 0, height: 0 };
}

export function outputSize(image: CanvasImageSource, params: LookParams) {
  const source = sourceSize(image);
  const edge = qualitySpec(params.quality).maxEdge;
  const long = Math.max(source.width, source.height);
  if (!long) return { width: 0, height: 0 };
  const scale = Math.min(1, edge / long);
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  };
}

function withAlpha(hex: string, alpha: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function blurOnto(from: HTMLCanvasElement, onto: HTMLCanvasElement, radius: number) {
  const ctx = clear(onto);
  ctx.filter = radius > 0.4 ? `blur(${radius}px)` : "none";
  ctx.drawImage(from, 0, 0);
  ctx.filter = "none";
}

function paintSkin(
  skin: HTMLCanvasElement,
  scratch: HTMLCanvasElement,
  points: readonly FacePoint[],
  mask: Uint8Array | null,
  maskWidth: number,
  maskHeight: number,
  feather: number,
) {
  const width = skin.width;
  const height = skin.height;
  const ctx = clear(skin);
  const oval = ring(points, SKIN_OVAL, width, height);
  let usedMask = false;
  if (mask && maskWidth > 1 && maskHeight > 1 && mask.length >= maskWidth * maskHeight) {
    const image = ctx.createImageData(width, height);
    const data = image.data;
    let hits = 0;
    for (let y = 0; y < height; y += 1) {
      const sy = Math.min(maskHeight - 1, (y * maskHeight / height) | 0);
      for (let x = 0; x < width; x += 1) {
        const sx = Math.min(maskWidth - 1, (x * maskWidth / width) | 0);
        const cls = mask[sy * maskWidth + sx];
        if (cls !== FACE_SKIN_CLASS && cls !== BODY_SKIN_CLASS) continue;
        const i = (y * width + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
        hits += 1;
      }
    }
    if (hits > width * height * 0.01) {
      ctx.putImageData(image, 0, 0);
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "#fff";
      fillRing(ctx, oval);
      ctx.globalCompositeOperation = "source-over";
      usedMask = true;
    }
  }
  if (!usedMask) {
    ctx.fillStyle = "#fff";
    fillRing(ctx, oval);
  }
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#fff";
  for (const indexes of [EYE_OPEN_RIGHT, EYE_OPEN_LEFT, LIP_OUTER, BROW_RIGHT, BROW_LEFT]) {
    fillRing(ctx, ring(points, indexes, width, height));
  }
  ctx.globalCompositeOperation = "source-over";
  blurOnto(skin, scratch, feather);
  const back = clear(skin);
  back.drawImage(scratch, 0, 0);
}

function radial(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, hex: string, alpha: number) {
  if (radius < 1 || alpha <= 0) return;
  const gradient = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius);
  gradient.addColorStop(0, withAlpha(hex, alpha));
  gradient.addColorStop(0.45, withAlpha(hex, alpha * 0.42));
  gradient.addColorStop(1, withAlpha(hex, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function paintLashes(ctx: CanvasRenderingContext2D, poly: Px[], length: number, width: number) {
  if (poly.length < 3 || length < 1) return;
  let cx = 0;
  let cy = 0;
  for (const point of poly) {
    cx += point.x;
    cy += point.y;
  }
  cx /= poly.length;
  cy /= poly.length;
  ctx.strokeStyle = LINER_HEX;
  ctx.lineCap = "round";
  for (let i = 0; i < poly.length - 1; i += 1) {
    const a = poly[i];
    const b = poly[i + 1];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const span = Math.hypot(dx, dy) || 1;
    let px = -dy / span;
    let py = dx / span;
    if (px * (mx - cx) + py * (my - cy) < 0) {
      px = -px;
      py = -py;
    }
    const reach = length * (0.72 + (i % 3) * 0.14);
    ctx.lineWidth = Math.max(0.7, width);
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + px * reach, my + py * reach * 0.92);
    ctx.stroke();
  }
}

function paintLiner(ctx: CanvasRenderingContext2D, poly: Px[], width: number, wing: boolean) {
  if (poly.length < 3) return;
  ctx.strokeStyle = LINER_HEX;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  trace(ctx, poly, false);
  if (wing) {
    const a = poly[0];
    const b = poly[1];
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const span = Math.hypot(dx, dy) || 1;
    const reach = width * 4.2;
    ctx.lineTo(a.x + (dx / span) * reach, a.y + (dy / span) * reach - reach * 0.45);
  }
  ctx.stroke();
}

function paintLips(lips: HTMLCanvasElement, scratch: HTMLCanvasElement, points: readonly FacePoint[], feather: number, hex: string) {
  const width = lips.width;
  const height = lips.height;
  const scratchCtx = clear(scratch);
  const outer = ring(points, LIP_OUTER, width, height);
  const inner = ring(points, LIP_INNER, width, height);
  scratchCtx.fillStyle = hex;
  scratchCtx.beginPath();
  if (outer.length >= 3) {
    scratchCtx.moveTo(outer[0].x, outer[0].y);
    for (let i = 1; i < outer.length; i += 1) scratchCtx.lineTo(outer[i].x, outer[i].y);
    scratchCtx.closePath();
  }
  if (inner.length >= 3) {
    scratchCtx.moveTo(inner[0].x, inner[0].y);
    for (let i = 1; i < inner.length; i += 1) scratchCtx.lineTo(inner[i].x, inner[i].y);
    scratchCtx.closePath();
  }
  scratchCtx.fill("evenodd");
  blurOnto(scratch, lips, feather);
}

/**
 * Raster masks for one frame. The WebGL and Canvas2D compositors both consume these.
 * Skin uses the segmenter when it covers the face, otherwise the face oval.
 */
export function buildLayers(
  image: CanvasImageSource,
  points: readonly FacePoint[],
  params: LookParams,
  skinMask: Uint8Array | null,
  maskWidth: number,
  maskHeight: number,
): MakeupLayers {
  const size = outputSize(image, params);
  if (!size.width || !size.height) throw new Error("photo");
  const layers = lease(size.width, size.height);
  const photo = clear(layers.photo);
  photo.imageSmoothingQuality = "high";
  photo.drawImage(image, 0, 0, size.width, size.height);
  const span = faceWidthPx(points, size.width, size.height);
  const recipe = paintRecipe(params, span);
  layers.recipe = recipe;
  blurOnto(layers.photo, layers.blurred, recipe.blurPx);
  paintSkin(layers.skin, layers.scratch, points, skinMask, maskWidth, maskHeight, recipe.featherPx);

  const blush = clear(layers.blush);
  const radius = span * 0.2;
  for (const index of [CHEEK_RIGHT, CHEEK_LEFT]) {
    const point = points[index];
    if (!point) continue;
    radial(blush, point.x * size.width, point.y * size.height - span * 0.03, radius, BLUSH_HEX, recipe.blushAlpha);
  }

  const eyeScratch = clear(layers.scratch);
  eyeScratch.fillStyle = withAlpha(recipe.shadow, recipe.shadowAlpha);
  fillRing(eyeScratch, ring(points, SHADOW_RIGHT, size.width, size.height));
  fillRing(eyeScratch, ring(points, SHADOW_LEFT, size.width, size.height));
  if (recipe.cut) {
    eyeScratch.fillStyle = withAlpha(recipe.lid, Math.min(0.92, recipe.shadowAlpha + 0.25));
    fillRing(eyeScratch, ring(points, EYE_OPEN_RIGHT, size.width, size.height));
    fillRing(eyeScratch, ring(points, EYE_OPEN_LEFT, size.width, size.height));
  }
  blurOnto(layers.scratch, layers.eyes, recipe.featherPx * 0.85);

  paintLips(layers.lips, layers.scratch, points, Math.max(0.6, recipe.featherPx * 0.35), recipe.lip);

  const sheen = clear(layers.sheen);
  if (recipe.highlight > 0) {
    const spots: { index: number; scale: number; lift: number }[] = [
      { index: NOSE_TIP, scale: 0.16, lift: 1 },
      { index: FOREHEAD, scale: 0.22, lift: 0.72 },
      { index: CHIN, scale: 0.14, lift: 0.4 },
      { index: CHEEK_RIGHT, scale: 0.12, lift: 0.5 },
      { index: CHEEK_LEFT, scale: 0.12, lift: 0.5 },
    ];
    if (recipe.highlight > 0.28) spots.push({ index: NOSE_BRIDGE, scale: 0.1, lift: 0.85 });
    for (const spot of spots) {
      const point = points[spot.index];
      if (!point) continue;
      radial(sheen, point.x * size.width, point.y * size.height, span * spot.scale, SHEEN_HEX, recipe.highlight * spot.lift);
    }
  }
  if (recipe.gloss > 0) {
    const lower = points[LIP_LOWER];
    const right = points[61];
    const left = points[291];
    if (lower && right && left) {
      const luma = sampleLuma(layers.photo, lower.x * size.width, lower.y * size.height);
      const gloss = recipe.gloss * (0.55 + 0.45 * luma);
      const rx = Math.abs(left.x - right.x) * size.width * 0.22;
      const ry = Math.max(2, span * 0.018);
      const gradient = sheen.createRadialGradient(lower.x * size.width, lower.y * size.height, 0, lower.x * size.width, lower.y * size.height, Math.max(rx, ry));
      gradient.addColorStop(0, withAlpha("#FFFFFF", gloss));
      gradient.addColorStop(1, withAlpha("#FFFFFF", 0));
      sheen.fillStyle = gradient;
      sheen.beginPath();
      sheen.ellipse(lower.x * size.width, lower.y * size.height, Math.max(2, rx), Math.max(2, ry), 0, 0, Math.PI * 2);
      sheen.fill();
    }
  }

  const detail = clear(layers.detail);
  const upperRight = ring(points, LASH_UPPER_RIGHT, size.width, size.height);
  const upperLeft = ring(points, LASH_UPPER_LEFT, size.width, size.height);
  paintLiner(detail, upperRight, recipe.linerWidth, recipe.linerWidth > span * 0.007);
  paintLiner(detail, upperLeft, recipe.linerWidth, recipe.linerWidth > span * 0.007);
  paintLashes(detail, upperRight, recipe.lashLength, recipe.linerWidth * 0.45);
  paintLashes(detail, upperLeft, recipe.lashLength, recipe.linerWidth * 0.45);
  if (recipe.lowerLash) {
    paintLashes(detail, ring(points, LASH_LOWER_RIGHT, size.width, size.height), recipe.lashLength * 0.45, recipe.linerWidth * 0.3);
    paintLashes(detail, ring(points, LASH_LOWER_LEFT, size.width, size.height), recipe.lashLength * 0.45, recipe.linerWidth * 0.3);
  }
  return layers;
}

function sampleLuma(photo: HTMLCanvasElement, x: number, y: number) {
  const ctx = photo.getContext("2d");
  if (!ctx) return 0.5;
  const px = Math.max(0, Math.min(photo.width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(photo.height - 1, Math.round(y)));
  const pixel = ctx.getImageData(px, py, 1, 1).data;
  return (pixel[0] * 0.2126 + pixel[1] * 0.7152 + pixel[2] * 0.0722) / 255;
}
