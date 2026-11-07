import { CSRF_MESSAGE } from "@/lib/http/csrf";

/** How the owner desk should treat one /api/v1/admin/queue response. */

export type DeskPayload = { error?: string; message?: string; state?: unknown };

export type DeskFailure =
  | { type: "login" }
  | { type: "retry"; message: string }
  | { type: "stale"; message: string };

export const DESK_SESSION_ENDED = "Your session has ended. Sign in again.";
export const DESK_CSRF_MESSAGE = CSRF_MESSAGE;
export const DESK_STALE_MESSAGE = "The queue could not refresh. This list may be out of date.";
export const DESK_FORBIDDEN_MESSAGE = "You do not have permission to update the queue.";

export function deskFailure(status: number, data: DeskPayload | null | undefined): DeskFailure | null {
  const error = data?.error || "";
  if (status === 401 || error === "UNAUTHENTICATED") return { type: "login" };
  if (error === "CSRF") return { type: "retry", message: data?.message || DESK_CSRF_MESSAGE };
  if (status === 403) return { type: "retry", message: data?.message || DESK_FORBIDDEN_MESSAGE };
  if (status >= 400 || !data?.state) return { type: "stale", message: data?.message || DESK_STALE_MESSAGE };
  return null;
}
