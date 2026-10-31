// Counsel still needs to review this page before it is treated as legal advice.
import Link from "next/link";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { legalName } from "@/lib/env";

export default function CopyrightPage() {
  const company = legalName();
  const support = process.env.SUPPORT_EMAIL || "privacy@agenticbuildworks.com";
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-sm leading-7">
      <p className="text-muted"><Link href="/">Lookuvi</Link></p>
      <h1 className="mt-3 page-title">Copyright &amp; takedown</h1>
      <p className="mt-2 text-muted">Version 2026-10-31. Notice-and-takedown contact for alleged copyright or unlawful content on Lookuvi. This page is a template (DMCA-style process adapted for India).</p>
      <div className="mt-6 space-y-4">
        <p>{company} hosts salon-branded try-on pages and related content. If you believe material on Lookuvi infringes your copyright or is otherwise unlawful, send a notice to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Email: <strong>[Copyright / takedown email]</strong> (until filled: {support})</li>
          <li>Postal: <strong>[Registered address]</strong></li>
          <li>Grievance Officer: see <Link className="underline" href="/grievance">Grievance</Link></li>
        </ul>
        <h2 className="font-serif text-2xl">What to include</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your name, postal address, phone, and email</li>
          <li>Description of the work or right claimed</li>
          <li>URL or salon slug and a description of the material</li>
          <li>A statement that you have a good-faith belief the use is not authorised</li>
          <li>A statement that the information is accurate, and that you are the owner or authorised to act</li>
          <li>Your physical or electronic signature</li>
        </ul>
        <p>We will acknowledge notices and act as required under applicable Indian law, including the IT Rules, 2021 where they apply. Misrepresentations may have legal consequences.</p>
      </div>
      <LegalFooter />
    </main>
  );
}
