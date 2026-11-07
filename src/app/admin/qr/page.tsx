import QRCode from "qrcode";
import { PrintButton } from "@/components/PrintButton";
import { QrCard } from "@/components/qr/QrCard";
import { counterTarget } from "@/lib/at-salon";
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
  const counter = await counterTarget(tenant.id, tenant.slug);
  const counterSrc = await QRCode.toDataURL(counter.url, { margin: 1, width: 280, color: { dark: "#12312e", light: "#ffffff" } });
  return (
    <main className="mx-auto max-w-sm">
      <h1 className="page-title print:hidden">QR</h1>
      {welcome.local ? (
        <p className="mt-4 text-sm" role="status" data-qr-warning="yes">Add the public website address, then this page will show a QR you can put at the reception.</p>
      ) : (
        <div className="mt-4 text-center">
          <QrCard name={tenant.name} slug={tenant.slug} url={welcome.url} />
          <p className="mt-3 text-sm text-muted print:hidden">
            Customers open: <a className="underline" href={welcome.url} target="_blank" rel="noreferrer" data-qr-link="yes">{welcome.url}</a>
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 print:hidden">
            <PrintButton label="Print card" />
            <a className="btn secondary" href={`/api/v1/qr?slug=${tenant.slug}&format=card`} download>Download card</a>
          </div>
        </div>
      )}
      <section className="card mt-6 p-4 text-center print:hidden" data-counter-qr="yes">
        <h2 className="font-serif text-2xl">Counter QR (changes daily)</h2>
        <p className="mt-2 text-sm text-muted">Customers scan this at the counter. It works for today only. A photo of yesterday&apos;s code will not.</p>
        <img className="mx-auto mt-4 w-56" src={counterSrc} alt="Counter QR that changes daily" />
      </section>
    </main>
  );
}
