"use client";

import { useState } from "react";

export function StyleCard({ id, name, folder = "styles" }: { id: string; name: string; folder?: "styles" | "brows" | "beards" | "nails" }) {
  const [src, setSrc] = useState(`/${folder}/thumbs/${id}.webp`);
  const [missing, setMissing] = useState(false);
  if (missing) {
    return (
      <div className="grid aspect-square place-items-center bg-sand px-3 text-center text-sm text-ink" role="img" aria-label={`${name} style reference`}>
        {name}
      </div>
    );
  }
  return (
    <img
      src={src}
      width={384}
      height={384}
      alt={`${name} style reference`}
      loading="lazy"
      decoding="async"
      className="aspect-square w-full object-cover"
      onError={() => {
        if (src.endsWith(".webp")) setSrc(`/${folder}/${id}.jpg`);
        else setMissing(true);
      }}
    />
  );
}
