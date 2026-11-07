import { describe, expect, it } from "vitest";
import { fitCrop, largestPortraitCrop, moveCrop, PORTRAIT_CROP_RATIO, resizeCrop } from "@/lib/crop-frame";

describe("portrait crop", () => {
  it("starts as the largest 3:4 box inside the photo", () => {
    const wide = largestPortraitCrop(1600, 900);
    expect(wide.width / wide.height).toBeCloseTo(PORTRAIT_CROP_RATIO, 5);
    expect(wide.height).toBe(900);
    expect(wide.x).toBeCloseTo((1600 - wide.width) / 2, 5);
    const tall = largestPortraitCrop(800, 1600);
    expect(tall.width).toBe(800);
    expect(tall.width / tall.height).toBeCloseTo(PORTRAIT_CROP_RATIO, 5);
    expect(tall.y).toBeGreaterThan(0);
  });

  it("moves inside the photo and resizes from a corner without leaving 3:4", () => {
    const start = largestPortraitCrop(1200, 1600);
    const shrunk = resizeCrop(start, "se", start.x + start.width * 0.6, start.y + start.height * 0.6, 1200, 1600);
    const moved = moveCrop(shrunk, 40, 30, 1200, 1600);
    expect(moved.x).toBeCloseTo(shrunk.x + 40, 5);
    expect(moved.y).toBeCloseTo(shrunk.y + 30, 5);
    expect(moved.x + moved.width).toBeLessThanOrEqual(1200);
    expect(moved.width / moved.height).toBeCloseTo(PORTRAIT_CROP_RATIO, 5);
    expect(shrunk.width).toBeLessThan(start.width);
    expect(shrunk.width / shrunk.height).toBeCloseTo(PORTRAIT_CROP_RATIO, 5);
    expect(shrunk.x).toBeCloseTo(start.x, 5);
    expect(shrunk.y).toBeCloseTo(start.y, 5);
    const fitted = fitCrop({ x: -20, y: 5000, width: 9000, height: 10 }, 1000, 1000);
    expect(fitted.x).toBeGreaterThanOrEqual(0);
    expect(fitted.y).toBeGreaterThanOrEqual(0);
    expect(fitted.x + fitted.width).toBeLessThanOrEqual(1000.01);
    expect(fitted.y + fitted.height).toBeLessThanOrEqual(1000.01);
    expect(fitted.width / fitted.height).toBeCloseTo(PORTRAIT_CROP_RATIO, 5);
  });
});
