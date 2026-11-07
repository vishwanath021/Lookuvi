/** View of an image inside a stage. x/y translate the image center, in stage pixels. */
export type ZoomView = { scale: number; x: number; y: number };

export type ZoomFrame = {
  stageW: number;
  stageH: number;
  /** Layout size of the image before the zoom transform. */
  contentW: number;
  contentH: number;
};

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
export const ZOOM_TOGGLE = 2;

export function clampScale(scale: number) {
  if (!Number.isFinite(scale)) return ZOOM_MIN;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(scale * 1000) / 1000));
}

/** How far the image center may move before an edge crosses the stage. */
export function panLimits(scale: number, frame: ZoomFrame) {
  const next = clampScale(scale);
  const maxX = Math.max(0, (frame.contentW * next - frame.stageW) / 2);
  const maxY = Math.max(0, (frame.contentH * next - frame.stageH) / 2);
  return { maxX, maxY };
}

export function clampPan(view: ZoomView, frame: ZoomFrame): ZoomView {
  const scale = clampScale(view.scale);
  if (scale <= ZOOM_MIN) return { scale: ZOOM_MIN, x: 0, y: 0 };
  const { maxX, maxY } = panLimits(scale, frame);
  const x = Number.isFinite(view.x) ? view.x : 0;
  const y = Number.isFinite(view.y) ? view.y : 0;
  return {
    scale,
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  };
}

/**
 * Change scale while the stage point (px, py) — measured from the stage center —
 * stays on the same point of the image. The result is clamped inside the image edges.
 */
export function zoomAt(view: ZoomView, frame: ZoomFrame, px: number, py: number, nextScale: number): ZoomView {
  const scale = clampScale(nextScale);
  const current = view.scale > 0 ? view.scale : ZOOM_MIN;
  const localX = (px - view.x) / current;
  const localY = (py - view.y) / current;
  return clampPan({ scale, x: px - localX * scale, y: py - localY * scale }, frame);
}

/** Double-tap and double-click: 100% returns to the point at 2×, anything above returns to 100%. */
export function toggleZoom(view: ZoomView, frame: ZoomFrame, px: number, py: number): ZoomView {
  if (view.scale > ZOOM_MIN + 0.01) return { scale: ZOOM_MIN, x: 0, y: 0 };
  return zoomAt({ scale: ZOOM_MIN, x: 0, y: 0 }, frame, px, py, ZOOM_TOGGLE);
}
