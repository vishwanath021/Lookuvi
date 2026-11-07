"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { clampPan, toggleZoom, zoomAt, type ZoomFrame, type ZoomView, ZOOM_MIN } from "@/lib/image-zoom";
import { downloadLookFile, lookDownloadName, lookShareMessage } from "@/lib/look-result";

const REST: ZoomView = { scale: ZOOM_MIN, x: 0, y: 0 };

function frameOf(stage: HTMLElement | null, image: HTMLElement | null): ZoomFrame {
  return {
    stageW: Math.max(1, stage?.clientWidth || 1),
    stageH: Math.max(1, stage?.clientHeight || 1),
    contentW: Math.max(1, image?.offsetWidth || stage?.clientWidth || 1),
    contentH: Math.max(1, image?.offsetHeight || stage?.clientHeight || 1),
  };
}

function stagePoint(stage: HTMLElement, clientX: number, clientY: number) {
  const rect = stage.getBoundingClientRect();
  return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
}

export function LookZoom({ src, onClose }: { src: string; onClose: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const viewRef = useRef<ZoomView>(REST);
  const drag = useRef<{ id: number; x: number; y: number; originX: number; originY: number; moved: boolean } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const pinch = useRef<{ distance: number; scale: number; x: number; y: number; midX: number; midY: number } | null>(null);
  const [view, setView] = useState<ZoomView>(REST);

  function commit(next: ZoomView) {
    viewRef.current = next;
    setView(next);
  }

  function frame() {
    return frameOf(stage.current, image.current);
  }

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = stage.current;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
    }
    function midpoint(touches: TouchList) {
      const box = node?.getBoundingClientRect();
      const x = (touches[0].clientX + touches[1].clientX) / 2;
      const y = (touches[0].clientY + touches[1].clientY) / 2;
      if (!box) return { x: 0, y: 0 };
      return { x: x - box.left - box.width / 2, y: y - box.top - box.height / 2 };
    }
    function distance(touches: TouchList) {
      return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    }
    function move(event: TouchEvent) {
      if (event.touches.length < 2) return;
      event.preventDefault();
      drag.current = null;
      const next = distance(event.touches);
      const mid = midpoint(event.touches);
      if (!pinch.current) {
        const current = viewRef.current;
        pinch.current = { distance: next, scale: current.scale, x: current.x, y: current.y, midX: mid.x, midY: mid.y };
        return;
      }
      const start = pinch.current;
      const scale = start.scale * (next / start.distance);
      const localX = (start.midX - start.x) / (start.scale || 1);
      const localY = (start.midY - start.y) / (start.scale || 1);
      commit(clampPan({ scale, x: mid.x - localX * scale, y: mid.y - localY * scale }, frameOf(node, image.current)));
    }
    function end(event: TouchEvent) {
      if (event.touches.length < 2) pinch.current = null;
    }
    function wheel(event: WheelEvent) {
      event.preventDefault();
      const box = node;
      if (!box) return;
      const point = stagePoint(box, event.clientX, event.clientY);
      const factor = Math.exp(-event.deltaY * 0.0015);
      commit(zoomAt(viewRef.current, frameOf(box, image.current), point.x, point.y, viewRef.current.scale * factor));
    }
    window.addEventListener("keydown", onKey);
    node?.addEventListener("touchmove", move, { passive: false });
    node?.addEventListener("touchend", end);
    node?.addEventListener("touchcancel", end);
    node?.addEventListener("wheel", wheel, { passive: false });
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      node?.removeEventListener("touchmove", move);
      node?.removeEventListener("touchend", end);
      node?.removeEventListener("touchcancel", end);
      node?.removeEventListener("wheel", wheel);
    };
  }, []);

  function zoomBy(factor: number) {
    commit(zoomAt(viewRef.current, frame(), 0, 0, viewRef.current.scale * factor));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    if (event.pointerType === "touch" && !event.isPrimary) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, originX: viewRef.current.x, originY: viewRef.current.y, moved: false };
    stage.current?.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId || pinch.current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < 8) return;
    if (viewRef.current.scale <= ZOOM_MIN) return;
    current.moved = true;
    commit(clampPan({ ...viewRef.current, x: current.originX + dx, y: current.originY + dy }, frame()));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (current?.id === event.pointerId) drag.current = null;
    if (!current || current.moved || current.id !== event.pointerId) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const now = Date.now();
    const prev = lastTap.current;
    lastTap.current = { t: now, x: event.clientX, y: event.clientY };
    if (!prev || now - prev.t > 320 || Math.hypot(event.clientX - prev.x, event.clientY - prev.y) > 28) return;
    lastTap.current = null;
    const box = stage.current;
    if (!box) return;
    const point = stagePoint(box, event.clientX, event.clientY);
    commit(toggleZoom(viewRef.current, frame(), point.x, point.y));
  }

  return (
    <div
      ref={stage}
      className="look-zoom"
      role="dialog"
      aria-modal="true"
      aria-label="Zoomed look"
      data-zoom="open"
      data-zoom-scale={view.scale.toFixed(2)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <img
        ref={image}
        src={src}
        alt=""
        draggable={false}
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      />
      <button className="cam-round look-zoom-close" type="button" aria-label="Close" onClick={onClose}>×</button>
      <div className="look-zoom-controls">
        <button className="cam-round" type="button" aria-label="Zoom in" onClick={() => zoomBy(1.25)}>+</button>
        <button className="cam-round" type="button" aria-label="Zoom out" onClick={() => zoomBy(0.8)}>−</button>
      </div>
      <button className="look-zoom-reset" type="button" onClick={() => commit(REST)}>Reset</button>
    </div>
  );
}

/** Chip-sized zoom control. Kept off the compare slider so Before/After can drag. */
export function ResultZoom({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="look-zoom-chip" type="button" aria-label="Zoom photo" data-zoom-chip="yes" onClick={() => setOpen(true)}>
        Zoom
      </button>
      {open && typeof document !== "undefined" ? createPortal(<LookZoom src={src} onClose={() => setOpen(false)} />, document.body) : null}
    </>
  );
}

export function LookResultActions({
  slug,
  name,
  imageUrl,
  shareUrl,
  kind,
}: {
  slug: string;
  name: string;
  imageUrl: string;
  shareUrl?: string;
  kind: "bridal" | "groom";
}) {
  return (
    <div className="grid w-full max-w-[28rem] gap-2" data-result-actions="yes">
      <p className="text-center text-xs text-muted" data-ai-generated="yes">AI-generated preview</p>
      <button
        className="btn"
        type="button"
        onClick={() => void downloadLookFile(imageUrl, lookDownloadName(slug, name))}
      >
        Download
      </button>
      <button
        className="btn secondary"
        type="button"
        onClick={() => {
          const text = lookShareMessage(kind, name, shareUrl);
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
        }}
      >
        Share on WhatsApp
      </button>
    </div>
  );
}

/** After a preview, the large capture buttons give way to a text link. */
export function PhotoActions({ settled, className, children }: { settled: boolean; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!settled) setOpen(false);
  }, [settled]);
  if (settled && !open) {
    return (
      <button className="change-photo" type="button" onClick={() => setOpen(true)}>Change photo</button>
    );
  }
  return <div className={className || "grid w-full max-w-[28rem] gap-2"} data-photo-actions="yes">{children}</div>;
}
