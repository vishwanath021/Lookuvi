-- Photo makeup studio. Off until the owner turns the switch on.
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "productMakeupStudio" BOOLEAN NOT NULL DEFAULT false;
