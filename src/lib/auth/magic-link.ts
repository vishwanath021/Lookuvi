import { createHash } from "node:crypto";
import { checkUserTotp } from "@/lib/account-totp";
import { prisma } from "@/lib/prisma";

export type MagicSessionUser = {
  id: string;
  email: string;
  name: string | null;
  isSuperAdmin: boolean;
  tenantId?: string;
  role?: string;
  sessionVersion: number;
};

export type MagicRedeemResult =
  | { ok: true; user: MagicSessionUser }
  | { ok: false; reason: "invalid" | "used" | "expired" | "totp_required" | "totp_invalid" };

/**
 * Validates a one-time magic-link token and marks it used only after the authenticator check passes.
 * Password resets live in a different table and are never read here.
 */
export async function redeemMagicLink(token: string, totp: string): Promise<MagicRedeemResult> {
  if (typeof token !== "string" || token.length < 20) return { ok: false, reason: "invalid" };
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const link = await prisma.magicLink.findUnique({ where: { tokenHash } });
  if (!link) return { ok: false, reason: "invalid" };
  if (link.used) return { ok: false, reason: "used" };
  if (link.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  const email = link.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { ok: false, reason: "invalid" };
  const totpResult = await checkUserTotp(user, totp);
  if (totpResult === "missing") return { ok: false, reason: "totp_required" };
  if (totpResult === "invalid") return { ok: false, reason: "totp_invalid" };
  await prisma.magicLink.update({ where: { id: link.id }, data: { used: true } });
  const membership = await prisma.membership.findFirst({ where: { userId: user.id }, orderBy: { role: "asc" } });
  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
      tenantId: membership?.tenantId,
      role: membership?.role,
      sessionVersion: user.sessionVersion,
    },
  };
}
