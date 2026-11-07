import { cookies } from "next/headers";
import { auth } from "@/auth";
import { blockPaidVisit } from "@/lib/at-salon";
import { readGuestToken } from "@/lib/preview-access";
import { prisma } from "@/lib/prisma";

/** Owner, staff, and super-admin skip the at-salon lock. Caps still apply. */
export async function deskUserId(tenantId: string) {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id) return null;
    if (user.isSuperAdmin) return user.id;
    const member = await prisma.membership.findFirst({
      where: { userId: user.id, tenantId, role: { in: ["OWNER", "STAFF"] } },
      select: { userId: true },
    });
    return member?.userId ?? null;
  } catch {
    return null;
  }
}

async function guestPhone(tenantId: string) {
  try {
    const jar = await cookies();
    const guest = readGuestToken(jar.get("helix_guest")?.value);
    if (!guest || guest.tenantId !== tenantId) return "";
    const customer = await prisma.customer.findUnique({ where: { id: guest.customerId }, select: { phone: true } });
    return customer?.phone || "";
  } catch {
    return "";
  }
}

/** One check for every paid guest route. */
export async function gatePaidForm(
  form: FormData,
  tenant: { id: string; tryOnsAtSalon: boolean; visitTryLimit: number },
  sessionId: string,
  flags: { countsAsTry: boolean; legacyVisit: boolean },
) {
  return blockPaidVisit({
    tenant,
    sessionId,
    deviceId: String(form.get("deviceId") || ""),
    phone: await guestPhone(tenant.id),
    bypass: Boolean(await deskUserId(tenant.id)),
    countsAsTry: flags.countsAsTry,
    legacyVisit: flags.legacyVisit,
  });
}
