-- One provider payment id can grant a try-on pack only once.
CREATE TABLE IF NOT EXISTS "public"."CreditPackGrant" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT '',
    "invoiceNumber" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditPackGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreditPackGrant_externalId_key" ON "public"."CreditPackGrant"("externalId");
CREATE INDEX IF NOT EXISTS "CreditPackGrant_tenantId_idx" ON "public"."CreditPackGrant"("tenantId");
