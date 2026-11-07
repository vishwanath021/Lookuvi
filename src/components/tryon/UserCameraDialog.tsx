"use client";

import { useEffect, useRef, useState } from "react";

/** Front camera for Take photo. Upload stays on a separate file input. */
export function UserCameraDialog({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (blob: Blob) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let stop = false;
    const devices = navigator.mediaDevices;
    if (!window.isSecureContext || !devices?.getUserMedia) {
      setError("The camera is not available here. Use Upload instead.");
      return;
    }
    const pending = devices.getUserMedia({ video: { facingMode: "user" } });
    void pending.then(async (stream) => {
      if (stop) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      setReady(true);
    }).catch(() => {
      if (!stop) setError("Camera permission was denied. Allow the camera, or use Upload.");
    });
    return () => {
      stop = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setReady(false);
    };
  }, [open]);

  async function shoot() {
    const video = videoRef.current;
    if (!video) return;
    const width = video.videoWidth || 720;
    const height = video.videoHeight || 960;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1024 / Math.max(width, height));
    canvas.width = Math.max(2, Math.round(width * scale));
    canvas.height = Math.max(2, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return;
    onCapture(blob);
    onClose();
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Take photo" data-user-camera="open">
      <div className="grid w-full max-w-sm gap-3">
        <video ref={videoRef} className="aspect-[3/4] w-full rounded-xl bg-black object-cover" autoPlay muted playsInline data-facing="user" />
        {error ? <p className="text-sm text-white" role="alert">{error}</p> : null}
        <div className="flex gap-2">
          <button className="btn flex-1" type="button" disabled={!ready} onClick={() => void shoot()}>Take photo</button>
          <button className="btn secondary flex-1" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
