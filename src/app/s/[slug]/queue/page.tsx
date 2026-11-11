import { isBlockedStatus } from "@/lib/salon-status";
import { notFound } from "next/navigation";
import { GuestNav } from "@/components/guest/GuestNav";
import { SalonPaused } from "@/components/guest/SalonPaused";
import { QueueJoinForm } from "@/components/guest/QueueJoinForm";
import { guestPageLocale, parseLanguages } from "@/data/i18n";
import { loadTenantBySlug } from "@/lib/salon";
import { publicBoard } from "@/lib/queue/service";

export const dynamic = "force-dynamic";

export default async function GuestQueuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await loadTenantBySlug(slug);
  if (!tenant) notFound();
  if (!tenant.productQueue) {
    return (
      <div className="guest-shell">
        <main className="py-10 text-center">
          <h1 className="page-title">{tenant.name}</h1>
          <p className="mt-3 text-sm">The queue is turned off for this salon.</p>
        </main>
        <GuestNav slug={tenant.slug} lang={guestPageLocale(tenant.defaultLang, parseLanguages(tenant.languages))} />
      </div>
    );
  }
  if (isBlockedStatus(tenant.status)) return <SalonPaused name={tenant.name} trialEnded={tenant.status === "EXPIRED"} />;
  const board = await publicBoard(tenant.slug);
  return (
    <div className="guest-shell">
      <main className="pt-6">
        <h1 className="page-title">{tenant.name}</h1>
        <QueueJoinForm initial={board} />
      </main>
      <GuestNav slug={tenant.slug} lang={guestPageLocale(tenant.defaultLang, parseLanguages(tenant.languages))} />
    </div>
  );
}
