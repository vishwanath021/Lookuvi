import { AI_PREVIEW_KINDS } from "@/lib/preview-access";
import { prisma } from "@/lib/prisma";
import { kolkataMonthStart } from "@/lib/ai/spend";
import { kolkataDayStart } from "@/lib/queue/day";
import { guestLimitMessage } from "@/lib/tools";

export const DEFAULT_MONTHLY_TRY_ALLOWANCE = 30;

export const MONTHLY_TRY_MESSAGE = "This salon has used this month's included try-ons. Ask the salon to raise the allowance.";

/** Statuses that occupy a monthly/daily try slot (in-flight reserve or finished success). */
export const TRY_CAP_STATUSES = ["SUCCEEDED", "RESERVED"] as const;

let queue: Promise<unknown> = Promise.resolve();

function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function monthlySucceededTries(tenantId: string, now = new Date()) {
  return prisma.tryOn.count({
    where: {
      tenantId,
      status: { in: [...TRY_CAP_STATUSES] },
      kind: { in: [...AI_PREVIEW_KINDS] },
      createdAt: { gte: kolkataMonthStart(now) },
    },
  });
}

/** Soft read for tests and dashboards. Prefer reserveTryCaps at request time. */
export async function refuseMonthlyTries(tenantId: string, allowance: number, now = new Date()) {
  const cap = Math.max(0, allowance);
  const used = await monthlySucceededTries(tenantId, now);
  if (used >= cap) return { error: "MONTHLY_CAP" as const, message: MONTHLY_TRY_MESSAGE, used, allowance: cap };
  return null;
}

export type TryCapReserveInput = {
  tenantId: string;
  monthlyAllowance: number;
  dailyCap: number;
  sessionId: string;
  kind: string;
  tier?: string;
  actorKey?: string;
  styleId?: string | null;
  now?: Date;
};

export type TryCapRefuse = {
  ok: false;
  error: "MONTHLY_CAP" | "DAILY_CAP";
  message: string;
  used: number;
  allowance: number;
};

/**
 * Atomically claim one salon try against the monthly and daily hard caps.
 * Creates a RESERVED TryOn row that counts until commit (SUCCEEDED) or release.
 * Mirrors beginPaidCall / reserveCredits: serialize with an in-process queue and a
 * Postgres advisory lock when on Postgres.
 */
export async function reserveTryCaps(input: TryCapReserveInput): Promise<{ ok: true; id: string } | TryCapRefuse> {
  const now = input.now ?? new Date();
  const monthlyCap = Math.max(0, input.monthlyAllowance);
  const dailyCap = Math.max(0, input.dailyCap);
  const monthStart = kolkataMonthStart(now);
  const dayStart = kolkataDayStart(now);

  return exclusive(() =>
    prisma.$transaction(async (tx) => {
      if ((process.env.DATABASE_URL || "").startsWith("postgres")) {
        await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(872164)");
      }
      const base = {
        tenantId: input.tenantId,
        kind: { in: [...AI_PREVIEW_KINDS] },
        status: { in: [...TRY_CAP_STATUSES] },
      };
      const usedToday = await tx.tryOn.count({ where: { ...base, createdAt: { gte: dayStart } } });
      if (usedToday >= dailyCap) {
        return {
          ok: false as const,
          error: "DAILY_CAP" as const,
          message: guestLimitMessage("daily"),
          used: usedToday,
          allowance: dailyCap,
        };
      }
      const usedMonth = await tx.tryOn.count({ where: { ...base, createdAt: { gte: monthStart } } });
      if (usedMonth >= monthlyCap) {
        return {
          ok: false as const,
          error: "MONTHLY_CAP" as const,
          message: MONTHLY_TRY_MESSAGE,
          used: usedMonth,
          allowance: monthlyCap,
        };
      }
      const row = await tx.tryOn.create({
        data: {
          tenantId: input.tenantId,
          sessionId: input.sessionId,
          styleId: input.styleId || null,
          kind: input.kind,
          tier: input.tier || "anon",
          actorKey: input.actorKey || "",
          quality: "standard",
          status: "RESERVED",
          credits: 0,
        },
      });
      return { ok: true as const, id: row.id };
    }),
  );
}

/** Turn a RESERVED row into SUCCEEDED or FAILED. No-op if already settled. */
export async function settleTryReservation(
  id: string,
  data: {
    status: "SUCCEEDED" | "FAILED";
    styleId?: string | null;
    shadeId?: string | null;
    kind?: string;
    tier?: string;
    actorKey?: string;
    quality?: string;
    provider?: string | null;
    latencyMs?: number | null;
    credits?: number;
  },
) {
  if (!id) return null;
  await prisma.tryOn.updateMany({
    where: { id, status: "RESERVED" },
    data: {
      status: data.status,
      ...(data.styleId !== undefined ? { styleId: data.styleId } : {}),
      ...(data.shadeId !== undefined ? { shadeId: data.shadeId } : {}),
      ...(data.kind !== undefined ? { kind: data.kind } : {}),
      ...(data.tier !== undefined ? { tier: data.tier } : {}),
      ...(data.actorKey !== undefined ? { actorKey: data.actorKey } : {}),
      ...(data.quality !== undefined ? { quality: data.quality } : {}),
      ...(data.provider !== undefined ? { provider: data.provider } : {}),
      ...(data.latencyMs !== undefined ? { latencyMs: data.latencyMs } : {}),
      ...(data.credits !== undefined ? { credits: data.credits } : {}),
    },
  });
  return prisma.tryOn.findUnique({ where: { id } });
}

/** Drop an unused RESERVED slot so it no longer counts toward the cap. */
export async function releaseTryReservation(id: string) {
  if (!id) return;
  await prisma.tryOn.deleteMany({ where: { id, status: "RESERVED" } });
}

/** Clear abandoned RESERVED rows (process crash / client abort). */
export async function refundStaleTryReservations(tenantId: string, olderThanMs = 5 * 60 * 1000) {
  const cutoff = new Date(Date.now() - olderThanMs);
  await prisma.tryOn.deleteMany({
    where: { tenantId, status: "RESERVED", createdAt: { lt: cutoff } },
  });
}
