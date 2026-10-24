import { CatalogTags } from "@/components/admin/CatalogTags";
import { STYLES, toPublicStyle } from "@/data/styles";
import { readCatalogOverrides } from "@/lib/catalog-tags";
import { applySuitability } from "@/lib/hair-suitability";
import { pageSuper } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SuperStylesPage() {
  await pageSuper();
  const overrides = await readCatalogOverrides();
  const styles = STYLES.map((style) => {
    const raw = overrides[style.id] ? JSON.stringify(overrides[style.id]) : "";
    const pub = applySuitability(toPublicStyle(style), raw);
    return { id: pub.id, name: pub.name, gender: pub.gender, density: pub.density, texture: pub.texture, faceShapes: pub.faceShapes };
  });
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="page-title">Styles</h1>
      <p className="mt-2 mb-4 text-sm text-muted">Density and texture for every salon.</p>
      <CatalogTags styles={styles} />
    </main>
  );
}
