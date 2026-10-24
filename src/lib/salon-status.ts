/** A trial that ran out is EXPIRED. SUSPENDED is a manual pause. Both block guests. */
export function isBlockedStatus(status: string | null | undefined) {
  return status === "SUSPENDED" || status === "EXPIRED";
}

export function blockedGuestMessage(status: string) {
  return status === "EXPIRED" ? "This salon's trial has ended." : "This salon's try-on is paused.";
}
