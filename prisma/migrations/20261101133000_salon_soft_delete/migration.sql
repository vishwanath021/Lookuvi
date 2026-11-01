-- Soft delete. The row stays. Suspend remains Tenant.status and is unchanged.
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
