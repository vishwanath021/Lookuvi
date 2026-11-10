/** Guest-facing token. Two digits, no hash: 2 is "02". */
export function formatToken(token: number) {
  const whole = Number.isFinite(token) ? Math.max(0, Math.trunc(token)) : 0;
  return String(whole).padStart(2, "0");
}
