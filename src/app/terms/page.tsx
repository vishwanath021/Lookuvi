// Counsel still needs to review this page before it is treated as legal advice.
import Link from "next/link";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { companyLegalName, postalAddress, supportEmail } from "@/lib/legal";

export default function TermsPage() {
  const company = companyLegalName();
  const support = supportEmail();
  const postal = postalAddress();
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-sm leading-7">
      <p className="text-muted"><Link href="/">Lookuvi</Link></p>
      <h1 className="mt-3 page-title">Terms</h1>
      <p className="mt-4">These terms cover a salon subscription to Lookuvi, a product of {company}. Have your entity review them before relying on them as a signed contract. Version 2026-10-31.</p>
      <h2 className="mt-6 font-serif text-2xl">The service</h2>
      <p>We host a branded try-on page, QR, and (on eligible plans) an embed. Live colour is included. AI previews spend credits. When credits run out, colour keeps working and new previews stop with a plain message.</p>
      <h2 className="mt-6 font-serif text-2xl">Previews</h2>
      <p>Previews are AI-generated guides for a conversation with a stylist. We do not claim that a preview matches a future haircut, measures a face, or is appropriate for every hair type. The salon confirms the service and the price. See <Link className="underline" href="/ai-disclosure">AI disclosure</Link>.</p>
      <h2 className="mt-6 font-serif text-2xl">Plans, renewal, GST</h2>
      <p>Prices in the product are in rupees and are shown before payment. GST is not charged until {company} has a GSTIN. A receipt is not a tax invoice. Annual billing is ten times the monthly price. Try-on packs add to the balance. A failed preview returns the try-on. Plans renew for the same interval until cancelled or unpaid. Refund and cancellation details: <Link className="underline" href="/refund">Refund &amp; cancellation</Link>.</p>
      <h2 className="mt-6 font-serif text-2xl">Acceptable use &amp; unlawful content</h2>
      <p>Do not upload a photo of someone who has not agreed. Do not use the tool on a minor without a parent or guardian present. Do not attempt to store or resell guest photos. Do not upload or transmit unlawful, obscene, defamatory, infringing, or deceptive content, or content that violates Indian law. We may suspend a salon that misuses the tool. Copyright and takedown: <Link className="underline" href="/copyright">Copyright</Link>. Grievance Officer: <Link className="underline" href="/grievance">Grievance</Link>.</p>
      <h2 className="mt-6 font-serif text-2xl">Privacy roles</h2>
      <p>The salon is the data fiduciary. We process try-on traffic as described in the <Link className="underline" href="/privacy">privacy notice</Link>. A data processing addendum should be signed before a paying salon goes live.</p>
      <h2 className="mt-6 font-serif text-2xl">Contact</h2>
      <p>{support}. Postal: <strong>{postal}</strong>.</p>
      <LegalFooter company={company} />
    </main>
  );
}
