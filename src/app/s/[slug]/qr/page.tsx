import { isBlockedStatus } from "@/lib/salon-status";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SalonPaused } from "@/components/guest/SalonPaused";
import { PrintButton } from "@/components/PrintButton";
import { QrCard } from "@/components/qr/QrCard";
import { brandStyle } from "@/lib/contrast";
import { salonWelcomeTarget } from "@/lib/public-url";
import { loadTenantBySlug } from "@/lib/salon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await loadTenantBySlug(slug);
  const name = tenant?.name || "Lookuvi";
  return { title: { absolute: `${name} QR` } };
}

export default async function QrStandee({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await loadTenantBySlug(slug);
  if (!tenant) notFound();
  if (isBlockedStatus(tenant.status)) return <SalonPaused name={tenant.name} trialEnded={tenant.status === "EXPIRED"} />;
  if (!tenant.productTryOn && !tenant.productQueue) notFound();
  const target = await salonWelcomeTarget(tenant.id, tenant.slug);
  return (
    <main className="mx-auto max-w-md px-4 py-8 print:max-w-none" style={brandStyle(tenant.primaryColor, tenant.accentColor) as CSSProperties}>
      {target.local ? (
        <article className="card p-8 text-center">
          <h1 className="page-title">{tenant.name}</h1>
          <p className="mt-6 text-sm" role="alert" data-qr-warning="yes">This QR is not ready to print. The salon address is on this computer, not a real domain. Set the public domain, or verify the salon’s own domain, then print again.</p>
        </article>
      ) : (
        <QrCard name={tenant.name} slug={tenant.slug} url={target.url} />
      )}
      <div className="mt-4 flex justify-center print:hidden">
        {target.local ? null : <PrintButton label="Download / Print" />}
      </div>
    </main>
  );
}
