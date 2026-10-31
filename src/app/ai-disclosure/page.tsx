// Counsel still needs to review this page before it is treated as legal advice.
import Link from "next/link";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { legalName } from "@/lib/env";

export default function AiDisclosurePage() {
  const company = legalName();
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-sm leading-7">
      <p className="text-muted"><Link href="/">Lookuvi</Link></p>
      <h1 className="mt-3 page-title">AI disclosure</h1>
      <p className="mt-2 text-muted">Version 2026-10-31. How Lookuvi labels synthetically generated try-on images. This page is a template aligned with MeitY advisories on synthetically generated content.</p>
      <div className="mt-6 space-y-4">
        <p>{company}&apos;s Lookuvi product shows hair, brow, beard, nail, bridal, and makeup <strong>previews</strong>. Style previews are produced by an AI image model. They are a guide for a conversation with a stylist — not a photograph of a finished service and not a promise of the cut, colour, or makeup you will receive.</p>
        <h2 className="font-serif text-2xl">Labelling</h2>
        <p>On-screen try-on results carry a visible <strong>AI-generated</strong> label. Downloaded filenames are prefixed so the file is recognisable as a preview. Live hair colour that runs only on your device is not an AI-generated image from our servers; it is labelled as on-device where shown.</p>
        <h2 className="font-serif text-2xl">Processors</h2>
        <p>Depending on salon and platform settings, a style preview may be processed by fal (Black Forest Labs FLUX), OpenAI, and/or Google Gemini. Those processors may handle the photo on servers outside India. Lookuvi does not use guest photos to train its own models. Provider paid-tier terms apply; free-tier keys must not be used in production.</p>
        <h2 className="font-serif text-2xl">Your rights</h2>
        <p>Photo consent, withdrawal, and deletion are described on the <Link className="underline" href="/privacy">Privacy</Link> page.</p>
      </div>
      <LegalFooter />
    </main>
  );
}
