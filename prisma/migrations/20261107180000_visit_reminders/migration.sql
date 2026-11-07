-- Owner come-back reminders sent from the salon's own WhatsApp.
ALTER TABLE "public"."Tenant" ALTER COLUMN "reminderDays" SET DEFAULT 42;

ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "reminderTemplate" TEXT NOT NULL DEFAULT '';
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "reminderMethod" TEXT NOT NULL DEFAULT 'MANUAL';

CREATE TABLE IF NOT EXISTS "public"."VisitReminder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "visitAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'MANUAL',
    "userId" TEXT NOT NULL DEFAULT '',
    "undoneAt" TIMESTAMP(3),
    CONSTRAINT "VisitReminder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VisitReminder_tenantId_phone_sentAt_idx" ON "public"."VisitReminder"("tenantId", "phone", "sentAt");

DO $$ BEGIN
  ALTER TABLE "public"."VisitReminder" ADD CONSTRAINT "VisitReminder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
