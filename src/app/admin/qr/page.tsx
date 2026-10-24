import { PrintButton } from "@/components/PrintButton";
import { salonWelcomeTarget } from "@/lib/public-url";
import { pageTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function QrAdminPage() {
  const { tenant } = await pageTenant();
  if (!tenant.productTryOn && !tenant.productQueue) {
    return (
      <main>
        <h1 className="page-title">QR</h1>
        <p className="mt-3 text-sm">Turn on try-on or the queue to print a QR.</p>
      </main>
    );
  }
  const welcome = await salonWelcomeTarget(tenant.id, tenant.slug);
  return (
    <main className="mx-auto max-w-sm">
      <h1 className="page-title">QR</h1>
      {welcome.local ? (
        <p className="mt-4 text-sm" role="status" data-qr-warning="yes">Add the public website address, then this page will show a QR you can put at the reception.</p>
      ) : (
        <div className="mt-4 text-center">
          <img className="mx-auto w-56" src={`/api/v1/qr?slug=${tenant.slug}&format=png`} alt="" />
          <div className="mt-4 flex justify-center">
            <PrintButton label="Download / Print" />
          </div>
        </div>
      )}
    </main>
  );
}
