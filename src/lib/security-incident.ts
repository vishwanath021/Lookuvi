import { prisma } from "@/lib/prisma";
import { logError, logInfo } from "@/lib/logger";

/**
 * Record a security / cyber incident for CERT-In readiness.
 * Does not phone home to CERT-In — operators must report within 6 hours.
 * Never pass photos, OTPs, raw phones, or secrets in `detail`.
 */
export async function logSecurityIncident(input: {
  summary: string;
  detail?: Record<string, unknown>;
  actorId?: string;
}) {
  const summary = input.summary.slice(0, 500);
  logError("security incident", { summary, ...(input.detail || {}) });
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId || "system",
        action: "SECURITY_INCIDENT",
        target: "platform",
        meta: JSON.stringify({
          summary,
          detail: input.detail || {},
          reportedAt: new Date().toISOString(),
          certInReminder: "Report to CERT-In within 6 hours if the incident is reportable.",
        }).slice(0, 4000),
      },
    });
    logInfo("security incident recorded", { summary });
  } catch (error) {
    logError("security incident persist failed", { summary, error: String(error) });
  }
}
