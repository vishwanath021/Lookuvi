import { isBlockedStatus } from "@/lib/salon-status";
import { notFound } from "next/navigation";
import { GuestNav } from "@/components/guest/GuestNav";
import { QueueTicket } from "@/components/guest/QueueTicket";
import { SalonPaused } from "@/components/guest/SalonPaused";
import { guestPageLocale, parseLanguages } from "@/data/i18n";
import { QueueError, guestTicket } from "@/lib/queue/service";
import { loadTenantBySlug } from "@/lib/salon";

export const dynamic = "force-dynamic";

export default async function QueueStatusPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const tenant = await loadTenantBySlug(slug);
  if (!tenant) notFound();
  const lang = guestPageLocale(tenant.defaultLang, parseLanguages(tenant.languages));
  if (!tenant.productQueue) {
    return (
      <div className="guest-shell">
        <main className="mx-auto max-w-lg py-16 text-center">
          <h1 className="page-title">{tenant.name}</h1>
          <p className="mt-3 text-sm">The queue is turned off for this salon.</p>
        </main>
        <GuestNav slug={tenant.slug} lang={lang} />
      </div>
    );
  }
  if (isBlockedStatus(tenant.status)) return <SalonPaused name={tenant.name} trialEnded={tenant.status === "EXPIRED"} />;
  try {
    const ticket = await guestTicket(tenant.slug, token);
    return (
      <div className="guest-shell">
        <main className="mx-auto max-w-lg py-8">
          <h1 className="page-title">{tenant.name}</h1>
          <QueueTicket slug={tenant.slug} initial={ticket} />
        </main>
        <GuestNav slug={tenant.slug} lang={lang} />
      </div>
    );
  } catch (error) {
    if (error instanceof QueueError) {
      return (
        <div className="guest-shell">
          <main className="mx-auto max-w-lg py-16 text-center">
            <h1 className="page-title">{tenant.name}</h1>
            <p className="mt-3 text-sm">That visit was not found.</p>
          </main>
          <GuestNav slug={tenant.slug} lang={lang} />
        </div>
      );
    }
    throw error;
  }
}
