import { companyLegalName, marketingUnsubscribeUrl, postalAddress } from "@/lib/legal";

/** True when a production sender is configured. Dev may still show a link on screen. */
export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY || process.env.SMTP_URL);
}

/** True only when local/dev is allowed to return a one-time link in the JSON body. Never on in production (env gate refuses boot). */
export function exposeDevMagicLink() {
  return process.env.ALLOW_DEV_MAGIC_LINK === "true" && process.env.NODE_ENV !== "production";
}

export const MAIL_NOT_CONFIGURED =
  "Email is not configured. Set RESEND_API_KEY or SMTP_URL, and EMAIL_FROM. Until then, reset links and magic links are not sent. An operator can set a password with node scripts/create-super-admin.mjs.";

export function mailFooter(kind: "transactional" | "marketing" = "transactional") {
  const company = companyLegalName();
  const postal = postalAddress();
  const lines = ["", "—", `Sent by ${company} (Lookuvi).`, `Postal: ${postal}`];
  if (kind === "marketing") {
    const unsub = marketingUnsubscribeUrl();
    if (unsub) lines.push(`Unsubscribe: ${unsub}`);
  }
  return lines.join("\n");
}

/** Sends one plain-text message. The body can contain a one-time link, so callers must not log it. */
export async function sendMail(
  to: string,
  subject: string,
  text: string,
  opts?: { kind?: "transactional" | "marketing" },
) {
  const from = process.env.EMAIL_FROM || "Agentic Build Works <login@agenticbuildworks.com>";
  const body = `${text.trimEnd()}\n${mailFooter(opts?.kind || "transactional")}`;
  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text: body }),
    });
    return res.ok;
  }
  const url = process.env.SMTP_URL;
  if (!url) return false;
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport(url);
  await transport.sendMail({ from, to, subject, text: body });
  return true;
}
