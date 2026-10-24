import { CustomersBoard } from "@/components/admin/CustomersBoard";
import { listCustomers, returnStats } from "@/lib/customers/service";
import { templateFor, whatsAppConfigured, type NotifyEnv } from "@/lib/notify";
import { pageTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { tenant, membership } = await pageTenant();
  if (!tenant.productQueue) {
    return (
      <main>
        <h1 className="page-title">Customers</h1>
        <p className="mt-3 text-sm">Turn on the queue to keep a customer list.</p>
      </main>
    );
  }
  const [customers, stats] = await Promise.all([
    listCustomers(tenant.id, ""),
    returnStats(tenant.id),
  ]);
  const env = process.env as NotifyEnv;
  const whatsapp = !whatsAppConfigured(env) ? "off" : !templateFor("reminder", env) || !templateFor("offer", env) ? "template" : "ready";
  return (
    <main>
      <h1 className="page-title">Customers</h1>
      <CustomersBoard
        role={membership.role}
        initialCustomers={customers}
        initialStats={{ ...stats, cap: tenant.whatsappMonthlyCap }}
        settings={{ remindersOn: tenant.remindersOn, reminderDays: tenant.reminderDays, whatsappMonthlyCap: tenant.whatsappMonthlyCap }}
        whatsapp={whatsapp}
      />
    </main>
  );
}
