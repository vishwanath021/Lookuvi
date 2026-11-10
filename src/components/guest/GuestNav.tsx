"use client";

import { t } from "@/data/i18n";
import type { GuestNavId } from "@/lib/guest-nav";

const ITEMS: { id: GuestNavId; key: "navTry" | "services" | "navJoin" | "navSaved" }[] = [
  { id: "try", key: "navTry" },
  { id: "services", key: "services" },
  { id: "join", key: "navJoin" },
  { id: "saved", key: "navSaved" },
];

export function GuestNav({
  slug,
  lang,
  joinHref,
  current,
}: {
  slug: string;
  lang: string;
  joinHref: string;
  current: GuestNavId;
}) {
  return (
    <nav className="guest-nav" data-guest-nav="yes" aria-label="Guest">
      {ITEMS.map((item) => {
        const href = item.id === "try" ? `/s/${slug}` : item.id === "services" ? `/s/${slug}/services` : item.id === "saved" ? `/s/${slug}/saved` : joinHref;
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
