// Counsel still needs to review this page before it is treated as legal advice.
import Link from "next/link";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { companyLegalName, supportEmail } from "@/lib/legal";

export default function RefundPage() {
  const company = companyLegalName();
  const support = supportEmail();
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-sm leading-7">
      <p className="text-muted"><Link href="/">Lookuvi</Link></p>
      <h1 className="mt-3 page-title">Refund &amp; cancellation</h1>
      <p className="mt-2 text-muted">Version 2026-10-31. For salon (B2B) subscriptions and try-on packs. Guest walk-in try-ons are free to the guest.</p>
      <div className="mt-6 space-y-4">
        <p>{company} sells Lookuvi plans and try-on packs to salons in India. Prices in the product are in Indian rupees and are shown before payment. GST is not charged until {company} has a GSTIN. A receipt is not a tax invoice until then.</p>
        <h2 className="font-serif text-2xl">Plans</h2>
        <p>Monthly and annual prices are shown on the billing screen. Annual billing is ten times the monthly price (two months free). Choosing a plan does not add hidden fees at checkout. There is no false countdown or drip pricing in the product UI.</p>
        <h2 className="font-serif text-2xl">Renewal</h2>
        <p>A paid plan renews for the same interval (monthly or yearly) until the salon owner cancels or the subscription lapses for non-payment. Renewal terms and the next charge amount are visible on the billing screen before you pay. Contact {support} or use the billing controls to cancel; cancellation stops the next renewal and does not remove unused try-ons already on the balance unless the account is closed.</p>
        <h2 className="font-serif text-2xl">Try-on packs</h2>
        <p>Packs add try-ons to the salon balance. A failed AI preview returns the try-on to the balance. Unused try-ons from a pack are not cash-refundable once the pack is credited, except where Indian consumer law requires otherwise or {company} agrees in writing.</p>
        <h2 className="font-serif text-2xl">Refunds</h2>
        <p>If you were charged in error, or a paid feature was unavailable for a material period after payment, email {support} within 7 days with the payment reference. Approved refunds are returned to the original UPI / Razorpay instrument within 7–10 working days after approval.</p>
        <h2 className="font-serif text-2xl">Cancellation</h2>
        <p>You may cancel a subscription before the next renewal. After cancellation, guests may lose try-on access when the paid period ends. Export any leads you need before closing the salon.</p>
        <p>Grievance contact: see <Link className="underline" href="/grievance">Grievance</Link>.</p>
      </div>
      <LegalFooter company={company} />
    </main>
  );
}
