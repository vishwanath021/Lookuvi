-- Additive. Existing rows default off, then any salon that already has a staff login is turned on.
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "teamLogins" BOOLEAN NOT NULL DEFAULT false;

UPDATE "public"."Tenant" AS tenant
SET "teamLogins" = true
WHERE EXISTS (
  SELECT 1 FROM "public"."Membership" AS member
  WHERE member."tenantId" = tenant.id AND member.role = 'STAFF'
);
