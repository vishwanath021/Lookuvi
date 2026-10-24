"use client";

import { useState } from "react";

type StyleRow = {
  id: string;
  name: string;
  gender: string;
  density: string[];
  texture: string[];
  faceShapes: string[];
};

const DENSITY = ["thin", "medium", "thick"] as const;
const TEXTURE = ["straight", "wavy", "curly"] as const;

export function CatalogTags({ styles }: { styles: StyleRow[] }) {
  const [rows, setRows] = useState(styles);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");

  function toggle(id: string, key: "density" | "texture", value: string) {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      const has = row[key].includes(value);
      const next = has ? row[key].filter((item) => item !== value) : [...row[key], value];
      return { ...row, [key]: next };
    }));
  }

  async function save(row: StyleRow) {
    if (row.density.length < 1 || row.texture.length < 1) {
      setNote("Keep at least one density and one texture.");
      return;
    }
    setBusy(row.id);
    const res = await fetch("/api/v1/super/catalogue", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ styleId: row.id, density: row.density, texture: row.texture, faceShapes: row.faceShapes }),
    });
    setBusy("");
    setNote(res.ok ? `Saved ${row.name}.` : "Could not save that style.");
  }

  return (
    <div className="grid gap-3">
      {note ? <p className="text-sm" role="status">{note}</p> : null}
      <ul className="grid gap-2">
        {rows.map((row) => (
          <li key={row.id} className="card grid gap-2 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{row.name} <span className="text-xs text-muted">{row.gender}</span></p>
              <button className="btn secondary" type="button" disabled={busy === row.id} onClick={() => void save(row)}>{busy === row.id ? "Saving…" : "Save"}</button>
            </div>
            <div className="flex flex-wrap gap-3">
              {DENSITY.map((value) => (
                <label key={value} className="flex items-center gap-1">
                  <input type="checkbox" checked={row.density.includes(value)} onChange={() => toggle(row.id, "density", value)} />
                  {value}
                </label>
              ))}
              {TEXTURE.map((value) => (
                <label key={value} className="flex items-center gap-1">
                  <input type="checkbox" checked={row.texture.includes(value)} onChange={() => toggle(row.id, "texture", value)} />
                  {value}
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
