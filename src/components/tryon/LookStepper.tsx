"use client";

import type { ReactNode, Ref } from "react";
import { bridalLipById, type BridalMakeup } from "@/data/bridal";

export type StepChip = { id: string; label: string; icon: "event" | "look" | "hair" | "makeup" | "photo" | "beard" | "groom" | "clothes" };

function StepIcon({ name }: { name: StepChip["icon"] }) {
  const common = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, "aria-hidden": true as const };
  if (name === "event") {
    return (
      <svg {...common}>
        <rect x="2" y="3" width="12" height="11" rx="1.5" />
        <path d="M2 6.5h12M5 2v2M11 2v2" />
      </svg>
    );
  }
  if (name === "look") {
    return (
      <svg {...common}>
        <path d="M4 3.5h8l-1 10H5L4 3.5z" />
        <path d="M6 3.5c.2-1.2 1-2 2-2s1.8.8 2 2" />
      </svg>
    );
  }
  if (name === "hair") {
    return (
      <svg {...common}>
        <path d="M3.5 13V8.5c0-2.8 2-5 4.5-5s4.5 2.2 4.5 5V13" />
        <path d="M6 8.5c.2 1.6.8 2.5 2 2.5" />
      </svg>
    );
  }
  if (name === "beard") {
    return (
      <svg {...common}>
        <path d="M4 6.5c.2 4 1.8 6.5 4 6.5s3.8-2.5 4-6.5" />
        <path d="M6 6.2c.4-1.6 1.2-2.4 2-2.4s1.6.8 2 2.4" />
      </svg>
    );
  }
  if (name === "groom") {
    return (
      <svg {...common}>
        <circle cx="8" cy="6" r="2.2" />
        <path d="M3.5 13c.6-2.2 2.2-3.3 4.5-3.3S12 10.8 12.5 13" />
      </svg>
    );
  }
  if (name === "clothes") {
    return (
      <svg {...common}>
        <path d="M5.5 2.5 8 4.2 10.5 2.5 13.5 5 11.2 6.4V13H4.8V6.4L2.5 5 5.5 2.5z" />
      </svg>
    );
  }
  if (name === "photo") {
    return (
      <svg {...common}>
        <rect x="2" y="4" width="12" height="9" rx="1.5" />
        <circle cx="8" cy="8.5" r="2" />
        <path d="M6 4 6.8 2.5h2.4L10 4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="6" cy="7" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="7" r="1.1" fill="currentColor" stroke="none" />
      <path d="M5 10.5c.8.9 1.8 1.3 3 1.3s2.2-.4 3-1.3" />
    </svg>
  );
}

export function scrollToStep(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function StepRail({ label, steps, current }: { label: string; steps: StepChip[]; current: string }) {
  return (
    <nav className="step-rail" aria-label={label} data-step-rail="yes">
      {steps.map((step) => (
        <button
          key={step.id}
          className="step-chip"
          type="button"
          aria-current={current === step.id ? "step" : undefined}
          onClick={() => scrollToStep(step.id)}
        >
          <StepIcon name={step.icon} />
          {step.label}
        </button>
      ))}
    </nav>
  );
}

export function StepCard({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section id={id} className="card step-card grid gap-3 p-3" data-step={id.replace(/^(bridal|groom)-/, "")}>
      <h3 className="text-base font-semibold leading-tight">{title}</h3>
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      {children}
    </section>
  );
}

export function SelectionSummary({ rows }: { rows: { id: string; label: string; value: string }[] }) {
  return (
    <section className="card grid gap-2 p-3" data-summary="yes" aria-label="You selected">
      <p className="text-xs font-semibold uppercase tracking-wide">You selected</p>
      <ul className="grid gap-1.5">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="text-muted">{row.label}. </span>
              <span className="font-medium">{row.value}</span>
            </span>
            <button className="shrink-0 text-sm font-semibold underline" type="button" onClick={() => scrollToStep(row.id)}>
              Change
              <span className="sr-only"> {row.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TryBar({ label, enabled, busy, onClick }: { label: string; enabled: boolean; busy: boolean; onClick: () => void }) {
  return (
    <div className="try-bar" data-action-bar="yes">
      <button className="btn sheen" type="button" disabled={!enabled || busy} onClick={onClick}>{label}</button>
    </div>
  );
}

export function LiveTray({ ready, onShutter, children }: { ready: boolean; onShutter: () => void; children?: ReactNode }) {
  return (
    <div className="live-tray" data-live-tray="yes">
      {children}
      <button className="cam-shutter" type="button" aria-label="Take photo" disabled={!ready} onClick={onShutter} />
    </div>
  );
}

export function LargeFrame({ boxRef, name, children }: { boxRef?: Ref<HTMLDivElement>; name: string; children: ReactNode }) {
  return (
    <div ref={boxRef} data-photo-box={name} className="photo-frame">
      {children}
    </div>
  );
}

export function MakeupSwatches({ items, value, onChange }: { items: BridalMakeup[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="makeup-grid" role="list" aria-label="Makeup">
      {items.map((item) => {
        const lip = bridalLipById(item.lipId)?.hex || "#9B2335";
        return (
          <div key={item.id} role="listitem">
            <button className="makeup-swatch" type="button" aria-pressed={item.id === value} aria-label={item.name} data-swatch="makeup" onClick={() => onChange(item.id)}>
              <span className="makeup-face" aria-hidden="true">
                <span className="makeup-eye left" style={{ background: item.eye }} />
                <span className="makeup-eye right" style={{ background: item.eye }} />
                <span className="makeup-cheek left" style={{ background: item.cheek }} />
                <span className="makeup-cheek right" style={{ background: item.cheek }} />
                <span className="makeup-lip" style={{ background: lip }} />
              </span>
              <span className="makeup-dots" aria-hidden="true">
                <i style={{ background: item.eye }} />
                <i style={{ background: item.cheek }} />
                <i style={{ background: lip }} />
              </span>
              <span className="text-sm font-medium leading-tight">{item.name}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
