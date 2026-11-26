export type CreateOrderInput = {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
};

export type CreateOrderResult = { id: string };

export function razorpayAuthHeader(keyId: string, keySecret: string) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

export async function createRazorpayOrder(
  input: CreateOrderInput,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CreateOrderResult> {
  const keyId = env.RAZORPAY_KEY_ID?.trim() || "";
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim() || "";
  if (!keyId || !keySecret) throw new Error("RAZORPAY_NOT_CONFIGURED");
  const response = await fetchImpl("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      authorization: razorpayAuthHeader(keyId, keySecret),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    }),
  });
  if (!response.ok) throw new Error(`RAZORPAY_ORDER_${response.status}`);
  return (await response.json()) as CreateOrderResult;
}