import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { kolkataDayStart } from "@/lib/queue/day";
import { getObject, putObject } from "@/lib/storage";
import { VISIT_CAP_MESSAGE, VISIT_TRY_KINDS, visitAllowed } from "@/lib/visit-tries";

export function visitPhotoKey(tenantId: string, sessionId: string, photoId: string) {
  return `visit-photos/${tenantId}/${sessionId}/${photoId}.jpg`;
}

export function photoDigest(jpeg: Buffer) {
  return createHash("sha256").update(jpeg).digest("hex");
}

export function isPhotoId(value: string) {
  return /^[a-f0-9]{64}$/.test(value);
}

/** Remember the resized selfie so a later try does not upload or decode it again. */
export async function rememberVisitPhoto(tenantId: string, sessionId: string, jpeg: Buffer) {
  const photoId = photoDigest(jpeg);
  await putObject(visitPhotoKey(tenantId, sessionId, photoId), jpeg, "image/jpeg");
  return photoId;
}

export async function loadVisitPhoto(tenantId: string, sessionId: string, photoId: string) {
  if (!isPhotoId(photoId)) return null;
  return getObject(visitPhotoKey(tenantId, sessionId, photoId));
}

export async function visitStatus(tenantId: string, sessionId: string, limit: number) {
  const [used, grant] = await Promise.all([
    prisma.tryOn.count({
      where: { tenantId, sessionId, status: "SUCCEEDED", kind: { in: [...VISIT_TRY_KINDS] } },
    }),
    prisma.visitGrant.findUnique({ where: { tenantId_sessionId: { tenantId, sessionId } } }),
  ]);
  const bonus = grant?.bonus ?? 0;
  const allowance = Math.max(0, limit) + bonus;
  return { used, limit, bonus, allowance, allowed: visitAllowed(used, limit, bonus) };
}

export async function refuseVisit(tenantId: string, sessionId: string, limit: number) {
  const status = await visitStatus(tenantId, sessionId, limit);
  if (status.allowed) return null;
  return { error: "VISIT_CAP" as const, message: VISIT_CAP_MESSAGE, used: status.used, allowance: status.allowance };
}

export async function stampVisit(response: { headers: { set: (name: string, value: string) => void } }, tenantId: string, sessionId: string, limit: number, photoId: string) {
  const status = await visitStatus(tenantId, sessionId, limit);
  response.headers.set("x-photo-id", photoId);
  response.headers.set("x-visit-used", String(status.used));
  response.headers.set("x-visit-limit", String(status.allowance));
  return response;
}

/** The owner adds another batch of tries, the size of the salon's visit limit. */
export async function unlockVisit(tenantId: string, sessionId: string, extra: number) {
  const add = Math.max(1, extra);
  return prisma.visitGrant.upsert({
    where: { tenantId_sessionId: { tenantId, sessionId } },
    create: { tenantId, sessionId, bonus: add },
    update: { bonus: { increment: add } },
  });
}

export async function visitsToday(tenantId: string) {
  const start = kolkataDayStart();
  const rows = await prisma.tryOn.findMany({
    where: { tenantId, createdAt: { gte: start }, kind: { in: [...VISIT_TRY_KINDS] }, status: "SUCCEEDED" },
    select: { sessionId: true },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const ids = [...new Set(rows.map((row) => row.sessionId))];
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { visitTryLimit: true } });
  const limit = tenant?.visitTryLimit ?? 3;
  const listed = [];
  for (const sessionId of ids.slice(0, 12)) {
    const status = await visitStatus(tenantId, sessionId, limit);
    listed.push({ sessionId, code: sessionId.slice(-8), ...status });
  }
  return listed;
}

export async function resolveSession(tenantId: string, code: string) {
  const trimmed = code.trim();
  if (trimmed.length < 6) return null;
  if (trimmed.length >= 8 && !trimmed.includes(" ")) {
    const exact = await prisma.tryOn.findFirst({
      where: { tenantId, sessionId: trimmed },
      select: { sessionId: true },
    });
    if (exact) return exact.sessionId;
  }
  const rows = await prisma.tryOn.findMany({
    where: { tenantId, kind: { in: [...VISIT_TRY_KINDS] } },
    select: { sessionId: true },
    distinct: ["sessionId"],
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return rows.find((row) => row.sessionId.endsWith(trimmed))?.sessionId ?? null;
}
