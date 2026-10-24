import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

/**
 * One row, incremented inside the caller's transaction.
 * Two payments at the same moment cannot take the same number.
 */
export async function allocateReceiptNumber(tx: Tx, now = new Date()) {
  const rows = await tx.$queryRawUnsafe<Array<{ next: number | bigint }>>(
    `INSERT INTO "ReceiptSeq" ("id", "next") VALUES (1, 1) ON CONFLICT ("id") DO UPDATE SET "next" = "ReceiptSeq"."next" + 1 RETURNING "next"`,
  );
  const n = Number(rows[0]?.next);
  if (!Number.isFinite(n) || n < 1) throw new Error("RECEIPT_SEQ");
  return `ABW-${now.getFullYear()}-${String(n).padStart(4, "0")}`;
}

export async function nextReceiptNumber(now = new Date()) {
  return prisma.$transaction((tx) => allocateReceiptNumber(tx, now));
}
