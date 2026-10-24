import { BRIDAL_PACKAGES } from "@/data/bridal";
import { prisma } from "@/lib/prisma";

/** Creates the three package rows the first time bridal is turned on. A later page load does not insert them again. */
export async function ensureBridalPackages(tenantId: string) {
  const keys = BRIDAL_PACKAGES.map((pack) => pack.key);
  const count = await prisma.service.count({ where: { tenantId, key: { in: keys } } });
  if (count > 0) return 0;
  await prisma.service.createMany({
    data: BRIDAL_PACKAGES.map((pack) => ({
      tenantId,
      key: pack.key,
      name: pack.name,
      priceInr: 0,
      active: false,
      nameI18n: "{}",
    })),
  });
  return BRIDAL_PACKAGES.length;
}
