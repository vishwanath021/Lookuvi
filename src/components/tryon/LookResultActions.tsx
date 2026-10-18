"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { downloadLookFile, lookDownloadName, lookShareMessage } from "@/lib/look-result";

function clampScale(value: number) {
  return Math.min(4, Math.max(1, Math.round(value * 100) / 100));
}

export function LookZoom({ src, onClose }: { src: string; onClose: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const scaleRef = useRef(1);
  const [scale, setScale] = useState(1);

  function apply(next: number) {
    const clamped = clampScale(next);
    scaleRef.current = clamped;
    setScale(clamped);
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
    function distance(touches: TouchList) {
      return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    }
    function move(event: TouchEvent) {
      if (event.touches.length < 2) return;
      event.preventDefault();
      const next = distance(event.touches);
      if (!pinch.current) {
        pinch.current = { distance: next, scale: scaleRef.current };
        return;
      }
      apply(pinch.current.scale * (next / pinch.current.distance));
    }
    function end(event: TouchEvent) {
      if (event.touches.length < 2) pinch.current = null;
    }
    function wheel(event: WheelEvent) {
      event.preventDefault();
      apply(scaleRef.current + (event.deltaY < 0 ? 0.25 : -0.25));
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

  return (
    <div ref={stage} className="look-zoom" role="dialog" aria-modal="true" aria-label="Zoomed look" data-zoom="open">
      <img src={src} alt="" draggable={false} style={{ transform: `scale(${scale})` }} />
      <button className="cam-round look-zoom-close" type="button" aria-label="Close" onClick={onClose}>×</button>
      <div className="look-zoom-controls">
        <button className="cam-round" type="button" aria-label="Zoom in" onClick={() => apply(scale + 0.25)}>+</button>
        <button className="cam-round" type="button" aria-label="Zoom out" onClick={() => apply(scale - 0.25)}>−</button>
      </div>
    </div>
  );
}

/** Tap the portrait to open the same zoom controls the live studio uses. */
export function ResultZoom({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="look-zoom-hit" type="button" aria-label="Zoom photo" onClick={() => setOpen(true)}>
        <span className="look-zoom-chip">Zoom</span>
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
