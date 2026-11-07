import { QueueDesk } from "@/components/admin/QueueDesk";
import { kolkataMonthStart } from "@/lib/ai/spend";
import { prisma } from "@/lib/prisma";
import { deskSnapshot } from "@/lib/queue/service";
import { pageTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const { tenant } = await pageTenant();
  if (!tenant.productQueue) {
    return (
      <main>
        <h1 className="page-title">Queue</h1>
        <p className="mt-3 text-sm">Queue is turned off for this salon.</p>
      </main>
    );
  }
  const since = kolkataMonthStart();
  const [desk, tryOns] = await Promise.all([
    deskSnapshot(tenant.id),
    prisma.tryOn.count({ where: { tenantId: tenant.id, status: "SUCCEEDED", createdAt: { gte: since } } }),
  ]);
  return (
    <main>
      <QueueDesk initial={desk} lang={tenant.defaultLang} monthTries={tryOns} showVisits={tenant.productBridal || tenant.productGroom || tenant.productMakeupStudio} />
    </main>
  );
}
