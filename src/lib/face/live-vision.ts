/**
 * Shared on-device models for the live look.
 * The face landmarker runs in VIDEO mode with the GPU delegate, then CPU if the GPU build fails.
 * Callers pass a 480p frame and a rising timestamp so each camera frame can be tracked.
 */

import type { FaceLandmarker, ImageSegmenter } from "@mediapipe/tasks-vision";
import { hushMediapipeInfo } from "@/lib/face/detect-client";
import type { Pt } from "@/lib/face/makeup-paint";

export const LIVE_FACE_MODE = "VIDEO" as const;
export const LIVE_FACE_DELEGATE = "GPU" as const;

export type LiveVision = {
  landmarker: FaceLandmarker;
  segmenter: ImageSegmenter | null;
};

let pending: Promise<LiveVision | null> | null = null;

export function loadLiveVision(): Promise<LiveVision | null> {
  if (!pending) {
    pending = (async () => {
      try {
        hushMediapipeInfo();
        const vision = await import("@mediapipe/tasks-vision");
        const files = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
        const face = {
          runningMode: LIVE_FACE_MODE,
          numFaces: 1,
          minFaceDetectionConfidence: 0.3,
          minFacePresenceConfidence: 0.3,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        };
        const createFace = (delegate: "GPU" | "CPU") =>
          vision.FaceLandmarker.createFromOptions(files, {
            baseOptions: { modelAssetPath: "/mediapipe/face-landmarker", delegate },
            ...face,
          });
        let landmarker: FaceLandmarker;
        try {
          landmarker = await createFace(LIVE_FACE_DELEGATE);
        } catch {
          landmarker = await createFace("CPU");
        }
        const seg = {
          runningMode: "IMAGE" as const,
          outputCategoryMask: true,
          outputConfidenceMasks: true,
        };
        const createSeg = (delegate: "GPU" | "CPU") =>
          vision.ImageSegmenter.createFromOptions(files, {
            baseOptions: { modelAssetPath: "/mediapipe/selfie-multiclass", delegate },
            ...seg,
          });
        let segmenter: ImageSegmenter | null = null;
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
  return pending;
}

let videoStamp = 0;

/** VIDEO mode rejects a repeated timestamp. This clock only moves forward. */
export function nextVideoStamp(now = typeof performance === "undefined" ? 0 : performance.now()) {
  videoStamp = Math.max(videoStamp + 1, now);
  return videoStamp;
}

export function detectLiveFace(landmarker: FaceLandmarker, frame: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement, now?: number) {
  const found = landmarker.detectForVideo(frame, nextVideoStamp(now)).faceLandmarks[0] as Pt[] | undefined;
  return found && found.length > 454 ? found : undefined;
}

/** Downscale a camera or still so detection and the shader share one frame. */
export function copySource(source: CanvasImageSource, sample: HTMLCanvasElement, longEdge: number) {
  const sw = source instanceof HTMLVideoElement
    ? source.videoWidth
    : source instanceof HTMLImageElement
      ? source.naturalWidth
      : (source as HTMLCanvasElement).width;
  const sh = source instanceof HTMLVideoElement
    ? source.videoHeight
    : source instanceof HTMLImageElement
      ? source.naturalHeight
      : (source as HTMLCanvasElement).height;
  if (!sw || !sh) return null;
  const fit = Math.min(1, longEdge / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * fit));
  const height = Math.max(1, Math.round(sh * fit));
  if (sample.width !== width) sample.width = width;
  if (sample.height !== height) sample.height = height;
  const ctx = sample.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);
  return sample;
}
