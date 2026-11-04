import { SuperAiForm } from "@/components/admin/SuperAiForm";
import { guestModelPriceRows } from "@/lib/ai/guest-prices";
import { salonSpendCapInr } from "@/lib/ai/spend";
import { platformAiView } from "@/lib/ai/settings-store";
import { pageSuper } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SuperAiPage() {
  await pageSuper();
  const initial = await platformAiView({ spend: "skip" });
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="page-title">AI</h1>
      <p className="mt-2 mb-4 text-sm text-muted">Sunburst is the default. Pick another model to try it on guest hairstyles.</p>
      <SuperAiForm initial={initial} salonCapInr={salonSpendCapInr()} prices={guestModelPriceRows()} />
    </main>
  );
}
