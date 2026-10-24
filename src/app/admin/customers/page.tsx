import { CustomersBoard } from "@/components/admin/CustomersBoard";
import { listCustomers, returnStats } from "@/lib/customers/service";
import { templateFor, whatsAppConfigured, type NotifyEnv } from "@/lib/notify";
import { queueHomeUrl, tryOnUrl } from "@/lib/queue/messages";
import { pageTenant } from "@/lib/session";
import { monthlySucceededTries } from "@/lib/try-allowance";

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
  const [customers, stats, tries] = await Promise.all([
    listCustomers(tenant.id, ""),
    returnStats(tenant.id),
    tenant.productTryOn ? monthlySucceededTries(tenant.id) : Promise.resolve(null),
  ]);
  const env = process.env as NotifyEnv;
  const whatsapp = !whatsAppConfigured(env) ? "off" : !templateFor("reminder", env) || !templateFor("offer", env) ? "template" : "ready";
  return (
    <main>
      <h1 className="page-title">Customers</h1>
      <p className="mt-1 text-sm text-muted">A number is saved when the desk types a phone or someone joins from home. A visit is counted when you mark them done.</p>
      <CustomersBoard
        role={membership.role}
        initialCustomers={customers}
        initialStats={{ ...stats, cap: tenant.whatsappMonthlyCap }}
        settings={{ remindersOn: tenant.remindersOn, reminderDays: tenant.reminderDays, whatsappMonthlyCap: tenant.whatsappMonthlyCap }}
        whatsapp={whatsapp}
        homeLink={queueHomeUrl(tenant.slug)}
        tryOnLink={tryOnUrl(tenant.slug)}
        tries={tries === null ? null : { used: tries, allowance: tenant.monthlyTryAllowance }}
      />
    </main>
  );
}
