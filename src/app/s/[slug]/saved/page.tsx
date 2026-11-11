import { notFound } from "next/navigation";
import { GuestNav } from "@/components/guest/GuestNav";
import { SavedLooks } from "@/components/guest/SavedLooks";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { SalonPaused } from "@/components/guest/SalonPaused";
import { guestPageLocale, parseLanguages } from "@/data/i18n";
import { loadTenantBySlug } from "@/lib/salon";
import { isBlockedStatus } from "@/lib/salon-status";

export const dynamic = "force-dynamic";

export default async function SavedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await loadTenantBySlug(slug);
  if (!tenant) notFound();
  if (isBlockedStatus(tenant.status)) return <SalonPaused name={tenant.name} trialEnded={tenant.status === "EXPIRED"} />;
  const lang = guestPageLocale(tenant.defaultLang, parseLanguages(tenant.languages));
  return (
    <div className="guest-shell">
      <main className="pt-6">
        <p className="text-sm text-muted">{tenant.name}</p>
        <SavedLooks slug={tenant.slug} lang={lang} />
      </main>
      <LegalFooter />
      <GuestNav slug={tenant.slug} lang={lang} current="saved" />
    </div>
  );
}
