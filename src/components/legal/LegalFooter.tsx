"use client";

import Link from "next/link";

/** Compact legal links for guest try-on, queue, and admin shells. */
export function LegalFooter({ className = "", company = "Agentic Build Works" }: { className?: string; company?: string }) {
  return (
    <footer className={`mt-8 border-t border-line pt-4 text-xs leading-relaxed text-muted ${className}`.trim()} data-legal-footer="yes">
      <nav className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Legal">
        <Link className="underline" href="/privacy">Privacy</Link>
        <Link className="underline" href="/terms">Terms</Link>
        <Link className="underline" href="/grievance">Grievance</Link>
        <Link className="underline" href="/refund">Refunds</Link>
        <Link className="underline" href="/ai-disclosure">AI disclosure</Link>
        <Link className="underline" href="/copyright">Copyright</Link>
      </nav>
      <p className="mt-2">Lookuvi is a product of {company}. Legal text is a template — have counsel review it.</p>
    </footer>
  );
}
