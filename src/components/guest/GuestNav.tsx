"use client";

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
  return (
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
}
