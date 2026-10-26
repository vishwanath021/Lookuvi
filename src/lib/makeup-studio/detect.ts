"use client";

import type { FaceLandmarker, ImageSegmenter } from "@mediapipe/tasks-vision";
import type { FacePoint } from "@/lib/makeup-studio/core/types";
import { hushMediapipeInfo } from "@/lib/face/detect-client";

export type StudioFace = {
  landmarks: FacePoint[];
  skinMask: Uint8Array | null;
  maskWidth: number;
  maskHeight: number;
};

type Vision = {
  landmarker: FaceLandmarker;
  segmenter: ImageSegmenter | null;
};

let loading: Promise<Vision | null> | null = null;

async function vision(): Promise<Vision | null> {
  if (!loading) {
    loading = (async () => {
      try {
        hushMediapipeInfo();
        const tasks = await import("@mediapipe/tasks-vision");
        const files = await tasks.FilesetResolver.forVisionTasks("/mediapipe/wasm");
        const face = {
          runningMode: "IMAGE" as const,
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        };
        const createFace = (delegate: "GPU" | "CPU") =>
          tasks.FaceLandmarker.createFromOptions(files, {
            baseOptions: { modelAssetPath: "/mediapipe/face-landmarker", delegate },
            ...face,
          });
        let landmarker: FaceLandmarker;
        try {
          landmarker = await createFace("GPU");
        } catch {
          landmarker = await createFace("CPU");
        }
        const segOptions = {
          runningMode: "IMAGE" as const,
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        };
        const createSeg = (delegate: "GPU" | "CPU") =>
          tasks.ImageSegmenter.createFromOptions(files, {
            baseOptions: { modelAssetPath: "/mediapipe/selfie-multiclass", delegate },
            ...segOptions,
          });
        let segmenter: Vision["segmenter"] = null;
        try {
          segmenter = await createSeg("GPU");
        } catch {
          try {
            segmenter = await createSeg("CPU");
          } catch {
            segmenter = null;
          }
        }
        return { landmarker, segmenter };
      } catch {
        return null;
      }
    })();
  }
  return loading;
}

function drawFit(source: CanvasImageSource, edge: number) {
  const width = source instanceof HTMLVideoElement
    ? source.videoWidth
    : source instanceof HTMLImageElement
      ? source.naturalWidth
      : source instanceof HTMLCanvasElement
        ? source.width
        : 0;
  const height = source instanceof HTMLVideoElement
    ? source.videoHeight
    : source instanceof HTMLImageElement
      ? source.naturalHeight
      : source instanceof HTMLCanvasElement
        ? source.height
        : 0;
  if (!width || !height) return null;
  const scale = Math.min(1, edge / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * One still-photo pass. IMAGE mode, one face, self-hosted wasm and model.
 * The skin mask is optional. A missing segmenter still returns landmarks.
 */
export async function detectStudioFace(source: CanvasImageSource): Promise<StudioFace | null> {
  if (typeof document === "undefined") return null;
  const models = await vision();
  if (!models) return null;
  const frame = drawFit(source, 1024);
  if (!frame) return null;
  try {
    const found = models.landmarker.detect(frame).faceLandmarks?.[0];
    if (!found || found.length < 300) return null;
    const landmarks = found.map((point) => ({ x: point.x, y: point.y, z: point.z }));
    let skinMask: Uint8Array | null = null;
    let maskWidth = 0;
    let maskHeight = 0;
    if (models.segmenter) {
      try {
        const result = models.segmenter.segment(frame);
        try {
          const mask = result.categoryMask;
          if (mask && mask.width > 1 && mask.height > 1) {
            skinMask = mask.getAsUint8Array().slice();
            maskWidth = mask.width;
            maskHeight = mask.height;
          }
        } finally {
          result.close();
        }
      } catch {
        skinMask = null;
      }
    }
    return { landmarks, skinMask, maskWidth, maskHeight };
  } catch {
    return null;
  }
}
