import { DueVisitBoard } from "@/components/admin/DueVisitBoard";
import { listDueVisits } from "@/lib/visit-reminders-data";
import { pageTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DueVisitPage() {
  const { tenant, membership } = await pageTenant();
  if (membership.role !== "OWNER") {
    return (
      <main>
        <h1 className="page-title">Due for a visit</h1>
        <p className="mt-3 text-base">Only the salon owner can send these reminders.</p>
      </main>
    );
  }
  if (!tenant.productQueue) {
    return (
      <main>
        <h1 className="page-title">Due for a visit</h1>
        <p className="mt-3 text-base">Turn on the queue to remind customers to come back.</p>
      </main>
    );
  }
  const listed = await listDueVisits(tenant);
  return (
    <main>
      <h1 className="page-title">Due for a visit</h1>
      <DueVisitBoard initialRows={listed.customers} days={listed.days} />
    </main>
  );
}
