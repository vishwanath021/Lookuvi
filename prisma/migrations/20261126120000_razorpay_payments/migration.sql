-- Salon plan billing and Razorpay order payments (additive)
ALTER TABLE "Tenant" ADD COLUMN "paidUntil" DATETIME;
ALTER TABLE "Tenant" ADD COLUMN "salonBillingPlanId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "bookingDepositPaise" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Booking" ADD COLUMN "depositStatus" TEXT NOT NULL DEFAULT '';

CREATE TABLE "SalonBillingPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "pricePaise" INTEGER NOT NULL,
    "intervalMonths" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "orderId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL DEFAULT '',
    "salonPlanId" TEXT,
    "bookingId" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "paidAt" DATETIME,
    "failedAt" DATETIME,
    "refundedAt" DATETIME,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT NOT NULL DEFAULT '',
    "razorpayPaymentId" TEXT NOT NULL DEFAULT '',
    "razorpayInvoiceId" TEXT NOT NULL DEFAULT '',
    "refundId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_salonPlanId_fkey" FOREIGN KEY ("salonPlanId") REFERENCES "SalonBillingPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");
CREATE INDEX "Payment_tenantId_createdAt_idx" ON "Payment"("tenantId", "createdAt");
CREATE INDEX "Payment_tenantId_status_idx" ON "Payment"("tenantId", "status");
CREATE INDEX "Payment_status_expiresAt_idx" ON "Payment"("status", "expiresAt");
CREATE INDEX "Payment_salonPlanId_idx" ON "Payment"("salonPlanId");
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

CREATE TABLE "RazorpayWebhookEvent" (
    "eventId" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PaymentReceiptSeq" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "next" INTEGER NOT NULL DEFAULT 1
);