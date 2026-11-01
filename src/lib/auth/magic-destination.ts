/** Client-safe copy and routing for a magic-link sign-in. No database access. */

export const MAGIC_LINK_REJECTED =
  "This sign-in link is invalid, already used, or has expired. You are not signed in.";

export type MagicSignInResult = {
  error?: string | null;
  code?: string | null;
  ok?: boolean;
};

export type MagicUiOutcome =
  | { kind: "signed-in" }
  | { kind: "totp"; invalid: boolean }
  | { kind: "rejected" };

export function homeForUser(user: { isSuperAdmin?: boolean } | null | undefined) {
  return user?.isSuperAdmin ? "/super" : "/admin";
}

/** Maps an Auth.js `signIn("magic")` result onto the login screen. A missing or failed result stays signed out. */
export function interpretMagicResult(result: MagicSignInResult | null | undefined): MagicUiOutcome {
  if (result?.code === "totp_required" || result?.code === "totp_invalid") {
    return { kind: "totp", invalid: result.code === "totp_invalid" };
  }
  if (!result || result.error || result.ok === false) return { kind: "rejected" };
  return { kind: "signed-in" };
}
