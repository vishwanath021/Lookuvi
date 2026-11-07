-- Loyalty points per phone, per salon. Existing visits are not back-filled.
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "loyaltyOn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "loyaltyPointsPerVisit" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "public"."LoyaltyReward" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "LoyaltyReward_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoyaltyReward_tenantId_sort_idx" ON "public"."LoyaltyReward"("tenantId", "sort");

CREATE TABLE IF NOT EXISTS "public"."LoyaltyLedger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "staffId" TEXT NOT NULL DEFAULT '',
    "visitId" TEXT NOT NULL DEFAULT '',
    "rewardId" TEXT NOT NULL DEFAULT '',
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoyaltyLedger_tenantId_phone_idx" ON "public"."LoyaltyLedger"("tenantId", "phone");
CREATE INDEX IF NOT EXISTS "LoyaltyLedger_tenantId_visitId_idx" ON "public"."LoyaltyLedger"("tenantId", "visitId");

DO $$ BEGIN
  ALTER TABLE "public"."LoyaltyReward" ADD CONSTRAINT "LoyaltyReward_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."LoyaltyLedger" ADD CONSTRAINT "LoyaltyLedger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
