const DAY_MS = 24 * 60 * 60 * 1000;
const IST_MS = 5.5 * 60 * 60 * 1000;
const SIX_WEEKS_MS = 42 * DAY_MS;

/** Add calendar months in Asia/Kolkata, the same clock the lapse bands use. */
export function addIstMonths(from: Date, months: number) {
  const ist = new Date(from.getTime() + IST_MS);
  const shifted = new Date(Date.UTC(
    ist.getUTCFullYear(),
    ist.getUTCMonth() + months,
    ist.getUTCDate(),
    ist.getUTCHours(),
    ist.getUTCMinutes(),
    ist.getUTCSeconds(),
    ist.getUTCMilliseconds(),
  ));
  return new Date(shifted.getTime() - IST_MS);
}

export type ComeBackStep = "send" | "early" | "wait" | "done";

/**
 * One lapse allows two come-back reminders: the first from 6 weeks after the visit,
 * the second only after 2 months, and only if the first went out before that point.
 */
export function comeBackStep(lastVisit: Date | null, sentAt: Date[], now: Date): ComeBackStep {
  if (!lastVisit) return "early";
  const firstAt = new Date(lastVisit.getTime() + SIX_WEEKS_MS);
  const secondAt = addIstMonths(lastVisit, 2);
  if (now < firstAt) return "early";
  const since = sentAt.filter((at) => at >= lastVisit).sort((a, b) => a.getTime() - b.getTime());
  if (since.length >= 2) return "done";
  if (since.length === 0) return "send";
  if (now < secondAt) return "wait";
  if (since[0] >= secondAt) return "done";
  return "send";
}

export function comeBackSkipMessage(step: ComeBackStep) {
  if (step === "wait") return "The next come-back is at 2 months.";
  if (step === "done") return "Already sent the come-back messages for this visit.";
  if (step === "early") return "It is not 6 weeks since the last visit yet.";
  return "";
}
