// Counsel still needs to review this page before it is treated as legal advice.
import Link from "next/link";
import { PrivacyRequest } from "@/components/PrivacyRequest";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { legalName } from "@/lib/env";

export default function PrivacyPage() {
  const contact = process.env.SUPPORT_EMAIL || "privacy@agenticbuildworks.com";
  const company = legalName();
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <p className="text-sm text-muted"><Link href="/">Lookuvi</Link></p>
      <h1 className="mt-3 page-title">Privacy</h1>
      <p className="mt-2 text-sm text-muted">Version 2026-10-31. How Lookuvi and each salon handle personal data for the try-on and the queue. This notice is a template — have counsel review it before launch.</p>
      <div className="mt-6 space-y-4 text-sm leading-7">
        <p>The salon is the data fiduciary for its guests under the Digital Personal Data Protection Act, 2023. {company} operates Lookuvi and is the processor that runs the try-on software. A face or hand photo used for a preview is personal data (and is treated with care similar to sensitive / biometric-like data under older SPDI practice).</p>

        <h2 className="font-serif text-2xl">Purposes (itemised)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Show a hair, brow, beard, nail, bridal, or makeup preview for this salon visit</li>
          <li>Run live hair colour on your device (not uploaded)</li>
          <li>Join a salon queue with name and mobile, and send transactional queue updates</li>
          <li>Optional booking lead if you tap Book</li>
          <li>Optional WhatsApp reminder or offer after a visit (you can reply STOP)</li>
          <li>Security, abuse prevention, billing for the salon, and legal compliance</li>
        </ul>

        <h2 className="font-serif text-2xl">Photos and AI processors</h2>
        <p>Live hair colour runs in the browser with a self-hosted MediaPipe model. That photo is not uploaded.</p>
        <p>A style, brow, beard, nail, bridal, or makeup preview sends the photo and the chosen style to our server. The server may send that photo to a configured AI processor: <strong>fal (Black Forest Labs FLUX)</strong>, <strong>OpenAI</strong>, and/or <strong>Google Gemini</strong>. Those processors may process data on servers <strong>outside India</strong>. The HTTP response is <span className="font-medium">Cache-Control: no-store</span>. The generated preview is stored in private object storage for up to 24 hours so the same tap is not billed twice, then a retention job deletes it. Logs do not contain the photo or provider keys. Lookuvi does not use guest photos to train its own models. Production must use paid provider tiers whose terms do not use your content for training where that option exists.</p>
        <p>Try-on results are labelled as <strong>AI-generated</strong>. See <Link className="underline" href="/ai-disclosure">AI disclosure</Link>.</p>

        <h2 className="font-serif text-2xl">Hosting</h2>
        <p>The application is hosted on Hostinger in India. When the site is served through Cloudflare, Cloudflare processes the connection for DNS and TLS (which may involve points of presence outside India).</p>

        <h2 className="font-serif text-2xl">What we store</h2>
        <p>We store a consent log (session id, purpose, text version, language, time, a short hash of the browser string, age confirmation), usage events without photos, queue and customer phone records for that salon, and booking leads if the guest taps Book. You can ask for access, correction, erasure, and nomination through the form below or the <Link className="underline" href="/grievance">Grievance</Link> page.</p>

        <h2 className="font-serif text-2xl">Queue, WhatsApp, and SMS</h2>
        <p>A phone number entered for the queue is saved on that salon&apos;s own list, with a visit count and the date of the last completed visit. The salon can send one WhatsApp reminder after a visit, or an offer. Reply STOP to opt out of reminders and offers. That opt-out applies to every salon on this WhatsApp number. Queue updates for a visit you just joined still use the consent tick on the join form. The list is not shared with another salon. Commercial SMS, when used, requires TRAI DLT registration by the sender.</p>

        <h2 className="font-serif text-2xl">Consent, withdrawal, and children</h2>
        <p>You agree to the photo notice before the camera opens. Withdrawal is as available as consent: use the form below or the withdraw link on the consent sheet. Withdrawal deletes leads tied to the browser session. Stored previews expire on the retention schedule. Open requests are tracked with a 30-day handling target (acknowledgement target 48 hours). Grievance Officer details: <Link className="underline" href="/grievance">Grievance</Link> (placeholders until appointed). Contact: {contact}.</p>
        <p>You must confirm you are 18 or older, or that a parent or guardian is present, before a photo preview. Children&apos;s styles require a parent or guardian. Lookuvi does not run tracking or targeted advertising aimed at children.</p>

        <h2 className="font-serif text-2xl">Cookies &amp; local storage</h2>
        <p>Staff sign-in uses an httpOnly session cookie. Guests get a random id in <span className="font-medium">sessionStorage</span> for consent and try-on (not an account). The booking hub may set an httpOnly guest cookie after a phone code. Queue join may keep recent visit refs in <span className="font-medium">localStorage</span> on your device. Optional error reporting (Sentry) runs only if the operator sets a DSN — it is not session replay and does not record keystrokes. We do not load third-party marketing pixels or session-replay scripts in the app.</p>

        <h2 className="font-serif text-2xl">Security practices</h2>
        <p>Passwords are handled by the auth stack (not stored in plain text). Provider API keys are encrypted at rest. Photos are re-encoded server-side (EXIF stripped). Application logs are redacted to avoid photos, tokens, and phone numbers. Object storage for previews is private. Reasonable security practices under IT Act s43A / SPDI Rules are a continuing duty — see also our security reviews in the engineering process.</p>

        <h2 className="font-serif text-2xl">Cross-border transfers</h2>
        <p>When AI processors or CDN/DNS providers handle data abroad, that is a cross-border transfer for the purposes of producing your preview or delivering the site. By agreeing to the photo notice you acknowledge those processors may receive the photo for that purpose only.</p>

        <p>Platform contact: {contact}. Registered postal address: <strong>[Registered address]</strong>.</p>
        <PrivacyRequest />
      </div>
      <LegalFooter />
    </main>
  );
}
