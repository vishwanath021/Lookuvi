import { createHmac, timingSafeEqual } from "node:crypto";
import { stopScope } from "@/lib/customers/parse";
import { indianMobile } from "@/lib/queue/phone";

export function whatsAppSignature(raw: string, secret: string) {
  return `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
}

export function signatureMatches(raw: string, header: string, secret: string) {
  if (!secret || !header) return false;
  const expected = whatsAppSignature(raw, secret);
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function messagesFrom(body: unknown) {
  const root = body as { entry?: { changes?: { value?: { messages?: { from?: string; type?: string; text?: { body?: string } }[] } }[] }[] };
  const found: { from: string; text: string }[] = [];
  for (const entry of root.entry || []) {
    for (const change of entry.changes || []) {
      for (const message of change.value?.messages || []) {
        if (message.type === "text" && message.from && message.text?.body) found.push({ from: message.from, text: message.text.body });
      }
    }
  }
  return found;
}

export type StopEvent = { phone: string; scope: "salon" | "global" };

/**
 * STOP is for one salon. STOPALL and UNSUBSCRIBE leave the shared WhatsApp number entirely.
 * A later global word wins over a salon word in the same payload.
 */
export function stopEventsFromPayload(body: unknown): StopEvent[] {
  const events = new Map<string, StopEvent>();
  for (const message of messagesFrom(body)) {
    const scope = stopScope(message.text);
    if (!scope) continue;
    const phone = indianMobile(message.from);
    if (!phone) continue;
    const current = events.get(phone);
    if (!current || scope === "global") events.set(phone, { phone, scope });
  }
  return [...events.values()];
}
