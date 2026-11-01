-- Optional per-salon REQUEST hours (Asia/Kolkata). Empty keeps 06:00–22:00.
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "openTime" TEXT NOT NULL DEFAULT '';
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "closeTime" TEXT NOT NULL DEFAULT '';
