import { SalonsBoard } from "@/components/admin/SalonsBoard";
import { platformAiView } from "@/lib/ai/settings-store";
import { loadSalons } from "@/lib/super/directory";
import { pageSuper } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SalonsPage() {
  await pageSuper();
  const [rows, ai] = await Promise.all([loadSalons(), platformAiView()]);
  const aiReady = ai.openaiKey.saved || ai.falKey.saved;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <SalonsBoard rows={rows} aiReady={aiReady} />
    </main>
  );
}
