import { SpendBoard } from "@/components/admin/SpendBoard";
import { monthSpendTiles, salonMargins } from "@/lib/billing/margins";
import { pageSuper } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SpendPage() {
  await pageSuper();
  const [tiles, rows] = await Promise.all([monthSpendTiles(), salonMargins()]);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="page-title">Spend & costs</h1>
      <SpendBoard tiles={tiles} rows={rows} />
    </main>
  );
}
