import { createHmac, timingSafeEqual } from "node:crypto";

/** Checkout callback: HMAC SHA256 of order_id|payment_id with key secret. */
export function verifyCheckoutCallbackSignature(orderId: string, paymentId: string, signature: string, secret: string) {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}