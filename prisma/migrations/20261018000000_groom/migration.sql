-- Groom looks. Off until the owner turns the switch on.
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "productGroom" BOOLEAN NOT NULL DEFAULT false;
