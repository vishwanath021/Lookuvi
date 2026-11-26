import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** LKV-2026-000123 — sequential per company for Payment receipts. */
export async function allocatePaymentReceiptNumber(tx: Tx, now = new Date()) {
  const rows = await tx.$queryRawUnsafe<Array<{ next: number | bigint }>>(
    `INSERT INTO "PaymentReceiptSeq" ("id", "next") VALUES (1, 1) ON CONFLICT ("id") DO UPDATE SET "next" = "PaymentReceiptSeq"."next" + 1 RETURNING "next"`,
  );
  const n = Number(rows[0]?.next);
  if (!Number.isFinite(n) || n < 1) throw new Error("PAYMENT_RECEIPT_SEQ");
  return `LKV-${now.getFullYear()}-${String(n).padStart(6, "0")}`;
}