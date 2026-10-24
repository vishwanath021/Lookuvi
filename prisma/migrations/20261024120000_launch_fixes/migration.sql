-- New salons start with the queue on. Existing rows keep the value they already have.
ALTER TABLE "public"."Tenant" ALTER COLUMN "productQueue" SET DEFAULT true;

-- STOP is per salon. An empty tenantId is the shared-number opt-out (STOPALL / UNSUBSCRIBE).
-- Rows already stored were global, so they stay global instead of being dropped.
ALTER TABLE "public"."WhatsAppOptOut" RENAME TO "WhatsAppOptOut_old";
ALTER TABLE "public"."WhatsAppOptOut_old" RENAME CONSTRAINT "WhatsAppOptOut_pkey" TO "WhatsAppOptOut_old_pkey";

CREATE TABLE "public"."WhatsAppOptOut" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppOptOut_pkey" PRIMARY KEY ("id")
);

INSERT INTO "public"."WhatsAppOptOut" ("id", "phone", "tenantId", "createdAt")
SELECT "phone", "phone", '', "createdAt" FROM "public"."WhatsAppOptOut_old";

DROP TABLE "public"."WhatsAppOptOut_old";

CREATE UNIQUE INDEX "WhatsAppOptOut_phone_tenantId_key" ON "public"."WhatsAppOptOut"("phone", "tenantId");
CREATE INDEX "WhatsAppOptOut_phone_idx" ON "public"."WhatsAppOptOut"("phone");
