-- Trial default, receipts, and UPI payment requests.
-- Existing salons keep their current bridal flag. Only new rows default to off.

ALTER TABLE "public"."Tenant" ALTER COLUMN "productBridal" SET DEFAULT false;

ALTER TABLE "public"."Invoice" ADD COLUMN IF NOT EXISTS "upiRef" TEXT NOT NULL DEFAULT '';
ALTER TABLE "public"."Invoice" ADD COLUMN IF NOT EXISTS "documentKind" TEXT NOT NULL DEFAULT 'RECEIPT';

CREATE TABLE IF NOT EXISTS "public"."ReceiptSeq" (
    "id" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ReceiptSeq_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."UpiReference" (
    "ref" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UpiReference_pkey" PRIMARY KEY ("ref")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UpiReference_paymentId_key" ON "public"."UpiReference"("paymentId");

CREATE TABLE IF NOT EXISTS "public"."PaymentRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT '',
    "packId" TEXT NOT NULL DEFAULT '',
    "interval" TEXT NOT NULL DEFAULT 'monthly',
    "amountInr" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "upiRef" TEXT NOT NULL DEFAULT '',
    "invoiceId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentRequest_tenantId_status_idx" ON "public"."PaymentRequest"("tenantId", "status");

DO $$ BEGIN
  ALTER TABLE "public"."PaymentRequest" ADD CONSTRAINT "PaymentRequest_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
