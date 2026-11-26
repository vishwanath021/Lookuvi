/** Razorpay test/live keys present — checkout and Pay buttons may run. */
export function razorpayConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.RAZORPAY_KEY_ID?.trim() && env.RAZORPAY_KEY_SECRET?.trim());
}

export function razorpayPublicKeyId(env: NodeJS.ProcessEnv = process.env) {
  return env.RAZORPAY_KEY_ID?.trim() || "";
}

export function paymentsUnavailableMessage() {
  return "Online payments are not configured yet. Contact Lookuvi support.";
}

/** Label shown next to prices (configurable incl. GST copy). */
export function priceInclGstLabel(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.BILLING_PRICE_INCL_GST_TEXT?.trim();
  return raw || "incl. GST";
}

/** Extension point: recurring Razorpay Subscriptions would replace one-time orders here. */
export const SUBSCRIPTION_EXTENSION_NOTE =
  "Salon plan renewals use one-time orders today. Swap createSalonPlanCheckout for subscription.create when subscriptions go live.";