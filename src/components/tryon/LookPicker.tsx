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
  onFilters,
}: {
  label: string;
  items: LookPick[];
  selectedId: string;
  disabled?: boolean;
  tryDisabled?: boolean;
  onSelect: (id: string) => void;
  onTry: () => void;
  onFilters?: () => void;
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
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-2 lg:w-72 lg:shrink-0">
          <label className="sr-only" htmlFor={`look-search-${label}`}>Search {label}</label>
          <input
            id={`look-search-${label}`}
            className="field min-w-0 flex-1"
            type="search"
            placeholder={`Search ${label.toLowerCase()}`}
            aria-label={`Search ${label}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {onFilters ? (
            <button className="btn secondary grid h-11 w-11 shrink-0 place-items-center px-0" type="button" aria-label="Filters" onClick={onFilters}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M2 4h14M4 9h10M7 14h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
        <div className="chip-scroll min-w-0 lg:flex-1" role="group" aria-label={`${label} categories`}>
          {chips.map((item) => (
            <button key={item.id} className="chip shrink-0" type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? <p className="mt-3 text-sm text-muted">{category === "saved" && !query ? "No saved styles yet." : "No matches."}</p> : null}
      <div className="look-grid mt-3 grid grid-cols-3 gap-2 lg:grid-cols-4">
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
