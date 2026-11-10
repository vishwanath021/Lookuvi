import { notFound } from "next/navigation";
import { GuestNav } from "@/components/guest/GuestNav";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { SalonPaused } from "@/components/guest/SalonPaused";
import { t } from "@/data/i18n";
import { guestJoinHref } from "@/lib/guest-nav";
import { loadTenantBySlug } from "@/lib/salon";
import { isBlockedStatus } from "@/lib/salon-status";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export default async function ServicesPage({ params }: { params: Promise<{ slug: string }> }) {
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
  const services = [...tenant.services].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="guest-shell">
      <main className="pt-6">
        <h1 className="page-title">{tenant.name}</h1>
        <h2 className="mt-4 text-base font-semibold">{t(lang, "services")}</h2>
        {services.length === 0 ? <p className="mt-3 text-sm text-muted">{t(lang, "servicesEmpty")}</p> : (
          <ul className="mt-3 divide-y divide-line rounded-[14px] border border-line bg-white">
            {services.map((service) => (
              <li key={service.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <span className="min-w-0">{service.name}</span>
                <span className="shrink-0 font-medium">₹{service.priceInr.toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
      <LegalFooter />
      <GuestNav slug={tenant.slug} lang={lang} joinHref={joinHref} current="services" />
    </div>
  );
}
