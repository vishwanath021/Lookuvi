"use client";

/** Tick keeps the look. A highlighted cross means it is removed. */
export function SavedMarks({
  removed,
  keepLabel,
  dropLabel,
  onKeep,
  onDrop,
}: {
  removed: boolean;
  keepLabel: string;
  dropLabel: string;
  onKeep: () => void;
  onDrop: () => void;
}) {
  return (
    <span className="saved-marks">
      <button
        className={`look-mark tick${removed ? "" : " is-on"}`}
        type="button"
        aria-pressed={!removed}
        aria-label={keepLabel}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onKeep();
        }}
      >
        ✓
      </button>
      <button
        className={`look-mark cross${removed ? " is-on" : ""}`}
        type="button"
        aria-pressed={removed}
        aria-label={dropLabel}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onDrop();
        }}
      >
        ×
      </button>
    </span>
  );
}
