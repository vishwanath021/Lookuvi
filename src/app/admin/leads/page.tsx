import { LeadList } from "@/components/admin/LeadList";
import { planById } from "@/data/plans";
import { humanLookName, humanShade } from "@/lib/display";
import { formatEventDate, sortLeads } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { pageTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

function leadWhen(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export default async function LeadsPage() {
  const { tenant } = await pageTenant();
  const canExport = planById(tenant.plan).leadExport;
  const [dated, recent] = await Promise.all([
    prisma.lead.findMany({
      where: { tenantId: tenant.id, type: "BRIDAL", eventDate: { not: "" } },
      orderBy: { eventDate: "asc" },
      take: 40,
    }),
    prisma.lead.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
  ]);
  const seen = new Set<string>();
  const leads = sortLeads([...dated, ...recent].filter((lead) => {
    if (seen.has(lead.id)) return false;
    seen.add(lead.id);
    return true;
  })).map((lead) => ({
    id: lead.id,
    when: leadWhen(lead.createdAt),
    look: humanLookName(lead.lookName),
    shade: lead.shadeName ? humanShade(lead.shadeName) : "",
    type: lead.type,
    eventName: lead.eventName,
    eventDate: lead.eventDate ? formatEventDate(lead.eventDate) : "",
    name: lead.name || "",
    phone: lead.phone || "",
    status: lead.status,
  }));
  return (
    <main>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Leads</h1>
          <p className="mt-1 text-sm text-muted">People who asked to book a look they tried.</p>
        </div>
        {/* File download, not a client navigation. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        {canExport ? <a className="btn secondary min-h-11 shrink-0" href="/api/v1/admin/leads/export" aria-label="Download CSV">CSV</a> : <p className="text-sm text-muted">Lead export is included with Standard and Pro.</p>}
      </div>
      <LeadList leads={leads} />
    </main>
  );
}
