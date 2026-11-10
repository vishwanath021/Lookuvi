import { headers } from "next/headers";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { SalonPaused } from "@/components/guest/SalonPaused";
import { TryOnUnavailable } from "@/components/guest/TryOnUnavailable";
import { AtSalonProvider } from "@/components/guest/AtSalonNote";
import { TryOnApp } from "@/components/tryon/TryOnApp";
import { prisma } from "@/lib/prisma";
import { verifySalonToken } from "@/lib/preview-access";
import { loadTenantByHost, loadTenantBySlug, toSalonConfig } from "@/lib/salon";
import { isBlockedStatus } from "@/lib/salon-status";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const headerList = await headers();
  const host = headerList.get("x-tenant-host") || headerList.get("host") || "";
  const tenant = slug === "by-host" ? await loadTenantByHost(host.split(":")[0] || "") : await loadTenantBySlug(slug);
  const name = tenant?.name || "Lookuvi";
  return { title: { absolute: name }, description: `${name}. See a haircut on your own photo.` };
}

export default async function SalonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tool?: string; style?: string; shade?: string; salon?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const headerList = await headers();
  const host = headerList.get("x-tenant-host") || headerList.get("host") || "";
  const tenant = slug === "by-host" ? await loadTenantByHost(host.split(":")[0] || "") : await loadTenantBySlug(slug);
  if (!tenant) notFound();
  if (isBlockedStatus(tenant.status)) return <SalonPaused name={tenant.name} trialEnded={tenant.status === "EXPIRED"} />;
  if (!tenant.productTryOn && !tenant.productBridal && !tenant.productGroom && !tenant.productMakeupStudio) {
    if (tenant.productQueue) redirect(`/s/${tenant.slug}/queue`);
    return <TryOnUnavailable name={tenant.name} />;
  }
  const config = await toSalonConfig(tenant);
  const salonMode = verifySalonToken(query.salon || "", tenant.id, tenant.salonNonce);
  const session = await auth();
  return (
    <AtSalonProvider slug={tenant.slug} lang={config.defaultLang}>
    <TryOnApp
      config={config}
      initialTool={query.tool}
      initialStyleId={query.style}
      initialShadeId={query.shade}
      salonToken={salonMode ? query.salon : undefined}
      salonMode={salonMode}
      poseDebug={Boolean(session?.user?.isSuperAdmin)}
      showQueue={tenant.productQueue}
      queueMode={tenant.productQueue ? (await prisma.queueState.findUnique({ where: { tenantId: tenant.id }, select: { mode: true } }))?.mode : "LIVE"}
      showEveryday={tenant.productTryOn}
      showBridal={tenant.productBridal}
      showGroom={tenant.productGroom}
      showMakeup={tenant.productMakeupStudio}
    />
    </AtSalonProvider>
  );
}
