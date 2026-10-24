import { ServiceEditor } from "@/components/admin/ServiceEditor";
import { BRIDAL_PACKAGE_KEYS } from "@/data/bridal";
import { prisma } from "@/lib/prisma";
import { pageTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const { tenant, membership } = await pageTenant();
  const services = await prisma.service.findMany({ where: { tenantId: tenant.id }, orderBy: { name: "asc" } });
  const rows = services
    .filter((service) => tenant.productBridal || !BRIDAL_PACKAGE_KEYS.has(service.key))
    .map((service) => ({
      id: service.id,
      key: service.key,
      name: service.name,
      priceInr: service.priceInr,
      durationMin: service.durationMin,
      active: service.active,
    }));
  return (
    <main>
      <h1 className="mb-4 page-title">Prices</h1>
      <ServiceEditor initial={rows} bridal={tenant.productBridal} canEdit={membership.role === "OWNER"} />
    </main>
  );
}
