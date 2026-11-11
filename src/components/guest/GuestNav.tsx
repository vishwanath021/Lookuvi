"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "@/data/i18n";
import type { GuestNavId } from "@/lib/guest-nav";

const ITEMS: { id: GuestNavId; key: "navTry" | "services" | "navSaved" }[] = [
  { id: "try", key: "navTry" },
  { id: "services", key: "services" },
  { id: "saved", key: "navSaved" },
];

export function GuestNav({
  slug,
  lang,
  current,
}: {
  slug: string;
  lang: string;
  current?: GuestNavId;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const nav = (
    <nav className="guest-nav" data-guest-nav="yes" aria-label="Guest">
      {ITEMS.map((item) => {
        const href = item.id === "try" ? `/s/${slug}` : item.id === "services" ? `/s/${slug}/services` : `/s/${slug}/saved`;
        const external = href.startsWith("http");
        const label = t(lang, item.key);
        return (
          <a
            key={item.id}
            href={href}
            aria-current={current === item.id ? "page" : undefined}
            {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
  if (mounted) return createPortal(nav, document.body);
  return nav;
}
