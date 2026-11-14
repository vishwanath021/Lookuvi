-- The demo salon locks AI try-ons until staff mark the guest Arrived.
-- Only slug 'demo'. Every other salon keeps the value it already has.
UPDATE "public"."Tenant" SET "tryOnsAtSalon" = true WHERE "slug" = 'demo';
