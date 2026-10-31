/** Minutes to show between refreshes: the latest server wait, minus whole minutes since that sample, never below 0. */
export function displayedWait(serverWait: number, sampledAt: number, now: number) {
  const wait = Math.max(0, Math.floor(Number(serverWait) || 0));
  const elapsedMin = Math.floor(Math.max(0, now - sampledAt) / 60_000);
  return Math.max(0, wait - elapsedMin);
}

/** Keep the sample clock when the server wait is unchanged so poll updates do not reset the countdown. */
export function waitSample(prev: { wait: number; at: number }, serverWait: number, now: number) {
  const wait = Math.max(0, Math.floor(Number(serverWait) || 0));
  if (wait !== prev.wait) return { wait, at: now };
  return prev;
}
