"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { ownerNav, type OwnerFeatures } from "@/lib/features";

export function AdminNav({
  role,
  name,
  credits,
  slug,
  productTryOn,
  productQueue,
  onboardingDone = true,
  features,
  salons = [],
  currentTenantId = "",
}: {
  role: string;
  name: string;
  credits: number;
  slug: string;
  productTryOn: boolean;
  productQueue: boolean;
  onboardingDone?: boolean;
  features: OwnerFeatures;
  salons?: { id: string; name: string }[];
  currentTenantId?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [left, setLeft] = useState(credits);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    const timer = setInterval(() => {
      void fetch("/api/v1/admin/balance")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (typeof data?.credits === "number") setLeft(data.credits);
        })
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(timer);
  }, []);
  const links = ownerNav({ role, slug, productTryOn, productQueue, features, onboardingDone });
  const main = links.filter((link) => link.section === "main");
  const more = links.filter((link) => link.section === "more");
  const pageTitle = links.find((link) => pathname === link.href || (link.href !== "/admin" && pathname.startsWith(`${link.href}/`)))?.label
    || (pathname.startsWith("/admin/onboarding") ? "Onboarding" : "Lookuvi");
  return (
    <div className="print:hidden">
      <div className="owner-mobile-bar sticky top-0 z-40 -mx-3 -mt-6 mb-3 flex h-14 items-center gap-2 border-b border-line bg-[var(--bg)] px-3 md:hidden">
        <p className="min-w-0 max-w-[38%] truncate text-sm font-semibold">{name}</p>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{pageTitle}</h1>
        <button className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-white text-[#3e304b]" type="button" data-ready={ready ? "yes" : "no"} aria-expanded={open} aria-controls="salon-nav" aria-label={open ? "Close menu" : "Menu"} onClick={() => setOpen((value) => !value)}>
          {open ? (
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M3 5h12M3 9h12M3 13h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
      <aside id="salon-nav" data-ready={ready ? "yes" : "no"} className={`${open ? "block" : "hidden"} nav-side h-fit rounded-[14px] p-4 md:block`}>
        <p className="text-sm uppercase tracking-[0.14em] text-[#d8cbe4]">{role}</p>
        <p className="font-serif text-2xl leading-tight">{name}</p>
        <p className="text-sm text-[#d8cbe4]">{left.toLocaleString("en-IN")} try-ons left</p>
        {salons.length > 1 && (
          <label className="mt-3 block text-xs text-[#d8cbe4]">Salon
            <select
              className="field mt-1 text-sm text-[#1b1224]"
              aria-label="Switch salon"
              value={currentTenantId}
              onChange={(event) => {
                const tenantId = event.target.value;
                void fetch("/api/v1/admin/switch", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ tenantId }),
                }).then(() => {
                  window.location.href = "/admin";
                });
              }}
            >
              {salons.map((salon) => <option key={salon.id} value={salon.id}>{salon.name}</option>)}
            </select>
          </label>
        )}
        <nav className="mt-3 grid text-sm" aria-label="Salon">
          {main.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>
          ))}
          <details className="mt-3">
            <summary className="cursor-pointer py-2 text-xs uppercase tracking-[0.14em] text-[#d8cbe4]">More</summary>
            <div className="grid">
              {more.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>
              ))}
            </div>
          </details>
        </nav>
        <SignOutButton />
        <LegalFooter className="mt-4 border-t border-white/10 pt-3 text-[#d8cbe4]" />
      </aside>
    </div>
  );
}
