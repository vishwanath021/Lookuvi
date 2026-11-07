-- Queue WhatsApp that costs money stays off until the salon turns it on.
-- Guests who join from home still get the joined message. Booking confirmed is unchanged.
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "whatsappAlmostOn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "whatsappWalkInJoined" BOOLEAN NOT NULL DEFAULT false;
