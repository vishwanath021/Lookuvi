import { SuperCostPanel } from "@/components/admin/SuperCostPanel";
import { costReport } from "@/lib/ai/cost-report";
import { pageSuper } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ImageLogPage() {
  await pageSuper();
  const costs = await costReport({ imagesPerMonth: 0 });
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="page-title">Image log</h1>
      <p className="mt-2 text-sm"><a className="underline" href="/super/costs">Back to spend</a></p>
      <SuperCostPanel initial={costs} />
    </main>
  );
}
