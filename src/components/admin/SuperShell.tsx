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
      <div className="nav-side md:hidden">
        <div className="flex items-center gap-2 px-3 py-3 text-white">
          <LookuviMark className="h-9 w-9" tone="inverse" />
          <span className="font-sans text-xl font-semibold">lookuvi</span>
          <button className="btn secondary ml-auto" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            Menu
          </button>
        </div>
        {open ? <div className="px-3 pb-3">{nav("Platform menu")}</div> : null}
      </div>
    </>
  );
}
