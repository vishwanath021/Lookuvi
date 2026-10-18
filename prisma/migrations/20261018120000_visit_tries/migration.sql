-- Bridal and groom tries per visit. The owner can raise the cap and unlock a guest.
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "visitTryLimit" INTEGER NOT NULL DEFAULT 3;

CREATE TABLE IF NOT EXISTS "public"."VisitGrant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VisitGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VisitGrant_tenantId_sessionId_key" ON "public"."VisitGrant"("tenantId", "sessionId");

DO $$ BEGIN
  ALTER TABLE "public"."VisitGrant" ADD CONSTRAINT "VisitGrant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
