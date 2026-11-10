import type { ReactNode } from "react";

export type NoticeTone = "error" | "warning" | "info" | "success";

const LABEL: Record<NoticeTone, string> = {
  error: "Error",
  warning: "Warning",
  info: "Note",
  success: "Saved",
};

export function Notice({ tone = "info", children }: { tone?: NoticeTone; children: ReactNode }) {
  return (
    <p className={`notice notice-${tone}`} role="status">
      <span className="notice-icon" aria-hidden="true">{tone === "success" ? "✓" : tone === "info" ? "i" : "!"}</span>
      <span><span className="sr-only">{LABEL[tone]}. </span>{children}</span>
    </p>
  );
}

export function RequiredMark() {
  return <abbr className="text-[var(--bad)] no-underline" title="Required"> *</abbr>;
}
