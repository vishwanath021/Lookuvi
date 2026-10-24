import { STYLES } from "@/data/styles";
import { parseSuitability, type SuitabilityOverride } from "@/lib/hair-suitability";
import { prisma } from "@/lib/prisma";

const KEY = "catalog_suitability";

export async function readCatalogOverrides(): Promise<Record<string, SuitabilityOverride>> {
  const row = await prisma.platformSetting.findUnique({ where: { key: KEY } });
  if (!row?.value) return {};
  try {
    const parsed = JSON.parse(row.value) as Record<string, unknown>;
    const out: Record<string, SuitabilityOverride> = {};
    for (const [id, value] of Object.entries(parsed)) {
      const tags = parseSuitability(JSON.stringify(value));
      if (tags) out[id] = tags;
    }
    return out;
  } catch {
    return {};
  }
}

export async function platformSuitabilityMap() {
  const overrides = await readCatalogOverrides();
  const map = new Map<string, string>();
  for (const [id, tags] of Object.entries(overrides)) {
    map.set(id, JSON.stringify(tags));
  }
  return map;
}

export async function saveCatalogOverride(styleId: string, tags: SuitabilityOverride) {
  if (!STYLES.some((style) => style.id === styleId)) throw new Error("STYLE");
  const current = await readCatalogOverrides();
  current[styleId] = tags;
  await prisma.platformSetting.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify(current) },
    create: { key: KEY, value: JSON.stringify(current) },
  });
}
