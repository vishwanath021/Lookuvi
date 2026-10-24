export const UPI_PLACEHOLDER = "lookuvi@upi";

export function upiAccount(env: NodeJS.ProcessEnv = process.env) {
  const raw = (env.LOOKUVI_UPI_ID || env.UPI_ID || "").trim();
  return { id: raw || UPI_PLACEHOLDER, placeholder: !raw };
}

export function upiPayLink(input: { pa: string; amountInr: number; note: string; name?: string }) {
  const params = new URLSearchParams({
    pa: input.pa,
    pn: input.name || "Lookuvi",
    am: input.amountInr.toFixed(2),
    cu: "INR",
    tn: input.note.slice(0, 80),
  });
  return `upi://pay?${params.toString()}`;
}
