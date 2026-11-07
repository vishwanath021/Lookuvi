-- Free try-ons wait until the guest is at the salon. Existing salons stay on.
-- The sales demo stays off so a remote tour can still preview.
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "tryOnsAtSalon" BOOLEAN NOT NULL DEFAULT true;
UPDATE "public"."Tenant" SET "tryOnsAtSalon" = false WHERE "slug" = 'demo';

-- One free try-on per visit. Salons still on the old default of 3 move to 1.
-- Any other number the owner already chose is left as it is.
ALTER TABLE "public"."Tenant" ALTER COLUMN "visitTryLimit" SET DEFAULT 1;
UPDATE "public"."Tenant" SET "visitTryLimit" = 1 WHERE "visitTryLimit" = 3;

ALTER TABLE "public"."QueueEntry" ADD COLUMN IF NOT EXISTS "sessionId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "public"."QueueEntry" ADD COLUMN IF NOT EXISTS "deviceId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "public"."QueueEntry" ADD COLUMN IF NOT EXISTS "arrivedAt" TIMESTAMP(3);
ALTER TABLE "public"."QueueEntry" ADD COLUMN IF NOT EXISTS "wantsTriesAt" TIMESTAMP(3);
ALTER TABLE "public"."QueueEntry" ADD COLUMN IF NOT EXISTS "lastGrant" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."QueueEntry" ADD COLUMN IF NOT EXISTS "lastGrantAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "QueueEntry_tenantId_dayKey_deviceId_idx" ON "public"."QueueEntry"("tenantId", "dayKey", "deviceId");

CREATE TABLE IF NOT EXISTS "public"."QueueSession" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    CONSTRAINT "QueueSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "QueueSession_entryId_sessionId_key" ON "public"."QueueSession"("entryId", "sessionId");
CREATE INDEX IF NOT EXISTS "QueueSession_sessionId_idx" ON "public"."QueueSession"("sessionId");

CREATE TABLE IF NOT EXISTS "public"."SalonDayUnlock" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalonDayUnlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SalonDayUnlock_tenantId_dayKey_kind_value_key" ON "public"."SalonDayUnlock"("tenantId", "dayKey", "kind", "value");
CREATE INDEX IF NOT EXISTS "SalonDayUnlock_tenantId_dayKey_idx" ON "public"."SalonDayUnlock"("tenantId", "dayKey");

DO $$ BEGIN
  ALTER TABLE "public"."QueueSession" ADD CONSTRAINT "QueueSession_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."QueueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."SalonDayUnlock" ADD CONSTRAINT "SalonDayUnlock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
