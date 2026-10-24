import { STYLES, styleById } from "@/data/styles";
import { prisma } from "@/lib/prisma";

/** Missing catalogue rows are on the menu. A row turns a style off only when enabled is false. */
export function styleOnMenu(row: { enabled: boolean } | undefined | null) {
  return row ? row.enabled : true;
}

/** Insert catalogue styles that this salon has never saved, turned on. */
export async function ensureCatalogueStyles(tenantId: string) {
  const existing = await prisma.tenantStyle.findMany({ where: { tenantId }, select: { styleId: true } });
  const have = new Set(existing.map((row) => row.styleId));
  const missing = STYLES.filter((style) => !have.has(style.id));
  if (!missing.length) return 0;
  await prisma.tenantStyle.createMany({
    data: missing.map((style) => ({ tenantId, styleId: style.id, enabled: true, serviceIds: "[]" })),
  });
  return missing.length;
}

/**
 * Every catalogue style is available at every salon.
 * Density and texture live on the platform catalogue, not a per-salon switch.
 */
export async function styleEnabledForTenant(_tenantId: string, styleId: string) {
  return Boolean(styleById(styleId));
}
