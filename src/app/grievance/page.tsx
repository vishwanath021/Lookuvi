// Counsel still needs to review this page before it is treated as legal advice.
import Link from "next/link";
import { LegalFooter } from "@/components/legal/LegalFooter";
import {
  FOUNDERS,
  companyCin,
  companyGstin,
  companyLegalName,
  grievanceOfficerEmail,
  grievanceOfficerName,
  grievanceOfficerPhone,
  postalAddress,
  supportEmail,
} from "@/lib/legal";

export default function GrievancePage() {
  const company = companyLegalName();
  const support = supportEmail();
  const officer = grievanceOfficerName();
  const officerEmail = grievanceOfficerEmail();
  const officerPhone = grievanceOfficerPhone();
  const postal = postalAddress();
  const cin = companyCin();
  const gstin = companyGstin();
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-sm leading-7">
      <p className="text-muted"><Link href="/">Lookuvi</Link></p>
      <h1 className="mt-3 page-title">Grievance &amp; contact</h1>
      <p className="mt-2 text-muted">Version 2026-10-31. How to reach Lookuvi about privacy, service, or content complaints.</p>
      <div className="mt-6 space-y-4">
        <p>{company} operates Lookuvi. Salons that use Lookuvi are data fiduciaries for their guests under the Digital Personal Data Protection Act, 2023. Lookuvi is the processor for try-on software.</p>
        <h2 className="font-serif text-2xl">Founders / directors</h2>
        <ul className="list-disc space-y-1 pl-5">
          {FOUNDERS.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <h2 className="font-serif text-2xl">Grievance Officer</h2>
        <p>Under the DPDP Act and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the Grievance Officer for Lookuvi is:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Name: <strong>{officer}</strong></li>
          <li>Email: <strong>{officerEmail}</strong></li>
          {officerPhone ? <li>Phone: <strong>{officerPhone}</strong></li> : null}
          <li>Postal: <strong>{postal}</strong></li>
          <li>Hours: Monday–Friday, 10:00–18:00 IST (excluding public holidays)</li>
        </ul>
        {(cin || gstin) ? (
          <>
            <h2 className="font-serif text-2xl">Company identifiers</h2>
            <ul className="list-disc space-y-1 pl-5">
              {cin ? <li>CIN: <strong>{cin}</strong></li> : null}
              {gstin ? <li>GSTIN: <strong>{gstin}</strong></li> : null}
            </ul>
          </>
        ) : null}
        <h2 className="font-serif text-2xl">Response timelines</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Acknowledgement of a privacy or grievance email: within <strong>48 hours</strong> of receipt on a working day.</li>
          <li>Substantive response or resolution target for data principal requests (access, correction, erasure, withdrawal): within <strong>30 days</strong>.</li>
          <li>Content takedown / unlawful content complaints under IT Rules 2021: acknowledgement within 24 hours where feasible; action as required by law.</li>
        </ul>
        <h2 className="font-serif text-2xl">How to raise a request</h2>
        <p>Use the form on the <Link className="underline" href="/privacy">Privacy</Link> page for access, correction, erasure, or withdrawal. For other complaints, email the Grievance Officer with your salon slug (if any), contact details, and a short description.</p>
        <p>Platform support: {support}</p>
      </div>
      <LegalFooter company={company} />
    </main>
  );
}
