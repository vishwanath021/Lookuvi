"use client";

import { useEffect, useRef, useState } from "react";

export type WearSlot = {
  id: string;
  label: string;
  subtitle?: string;
  optional?: boolean;
};

type Shot = { url: string };

export function WearTiles({
  slots,
  shots,
  arm,
  onFile,
  onRemove,
}: {
  slots: readonly WearSlot[];
  shots: Partial<Record<string, Shot | undefined>>;
  arm: (action: () => void) => void;
  onFile: (id: string, file: File) => void;
  onRemove: (id: string) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const slotRef = useRef<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const slot = slots.find((item) => item.id === active) || null;

  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setActive(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  function open(id: string) {
    arm(() => {
      slotRef.current = id;
      setActive(id);
    });
  }

  function takeFile(file: File | undefined) {
    const id = slotRef.current;
    if (!file || !id) return;
    setActive(null);
    onFile(id, file);
  }

  return (
    <>
      <div className="wear-grid" data-wear="grid">
        {slots.map((item) => {
          const shot = shots[item.id];
          return (
            <div key={item.id} className="wear-tile" data-item={item.id} data-filled={shot ? "yes" : "no"}>
              {shot ? <img src={shot.url} alt="" className="wear-photo" /> : null}
              <button
                className="wear-hit"
                type="button"
                aria-label={shot ? `Replace ${item.label}` : `Add ${item.label}`}
                onClick={() => open(item.id)}
              >
                {shot ? null : (
                  <>
                    <WearIcon id={item.id} />
                    <span className="wear-name">{item.label}</span>
                    {item.subtitle ? <span className="wear-sub">{item.subtitle}</span> : null}
                  </>
                )}
              </button>
              {shot ? <span className="wear-check" data-item-check={item.id} aria-hidden="true">✓</span> : null}
              {shot ? (
                <button className="wear-remove" type="button" aria-label={`Remove ${item.label}`} onClick={() => onRemove(item.id)}>×</button>
              ) : null}
            </div>
          );
        })}
      </div>
      {slot ? (
        <div className="wear-sheet" onClick={() => setActive(null)}>
          <div
            className="wear-sheet-card"
            role="dialog"
            aria-modal="true"
            aria-label={slot.label}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-medium leading-tight">{slot.label}</p>
            <button className="btn sheen w-full" type="button" onClick={() => cameraRef.current?.click()}>Take photo</button>
            <button className="btn secondary w-full" type="button" onClick={() => galleryRef.current?.click()}>Upload from gallery</button>
          </div>
        </div>
      ) : null}
      <input
        ref={cameraRef}
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        data-wear-capture="camera"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          takeFile(file);
        }}
      />
      <input
        ref={galleryRef}
        className="sr-only"
        type="file"
        accept="image/*"
        data-wear-capture="gallery"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          takeFile(file);
        }}
      />
    </>
  );
}

function WearIcon({ id }: { id: string }) {
  const pen = {
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
    className: "wear-icon",
  };
  if (id === "saree") {
    return <svg {...pen}><path d="M7 4c2 4 2 12 0 16M12 4v16M17 4c-2 4-2 12 0 16M5 8h14" /></svg>;
  }
  if (id === "blouse") {
    return <svg {...pen}><path d="M9 6l3 2 3-2 3 3-2 2v8H8V11L6 9z" /></svg>;
  }
  if (id === "earrings") {
    return <svg {...pen}><path d="M8 3.5v2M16 3.5v2" /><circle cx="8" cy="9" r="2.2" /><circle cx="16" cy="9" r="2.2" /><path d="M8 11.2c.2 2.4-1.6 3.6-1.2 6M16 11.2c.2 2.4-1.6 3.6-1.2 6" /></svg>;
  }
  if (id === "ear-chain") {
    return <svg {...pen}><circle cx="6.5" cy="15" r="2" /><path d="M8.2 13.6C11 10 14 8 19 5" /><path d="M15 6.2c1.4.2 2.4-.2 3.4-1.2" /></svg>;
  }
  if (id === "forehead-pendant") {
    return <svg {...pen}><path d="M4 10c2.2-3.2 13.8-3.2 16 0" /><path d="M12 9v4" /><path d="M12 13l-2.2 3.2h4.4z" /></svg>;
  }
  if (id === "necklace") {
    return <svg {...pen}><path d="M5 7c1.2 6 3.8 8.5 7 8.5S17.8 13 19 7" /><circle cx="12" cy="17.2" r="1.5" /></svg>;
  }
  if (id === "long-haram") {
    return <svg {...pen}><path d="M6 4c1.2 7 3.2 12 6 14.5C14.8 16 16.8 11 18 4" /><circle cx="12" cy="19.2" r="1.3" /></svg>;
  }
  if (id === "hair-accessories") {
    return <svg {...pen}><circle cx="12" cy="11" r="3.4" /><path d="M8.2 13.2c-.8 2.6.6 5.2 3.8 6 3.2-.8 4.6-3.4 3.8-6" /><path d="M12 7.6V5" /></svg>;
  }
  if (id === "sherwani") {
    return <svg {...pen}><path d="M8 5l4 2 4-2 2 2v13H6V7z" /><path d="M12 7v13" /></svg>;
  }
  if (id === "kurta") {
    return <svg {...pen}><path d="M8 6l4 2 4-2 2 2-1.5 2V19H7.5V10L6 8z" /><path d="M12 8v5" /></svg>;
  }
  if (id === "turban") {
    return <svg {...pen}><path d="M5 14c1.2-5 12.8-5 14 0" /><path d="M7 13c1-2.2 9-2.2 10 0" /><path d="M4 15h16" /><path d="M16 9c2-.8 4 .2 4 2" /></svg>;
  }
  if (id === "mala") {
    return <svg {...pen}><circle cx="7" cy="8" r="1.2" /><circle cx="12" cy="6" r="1.2" /><circle cx="17" cy="8" r="1.2" /><circle cx="9" cy="12" r="1.2" /><circle cx="15" cy="12" r="1.2" /><circle cx="12" cy="16.5" r="1.3" /></svg>;
  }
  if (id === "watch") {
    return <svg {...pen}><rect x="9.5" y="4" width="5" height="3" rx="0.6" /><rect x="9.5" y="17" width="5" height="3" rx="0.6" /><circle cx="12" cy="12" r="4" /><path d="M12 12V10M12 12l2 1.2" /></svg>;
  }
  return <svg {...pen}><circle cx="12" cy="12" r="5" /></svg>;
}
