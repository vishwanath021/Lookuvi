/** Customer writes a staff member must not perform. Viewing the list, including points, stays open to staff. */
export function customerActionNeedsOwner(action: string) {
  return action === "adjust" || action === "settings" || action === "broadcast" || action === "resume" || action === "comeback";
}

/** Redeeming a reward spends points. Finishing a visit still earns points for staff. */
export function queueActionNeedsOwner(action: string) {
  return action === "redeem";
}
