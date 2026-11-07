-- Weekly sessions in Asia/Kolkata. An empty week keeps the old open/close pair, or 06:00–22:00.
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "weeklyHours" TEXT NOT NULL DEFAULT '';
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "hoursOverride" TEXT NOT NULL DEFAULT '';
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "hoursOverrideUntil" TIMESTAMP(3);
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "closedDayKey" TEXT NOT NULL DEFAULT '';

-- A saved open/close pair becomes one session on every day. An empty pair is left empty.
UPDATE "public"."Tenant"
SET "weeklyHours" =
  '{"mon":[{"open":"' || "openTime" || '","close":"' || "closeTime" || '"}],' ||
  '"tue":[{"open":"' || "openTime" || '","close":"' || "closeTime" || '"}],' ||
  '"wed":[{"open":"' || "openTime" || '","close":"' || "closeTime" || '"}],' ||
  '"thu":[{"open":"' || "openTime" || '","close":"' || "closeTime" || '"}],' ||
  '"fri":[{"open":"' || "openTime" || '","close":"' || "closeTime" || '"}],' ||
  '"sat":[{"open":"' || "openTime" || '","close":"' || "closeTime" || '"}],' ||
  '"sun":[{"open":"' || "openTime" || '","close":"' || "closeTime" || '"}]}'
WHERE "weeklyHours" = ''
  AND "openTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND "closeTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND "openTime" < "closeTime";
