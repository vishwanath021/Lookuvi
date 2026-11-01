import { SettingsForm } from "@/components/admin/SettingsForm";
import { gstEnabled } from "@/lib/pricing";
import { planById } from "@/data/plans";
import { ownerFeatures } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { signSalonToken } from "@/lib/preview-access";
import { salonGuestOrigin } from "@/lib/public-url";
import { pageTenant } from "@/lib/session";
import { enabledTools } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { tenant, membership } = await pageTenant();
  if (membership.role !== "OWNER") {
    return <main><h1 className="page-title">Settings</h1><p className="mt-2">Staff cannot change settings or prices.</p></main>;
  }
  const members = await prisma.membership.findMany({
    where: { tenantId: tenant.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ role: "asc" }, { id: "asc" }],
  });
  const origin = await salonGuestOrigin(tenant.id, tenant.slug);
  const salonModeUrl = tenant.salonNonce ? `${origin}/?salon=${signSalonToken(tenant.id, tenant.salonNonce)}` : "";
  return (
    <main>
      <h1 className="mb-4 page-title">Settings</h1>
      <SettingsForm
        salonModeUrl={salonModeUrl}
        selfId={membership.userId}
        members={members.map((row) => ({ userId: row.user.id, name: row.user.name, email: row.user.email, role: row.role }))}
        canRemoveBranding={planById(tenant.plan).removeBranding}
        enabledTools={[...enabledTools()]}
        showTryOn={tenant.productTryOn}
        showDomain={ownerFeatures().customDomain}
        showGst={gstEnabled()}
        initial={{
          name: tenant.name,
          primaryColor: tenant.primaryColor,
          accentColor: tenant.accentColor,
          whatsapp: tenant.whatsapp,
          address: tenant.address,
          mapsUrl: tenant.mapsUrl,
          city: tenant.city,
          gstin: tenant.gstin || "",
          removeBranding: tenant.removeBranding,
          toolColour: tenant.toolColour,
          toolStyle: tenant.toolStyle,
          toolBrows: tenant.toolBrows,
          toolBeard: tenant.toolBeard,
          toolNails: tenant.toolNails,
          hairPickerOn: tenant.hairPickerOn,
          hairSuggestOn: tenant.hairSuggestOn,
          hairSuggestUsesCredits: tenant.hairSuggestUsesCredits,
          anonDailyCap: tenant.anonDailyCap,
          memberDailyCap: tenant.memberDailyCap,
          monthlyTryAllowance: tenant.monthlyTryAllowance,
          requireLoginToBook: tenant.requireLoginToBook,
          productBridal: tenant.productBridal,
          productGroom: tenant.productGroom,
          productMakeupStudio: tenant.productMakeupStudio,
          visitTryLimit: tenant.visitTryLimit,
          logoUrl: tenant.logoUrl,
          openTime: tenant.openTime,
          closeTime: tenant.closeTime,
        }}
      />
    </main>
  );
}
