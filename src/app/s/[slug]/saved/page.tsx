import { notFound } from "next/navigation";
import { GuestNav } from "@/components/guest/GuestNav";
import { SavedLooks } from "@/components/guest/SavedLooks";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { SalonPaused } from "@/components/guest/SalonPaused";
import { guestJoinHref } from "@/lib/guest-nav";
import { loadTenantBySlug } from "@/lib/salon";
import { isBlockedStatus } from "@/lib/salon-status";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export default async function SavedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await loadTenantBySlug(slug);
  if (!tenant) notFound();
  if (isBlockedStatus(tenant.status)) return <SalonPaused name={tenant.name} trialEnded={tenant.status === "EXPIRED"} />;
  const lang = tenant.defaultLang || "en";
  const phone = normalizeWhatsAppPhone(tenant.whatsapp);
  const bookHref = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(`Hi ${tenant.name}, I would like to book an appointment.`)}`
    : "";
  const joinHref = guestJoinHref({ slug: tenant.slug, showQueue: tenant.productQueue, bookHref });
  return (
    <div className="guest-shell">
      <main className="pt-6">
        <p className="text-sm text-muted">{tenant.name}</p>
        <SavedLooks slug={tenant.slug} lang={lang} />
      </main>
      <LegalFooter />
      <GuestNav slug={tenant.slug} lang={lang} joinHref={joinHref} current="saved" />
    </div>
  );
}
