import { cardDisplayUrl } from "@/lib/qr-card";

/** Printable card with only the salon name, the QR and the customer website. */
export function QrCard({ name, slug, url }: { name: string; slug: string; url: string }) {
  return (
    <article id="qr-card" data-qr-card="yes" className="qr-card mx-auto w-full max-w-xs rounded-2xl border border-line bg-white p-8 text-center text-[#12312e]">
      <h2 className="font-serif text-2xl font-bold leading-tight" data-qr-card-name="yes">{name}</h2>
      <img className="mx-auto mt-6 w-56" src={`/api/v1/qr?slug=${encodeURIComponent(slug)}&format=png`} alt={`QR code for ${name}`} />
      <p className="mt-6 break-all text-base" data-qr-card-url="yes">{cardDisplayUrl(url)}</p>
    </article>
  );
}
