"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  largestPortraitCrop,
  moveCrop,
  resizeCrop,
  type CropCorner,
  type CropRect,
} from "@/lib/crop-frame";

const CORNERS: { id: CropCorner; label: string }[] = [
  { id: "nw", label: "Resize crop from the top left" },
  { id: "ne", label: "Resize crop from the top right" },
  { id: "sw", label: "Resize crop from the bottom left" },
  { id: "se", label: "Resize crop from the bottom right" },
];

/** JPEG of the portrait box. Long edge stays at most 1536, matching the selfie the server frames. */
export async function cropImageBlob(source: CanvasImageSource, rect: CropRect) {
  const x = Math.max(0, Math.round(rect.x));
  const y = Math.max(0, Math.round(rect.y));
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const scale = Math.min(1, 1536 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("crop");
  ctx.drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("crop");
  return blob;
}

function PhotoCropDialog({
  src,
  onApply,
  onCancel,
}: {
  src: string;
  onApply: (blob: Blob) => void | Promise<void>;
  onCancel: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const natural = useRef({ w: 0, h: 0 });
  const drag = useRef<{
    id: number;
    mode: "move" | CropCorner;
    x: number;
    y: number;
    rect: CropRect;
  } | null>(null);
  const [rect, setRect] = useState<CropRect | null>(null);
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState("");
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") cancelRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function readImage() {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;
    natural.current = { w: img.naturalWidth, h: img.naturalHeight };
    setRect(largestPortraitCrop(img.naturalWidth, img.naturalHeight));
  }

  function imageScale() {
    const img = imgRef.current;
    const box = img?.getBoundingClientRect();
    if (!img || !box || box.width < 1 || box.height < 1) return { x: 1, y: 1 };
    return { x: natural.current.w / box.width, y: natural.current.h / box.height };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>, mode: "move" | CropCorner) {
    if (!rect) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, mode, x: event.clientX, y: event.clientY, rect };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const scale = imageScale();
    const { w, h } = natural.current;
    if (current.mode === "move") {
      const dx = (event.clientX - current.x) * scale.x;
      const dy = (event.clientY - current.y) * scale.y;
      setRect(moveCrop(current.rect, dx, dy, w, h));
      return;
    }
    const box = imgRef.current?.getBoundingClientRect();
    if (!box) return;
    const px = (event.clientX - box.left) * scale.x;
    const py = (event.clientY - box.top) * scale.y;
    setRect(resizeCrop(current.rect, current.mode, px, py, w, h));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (drag.current?.id === event.pointerId) drag.current = null;
  }

  async function apply() {
    const img = imgRef.current;
    if (!img || !rect || working) return;
    setWorking(true);
    setNote("");
    try {
      const bitmap = await createImageBitmap(img);
      try {
        const blob = await cropImageBlob(bitmap, rect);
        await onApply(blob);
      } finally {
        bitmap.close();
      }
    } catch {
      setNote("That crop did not finish. The original photo is unchanged.");
      setWorking(false);
    }
  }

  const box = rect && natural.current.w
    ? {
        left: `${(rect.x / natural.current.w) * 100}%`,
        top: `${(rect.y / natural.current.h) * 100}%`,
        width: `${(rect.width / natural.current.w) * 100}%`,
        height: `${(rect.height / natural.current.h) * 100}%`,
      }
    : null;

  return (
    <div className="crop-dialog" role="dialog" aria-modal="true" aria-label="Crop photo" data-crop="open">
      <p className="crop-hint">Drag the box to move it. Drag a corner to resize. The shape stays portrait.</p>
      <div className="crop-stage">
        <div className="crop-frame">
          <img ref={imgRef} src={src} alt="" draggable={false} onLoad={readImage} />
          {box ? (
            <div
              className="crop-box"
              style={box}
              onPointerDown={(event) => onPointerDown(event, "move")}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {CORNERS.map((corner) => (
                <button
                  key={corner.id}
                  type="button"
                  className={`crop-handle crop-handle-${corner.id}`}
                  aria-label={corner.label}
                  onPointerDown={(event) => onPointerDown(event, corner.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {note ? <p className="text-sm" role="alert">{note}</p> : null}
      <div className="crop-actions">
        <button className="btn secondary" type="button" onClick={onCancel} disabled={working}>Cancel</button>
        <button className="btn" type="button" onClick={() => void apply()} disabled={!rect || working}>Apply crop</button>
      </div>
    </div>
  );
}

/** Crop control shown once a photo is on screen. Apply replaces that photo. Cancel leaves it. */
export function CropPhotoButton({
  src,
  disabled,
  onApply,
}: {
  src: string;
  disabled?: boolean;
  onApply: (blob: Blob) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn secondary w-full" type="button" data-crop-open="yes" disabled={disabled} onClick={() => setOpen(true)}>
        Crop
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <PhotoCropDialog
              src={src}
              onCancel={() => setOpen(false)}
              onApply={async (blob) => {
                await onApply(blob);
                setOpen(false);
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}
