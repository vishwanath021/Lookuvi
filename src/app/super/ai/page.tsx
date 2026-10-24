import { SuperAiForm } from "@/components/admin/SuperAiForm";
import { salonSpendCapInr } from "@/lib/ai/spend";
import { platformAiView } from "@/lib/ai/settings-store";
import { pageSuper } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SuperAiPage() {
  await pageSuper();
  const initial = await platformAiView();
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="page-title">AI</h1>
      <p className="mt-2 mb-4 text-sm text-muted">One model in use, one fallback.</p>
      <SuperAiForm initial={initial} salonCapInr={salonSpendCapInr()} />
    </main>
  );
}
