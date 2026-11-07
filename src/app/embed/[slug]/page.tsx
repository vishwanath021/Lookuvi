import { notFound } from "next/navigation";
import { SalonPaused } from "@/components/guest/SalonPaused";
import { AtSalonProvider } from "@/components/guest/AtSalonNote";
import { TryOnApp } from "@/components/tryon/TryOnApp";
import { ownerFeatures } from "@/lib/features";
import { loadTenantBySlug, toSalonConfig } from "@/lib/salon";
import { isBlockedStatus } from "@/lib/salon-status";

export const dynamic = "force-dynamic";

export default async function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await loadTenantBySlug(slug);
  if (!ownerFeatures().embed) notFound();
  if (!tenant || !tenant.productTryOn) notFound();
  if (isBlockedStatus(tenant.status)) return <SalonPaused name={tenant.name} trialEnded={tenant.status === "EXPIRED"} />;
  const config = await toSalonConfig(tenant);
  return (
    <AtSalonProvider slug={tenant.slug} lang={config.defaultLang}>
      <TryOnApp config={config} embed />
    </AtSalonProvider>
  );
}
