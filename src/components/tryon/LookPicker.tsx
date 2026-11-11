"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SavedMarks } from "@/components/tryon/SavedMarks";
import { LOOK_PAGE, filterLooks } from "@/lib/look-picker";

export type LookPick = {
  id: string;
  name: string;
  tags: string[];
  preview: ReactNode;
  meta?: string;
  /** Present on a saved look so the tick and cross sit on the photo. */
  mark?: { removed: boolean; onKeep: () => void; onDrop: () => void };
};

export function LookPicker({
  label,
  items,
  selectedId,
  category = "all",
  disabled,
  tryDisabled,
  savedOn = false,
  saveLabel = "Save this look",
  unsaveLabel = "Unsave",
  keepLabel = "Save this look",
  dropLabel = "Remove this look",
  onSelect,
  onTry,
  tryLabel,
  onSave,
  saveNote,
}: {
  label: string;
  items: LookPick[];
  selectedId: string;
  category?: string;
  disabled?: boolean;
  tryDisabled?: boolean;
  savedOn?: boolean;
  saveLabel?: string;
  unsaveLabel?: string;
  keepLabel?: string;
  dropLabel?: string;
  onSelect: (id: string) => void;
  onTry: () => void;
  tryLabel?: string;
  onSave?: () => void;
  saveNote?: string;
}) {
  const [shown, setShown] = useState(LOOK_PAGE);
  useEffect(() => {
    setShown(LOOK_PAGE);
  }, [category, label]);
  const filtered = filterLooks(items, category, "");
  const visible = filtered.slice(0, shown);
  const selected = items.find((item) => item.id === selectedId);
  return (
    <div data-picker="yes">
      {onSave ? (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn secondary min-h-11" type="button" aria-pressed={savedOn} disabled={disabled || !selected} onClick={onSave}>
            {savedOn ? unsaveLabel : saveLabel}
          </button>
          {saveNote ? <p className="text-sm text-muted">{saveNote}</p> : null}
        </div>
      ) : null}
      {visible.length === 0 ? <p className="mt-3 text-sm text-muted">{category === "saved" ? "Nothing saved yet. Pick a look, then tap Save this look." : "No matches."}</p> : null}
      <div className="look-grid mt-3 grid grid-cols-3 gap-2 lg:grid-cols-4">
        {visible.map((item) => {
          const on = item.id === selectedId;
          return (
            <div
              key={item.id}
              className={`relative overflow-hidden rounded-[14px] border bg-white text-left shadow-sm ${on ? "border-[var(--brand)] ring-2 ring-[var(--brand)]" : "border-line"}${item.mark?.removed ? " is-removed" : ""}`}
            >
              <button
                type="button"
                aria-pressed={on}
                className="block w-full text-left"
                disabled={disabled}
                onClick={() => onSelect(item.id)}
              >
                {on && !item.mark ? <span className="check" aria-hidden="true">✓</span> : null}
                {item.preview}
                <span className="block px-2 py-2 text-center text-sm font-medium leading-tight">{item.name}</span>
                {item.meta ? <span className="block px-2 pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">{item.meta}</span> : null}
              </button>
              {item.mark ? (
                <SavedMarks
                  removed={item.mark.removed}
                  keepLabel={keepLabel}
                  dropLabel={dropLabel}
                  onKeep={item.mark.onKeep}
                  onDrop={item.mark.onDrop}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {filtered.length > shown ? (
        <button className="btn secondary mt-3 min-h-11" type="button" onClick={() => setShown((count) => count + LOOK_PAGE)}>Show more</button>
      ) : null}
      <div className="try-cta">
        <button className="btn w-full min-h-11" type="button" disabled={disabled || tryDisabled || !selected} onClick={onTry}>
          {tryLabel || "Try this look"}
        </button>
      </div>
    </div>
  );
}
