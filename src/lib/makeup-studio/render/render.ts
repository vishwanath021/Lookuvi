import type { FacePoint, LookParams } from "@/lib/makeup-studio/core/types";
import { blitCanvas, compositeCanvas, compositeWebgl } from "@/lib/makeup-studio/render/composite";
import { buildLayers, outputSize } from "@/lib/makeup-studio/render/layers";

export type RenderInput = {
  canvas: HTMLCanvasElement;
  image: CanvasImageSource;
  landmarks: readonly FacePoint[];
  params: LookParams;
  skinMask?: Uint8Array | null;
  skinMaskWidth?: number;
  skinMaskHeight?: number;
};

function paint2d(canvas: HTMLCanvasElement, layers: ReturnType<typeof buildLayers>) {
  const off = document.createElement("canvas");
  off.width = layers.width;
  off.height = layers.height;
  const ctx = off.getContext("2d");
  if (!ctx) throw new Error("canvas");
  compositeCanvas(ctx, layers);
  return off;
}

/**
 * Draw one still. WebGL2 composites the masks. Canvas2D is the fallback.
 * Call again with the same landmarks when a slider moves. Detection is not repeated here.
 */
export function renderMakeup(input: RenderInput): "webgl2" | "canvas2d" {
  const size = outputSize(input.image, input.params);
  if (!size.width || !size.height || input.landmarks.length < 300) throw new Error("makeup");
  const canvas = input.canvas;
  if (canvas.width !== size.width) canvas.width = size.width;
  if (canvas.height !== size.height) canvas.height = size.height;
  const layers = buildLayers(
    input.image,
    input.landmarks,
    input.params,
    input.skinMask ?? null,
    input.skinMaskWidth ?? 0,
    input.skinMaskHeight ?? 0,
  );
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
    alpha: false,
    antialias: false,
  });
  if (gl) {
    try {
      compositeWebgl(gl, layers);
      return "webgl2";
    } catch {
      const backup = paint2d(canvas, layers);
      blitCanvas(gl, backup);
      return "canvas2d";
    }
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  compositeCanvas(ctx, layers);
  return "canvas2d";
}
