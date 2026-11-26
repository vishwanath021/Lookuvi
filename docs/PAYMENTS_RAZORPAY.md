# Razorpay payments (test mode → go-live)

Salon owners pay Lookuvi via **one-time Razorpay orders** per billing period. Guest booking deposits are optional per salon. **Razorpay Subscriptions are not used yet** — see `SUBSCRIPTION_EXTENSION_NOTE` in `src/lib/payments/config.ts`.

## Architecture

| Piece | Location |
| --- | --- |
| Checkout (server sets amount) | `POST /api/v1/admin/plan-billing/checkout` |
| Booking deposit checkout | `POST /api/v1/guest/bookings/deposit-checkout` |
| Status poll | `GET /api/v1/admin/plan-billing/status?paymentId=` |
| Callback verify | `POST /api/v1/admin/plan-billing/verify` |
| Webhook (source of truth) | `POST /api/webhooks/razorpay` |
| Grant `paidUntil` | `src/lib/payments/grants.ts` |
| Idempotent events | `RazorpayWebhookEvent` |
| Order expiry (30 min) | `expireStalePayments()` in retention cron + `POST /api/v1/admin/payments/maintenance` (super) |
| Super plans CRUD | `POST/GET /api/v1/super/salon-plans` |
| Super payment list | `GET /api/v1/super/razorpay-payments` |

Prices are stored in paise on `SalonBillingPlan` and copied to `Payment`. The browser never sends an amount.

## Environment

In `.env` (see `.env.example` — values blank in repo):

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- Optional: `BILLING_PRICE_INCL_GST_TEXT` (default label: `incl. GST`)

If keys are missing, checkout routes return **503** and Pay buttons are hidden.

Legacy try-on plan UPI / mock billing (`BILLING_PROVIDER`, `PaymentRequest`) is unchanged.

## Webhook

1. Dashboard URL: `https://<APP_BASE_URL>/api/webhooks/razorpay`
2. Enable events: `payment.authorized`, `payment.captured`, `payment.failed`, `refund.processed`, `order.paid`
3. Body: raw JSON; verify `X-Razorpay-Signature` with `RAZORPAY_WEBHOOK_SECRET` (HMAC-SHA256, `timingSafeEqual`).
4. Processed event ids are stored so retries return 200 without double-granting.

Checkout callback also verifies `order_id|payment_id` signature; webhook still decides `paid`.

## Test mode steps

1. Use Razorpay **test** keys in `.env`.
2. `npm run db:push && npm run seed` — seeds plan **Lookuvi Salon** at ₹799 (79900 paise).
3. Sign in as demo owner → **Plan & Billing** → **Pay now** (test card/UPI in Razorpay test checkout).
4. Confirm status page polls to `paid` and `paidUntil` moves forward.
5. Run vitest `tests/unit/payments-razorpay.test.ts` (mocks network).

## Go-live checklist

- [ ] Company KYC complete on Razorpay
- [ ] Live `RAZORPAY_*` keys on VPS env (never commit)
- [ ] `RAZORPAY_WEBHOOK_SECRET` set; webhook URL points at production
- [ ] Webhook events enabled (see above)
- [ ] Test ₹1 live payment + full refund test
- [ ] GST invoice settings in Razorpay; GSTIN on salon billing if issuing tax invoices
- [ ] Privacy and refund policy pages updated (`/privacy`, `/refund`)
- [ ] Database backups verified before first live charge

## Compliance copy

Owner **Plan & Billing** shows price with incl. GST label, GSTIN when set, and links to refund/cancellation policy.