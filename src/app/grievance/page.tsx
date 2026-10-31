// Counsel still needs to review this page before it is treated as legal advice.
import Link from "next/link";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { legalName } from "@/lib/env";

export default function GrievancePage() {
  const company = legalName();
  const support = process.env.SUPPORT_EMAIL || "privacy@agenticbuildworks.com";
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-sm leading-7">
      <p className="text-muted"><Link href="/">Lookuvi</Link></p>
      <h1 className="mt-3 page-title">Grievance &amp; contact</h1>
      <p className="mt-2 text-muted">Version 2026-10-31. How to reach Lookuvi about privacy, service, or content complaints. Fill the placeholders before launch.</p>
      <div className="mt-6 space-y-4">
        <p>{company} operates Lookuvi. Salons that use Lookuvi are data fiduciaries for their guests under the Digital Personal Data Protection Act, 2023. Lookuvi is the processor for try-on software.</p>
        <h2 className="font-serif text-2xl">Grievance Officer</h2>
        <p>Under the DPDP Act and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, a Grievance Officer will be published here once appointed.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Name: <strong>[Grievance Officer name]</strong></li>
          <li>Email: <strong>[Grievance Officer email]</strong> (until filled, write to {support})</li>
          <li>Phone: <strong>[Grievance Officer phone]</strong></li>
          <li>Postal: <strong>[Registered address]</strong></li>
          <li>Hours: Monday–Friday, 10:00–18:00 IST (excluding public holidays)</li>
        </ul>
        <h2 className="font-serif text-2xl">Response timelines</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Acknowledgement of a privacy or grievance email: within <strong>48 hours</strong> of receipt on a working day.</li>
          <li>Substantive response or resolution target for data principal requests (access, correction, erasure, withdrawal): within <strong>30 days</strong>.</li>
          <li>Content takedown / unlawful content complaints under IT Rules 2021: acknowledgement within 24 hours where feasible; action as required by law.</li>
        </ul>
        <h2 className="font-serif text-2xl">How to raise a request</h2>
        <p>Use the form on the <Link className="underline" href="/privacy">Privacy</Link> page for access, correction, erasure, or withdrawal. For other complaints, email the Grievance Officer with your salon slug (if any), contact details, and a short description.</p>
        <p>Platform support (until the officer details are filled): {support}</p>
      </div>
      <LegalFooter />
    </main>
  );
}
