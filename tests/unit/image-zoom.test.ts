import { describe, expect, it } from "vitest";
import { clampPan, toggleZoom, zoomAt, type ZoomFrame, type ZoomView } from "@/lib/image-zoom";

const frame: ZoomFrame = { stageW: 400, stageH: 600, contentW: 400, contentH: 600 };

function imagePoint(view: ZoomView, px: number, py: number) {
  return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
}

describe("image zoom", () => {
  it("keeps the pointer on the same image point", () => {
    const start: ZoomView = { scale: 1, x: 0, y: 0 };
    const point = { x: 120, y: -80 };
    const next = zoomAt(start, frame, point.x, point.y, 2);
    expect(imagePoint(next, point.x, point.y).x).toBeCloseTo(imagePoint(start, point.x, point.y).x, 5);
    expect(imagePoint(next, point.x, point.y).y).toBeCloseTo(imagePoint(start, point.x, point.y).y, 5);
    expect(next.scale).toBe(2);
  });

  it("refuses to pan past the image edges and ignores pan at 100%", () => {
    expect(clampPan({ scale: 1, x: 40, y: -20 }, frame)).toEqual({ scale: 1, x: 0, y: 0 });
    const pushed = clampPan({ scale: 2, x: 999, y: -999 }, frame);
    expect(pushed.x).toBe(200);
    expect(pushed.y).toBe(-300);
    const pinch = zoomAt({ scale: 2, x: 0, y: 0 }, frame, 0, 0, 4);
    expect(Math.abs(pinch.x)).toBeLessThanOrEqual(600);
    expect(Math.abs(pinch.y)).toBeLessThanOrEqual(900);
  });

  it("toggles between 100% and 2× at the tap point", () => {
    const zoomed = toggleZoom({ scale: 1, x: 0, y: 0 }, frame, 40, 20);
    expect(zoomed.scale).toBe(2);
    expect(imagePoint(zoomed, 40, 20).x).toBeCloseTo(40, 5);
    expect(toggleZoom(zoomed, frame, 40, 20)).toEqual({ scale: 1, x: 0, y: 0 });
  });
});
