import { FACE_EDGE_LEFT, FACE_EDGE_RIGHT } from "@/lib/makeup-studio/core/regions";
import type { FacePoint } from "@/lib/makeup-studio/core/types";

export function pointPx(point: FacePoint | undefined, width: number, height: number) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return { x: point.x * width, y: point.y * height };
}

/** Distance between the two cheek edges, in pixels. Masks scale from this. */
export function faceWidthPx(points: readonly FacePoint[], width: number, height: number) {
  const a = points[FACE_EDGE_RIGHT];
  const b = points[FACE_EDGE_LEFT];
  if (!a || !b) return Math.min(width, height) * 0.42;
  const dx = (a.x - b.x) * width;
  const dy = (a.y - b.y) * height;
  const span = Math.hypot(dx, dy);
  return span > 8 ? span : Math.min(width, height) * 0.42;
}
