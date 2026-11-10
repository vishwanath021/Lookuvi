"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LookuviMark } from "@/components/brand/LookuviMark";
import { SignOutButton } from "@/components/admin/SignOutButton";

const LINKS = [
  { href: "/super", label: "Overview" },
  { href: "/super/salons", label: "Salons" },
  { href: "/super/styles", label: "Styles" },
  { href: "/super/ai", label: "AI" },
  { href: "/super/costs", label: "Spend & costs" },
  { href: "/super/security", label: "Security" },
  { href: "/super/audit", label: "Audit log" },
];

function superTitle(pathname: string) {
  const match = LINKS.find((link) => current(pathname, link.href));
  if (!match || match.href === "/super") return "Lookuvi";
  return match.label;
}

function current(pathname: string, href: string) {
  if (href === "/super") return pathname === "/super";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Sidebar only. It does not wrap the page, so a slow AI render cannot block these links.
 * Plain anchors navigate even while React is still hydrating or a previous navigation is stuck.
 */
export function SuperNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const nav = (label: string) => (
    <nav className="flex flex-col gap-1" aria-label={label} data-ready={ready ? "yes" : "no"}>
      {LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          aria-current={current(pathname, link.href) ? "page" : undefined}
          onClick={() => setOpen(false)}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
  return (
    <>
      <aside className="nav-side hidden md:flex md:flex-col md:gap-4 md:px-3 md:py-4">
        <div className="flex items-center gap-2 px-2 text-white">
          <LookuviMark className="h-9 w-9" tone="inverse" />
          <span className="font-sans text-xl font-semibold tracking-tight">lookuvi</span>
        </div>
        {nav("Platform")}
        <div className="mt-auto">
          <SignOutButton />
        </div>
      </aside>
      <div className="nav-side sticky top-0 z-40 md:hidden">
        <div className="flex h-14 items-center gap-2 border-b border-white/20 px-3 text-white">
          <LookuviMark className="h-8 w-8 shrink-0" tone="inverse" />
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{superTitle(pathname)}</h1>
          <button className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/30" type="button" aria-expanded={open} aria-label={open ? "Close menu" : "Menu"} onClick={() => setOpen((value) => !value)}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d={open ? "M4 4l10 10M14 4L4 14" : "M3 5h12M3 9h12M3 13h12"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {open ? <div className="px-3 pb-3">{nav("Platform menu")}</div> : null}
      </div>
    </>
  );
}
