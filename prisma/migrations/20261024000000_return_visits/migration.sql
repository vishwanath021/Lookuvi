-- Return visits: per-salon customer fields, WhatsApp outreach, and the monthly try-on count.

ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "remindersOn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "reminderDays" INTEGER NOT NULL DEFAULT 35;
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "whatsappMonthlyCap" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "monthlyTryAllowance" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "public"."Customer" ADD COLUMN IF NOT EXISTS "visitCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."Customer" ADD COLUMN IF NOT EXISTS "lastVisitAt" TIMESTAMP(3);
ALTER TABLE "public"."Customer" ADD COLUMN IF NOT EXISTS "needsReminder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."Customer" ADD COLUMN IF NOT EXISTS "reminderLockUntil" TIMESTAMP(3);
ALTER TABLE "public"."Customer" ADD COLUMN IF NOT EXISTS "lastRemindedVisitAt" TIMESTAMP(3);
ALTER TABLE "public"."Customer" ADD COLUMN IF NOT EXISTS "optedOutAt" TIMESTAMP(3);
ALTER TABLE "public"."Customer" ADD COLUMN IF NOT EXISTS "optOutSource" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "Customer_tenantId_needsReminder_lastVisitAt_idx" ON "public"."Customer"("tenantId", "needsReminder", "lastVisitAt");

CREATE TABLE IF NOT EXISTS "public"."WhatsAppOptOut" (
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppOptOut_pkey" PRIMARY KEY ("phone")
);

CREATE TABLE IF NOT EXISTS "public"."WhatsAppSend" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "broadcastId" TEXT NOT NULL DEFAULT '',
    "linkToken" TEXT,
    "monthKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppSend_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppSend_linkToken_key" ON "public"."WhatsAppSend"("linkToken");
CREATE INDEX IF NOT EXISTS "WhatsAppSend_tenantId_monthKey_status_idx" ON "public"."WhatsAppSend"("tenantId", "monthKey", "status");
CREATE INDEX IF NOT EXISTS "WhatsAppSend_tenantId_kind_createdAt_idx" ON "public"."WhatsAppSend"("tenantId", "kind", "createdAt");

CREATE TABLE IF NOT EXISTS "public"."CustomerReturn" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sendId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerReturn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerReturn_sendId_key" ON "public"."CustomerReturn"("sendId");
CREATE INDEX IF NOT EXISTS "CustomerReturn_tenantId_createdAt_idx" ON "public"."CustomerReturn"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomerReturn_customerId_idx" ON "public"."CustomerReturn"("customerId");

CREATE TABLE IF NOT EXISTS "public"."SalonBroadcast" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "held" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalonBroadcast_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SalonBroadcast_tenantId_createdAt_idx" ON "public"."SalonBroadcast"("tenantId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "public"."WhatsAppSend" ADD CONSTRAINT "WhatsAppSend_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."CustomerReturn" ADD CONSTRAINT "CustomerReturn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."CustomerReturn" ADD CONSTRAINT "CustomerReturn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."CustomerReturn" ADD CONSTRAINT "CustomerReturn_sendId_fkey" FOREIGN KEY ("sendId") REFERENCES "public"."WhatsAppSend"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."SalonBroadcast" ADD CONSTRAINT "SalonBroadcast_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
