import { createHmac, timingSafeEqual } from "node:crypto";
import { isStopText } from "@/lib/customers/parse";
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

/** Phones that sent STOP, STOPALL, or UNSUBSCRIBE. Anything else is ignored. */
export function stopPhonesFromPayload(body: unknown) {
  const phones = new Set<string>();
  for (const message of messagesFrom(body)) {
    if (!isStopText(message.text)) continue;
    const phone = indianMobile(message.from);
    if (phone) phones.add(phone);
  }
  return [...phones];
}
