"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LOOK_CATEGORIES, LOOK_PAGE, filterLooks } from "@/lib/look-picker";

export type LookPick = {
  id: string;
  name: string;
  tags: string[];
  preview: ReactNode;
  meta?: string;
};

export function LookPicker({
  label,
  items,
  selectedId,
  disabled,
  tryDisabled,
  onSelect,
  onTry,
}: {
  label: string;
  items: LookPick[];
  selectedId: string;
  disabled?: boolean;
  tryDisabled?: boolean;
  onSelect: (id: string) => void;
  onTry: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [shown, setShown] = useState(LOOK_PAGE);
  useEffect(() => {
    setShown(LOOK_PAGE);
  }, [query, category, label]);
  const chips = LOOK_CATEGORIES.filter((item) => item.id === "all" || item.id === "saved" || items.some((row) => row.tags.includes(item.id)));
  const filtered = filterLooks(items, category, query);
  const visible = filtered.slice(0, shown);
  const selected = items.find((item) => item.id === selectedId);
  return (
    <div data-picker="yes">
      <label className="sr-only" htmlFor={`look-search-${label}`}>Search {label}</label>
      <input
        id={`look-search-${label}`}
        className="field"
        type="search"
        placeholder={`Search ${label.toLowerCase()}`}
        aria-label={`Search ${label}`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="chip-scroll mt-2" role="group" aria-label={`${label} categories`}>
        {chips.map((item) => (
          <button key={item.id} className="chip shrink-0" type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? <p className="mt-3 text-sm text-muted">{category === "saved" && !query ? "No saved styles yet." : "No matches."}</p> : null}
      <div className="mt-3 grid grid-cols-3 gap-2 lg:grid-cols-4">
        {visible.map((item) => {
          const on = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              className={`relative overflow-hidden rounded-[14px] border bg-white text-left shadow-sm ${on ? "border-[var(--brand)] ring-2 ring-[var(--brand)]" : "border-line"}`}
              disabled={disabled}
              onClick={() => onSelect(item.id)}
            >
              {on ? <span className="check" aria-hidden="true">✓</span> : null}
              {item.preview}
              <span className="block px-2 py-2 text-center text-sm font-medium leading-tight">{item.name}</span>
              {item.meta ? <span className="block px-2 pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">{item.meta}</span> : null}
            </button>
          );
        })}
      </div>
      {filtered.length > shown ? (
        <button className="btn secondary mt-3 min-h-11" type="button" onClick={() => setShown((count) => count + LOOK_PAGE)}>Show more</button>
      ) : null}
      <div className="try-cta">
        <button className="btn w-full min-h-11" type="button" disabled={disabled || tryDisabled || !selected} onClick={onTry}>
          {selected ? `Try this look` : "Try this look"}
        </button>
      </div>
    </div>
  );
}
