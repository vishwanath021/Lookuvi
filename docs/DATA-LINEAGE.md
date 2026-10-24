# Data lineage

These are the fields a founder asked to be able to trace: try-ons left, salon status, trial end, try-ons this month, plan, payment, and receipt. Line numbers are the file as merged to `master` from the launch-decisions branch. Each GitHub link is `https://github.com/vishwanath021/Lookuvi/blob/master/<path>#L<line>`.

Auth roles below: **super** is a founder session, **owner** is the salon owner, **staff** is a salon member who is not the owner, **guest** is signed out.

## Try-ons left

**Stored as** `Tenant.creditBalance` (`Int`, default 0). [schema](https://github.com/vishwanath021/Lookuvi/blob/master/prisma/schema.prisma#L52)

The ledger is `CreditLedger` (`delta`, `reason`, `refId`, `balanceAfter`). Reasons that write a balance: `TRIAL_GRANT`, `PLAN_GRANT`, `PACK`, `ADJUST`, `RESERVE`, `COMMIT`, `REFUND`.

**Writes**

- New salon: 20 try-ons, reason `TRIAL_GRANT`. [tenants POST](https://github.com/vishwanath021/Lookuvi/blob/master/src/app/api/v1/super/tenants/route.ts#L64)
- Mark paid / `activatePlan`: adds the plan allowance once per payment reference, reason `PLAN_GRANT`. [apply.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/billing/apply.ts#L59)
- A pack: `addCreditPack`, reason `PACK`. [apply.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/billing/apply.ts#L85)
- Adjust try-ons: super-admin salon POST `creditDelta`, reason `ADJUST`.
- A try-on reserves 1 inside `reserveCredits` and commits or refunds. [credits.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/credits.ts#L9)
- Changing the plan does not write the balance. [plan-assign.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/billing/plan-assign.ts#L27)

**Reads**

- Owner sidebar polls `GET /api/v1/admin/balance` about every 4 seconds. [balance route](https://github.com/vishwanath021/Lookuvi/blob/master/src/app/api/v1/admin/balance/route.ts#L4) and `AdminNav`.
- Super-admin table column "Try-ons left" is `SalonRecord.credits` from `loadSalons`, polled from `GET /api/v1/super/tenants`. [directory.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/super/directory.ts#L33)
- Billing page shows the same number.

**API**

`GET /api/v1/admin/balance` — owner or staff.

```json
{ "credits": 20, "status": "TRIAL" }
```

`POST /api/v1/super/tenants/:id` with `{ "creditDelta": 10, "note": "goodwill" }` — super. Response includes the updated salon. A delta that would pass below 0 returns 400 "The balance can't go below zero."

**Screen**

Owner and staff: sidebar "N try-ons left". Super admin: Salons column "Try-ons left", and the Plan & credits sheet.

**Tests**

- Given a trial salon with 20 try-ons, when Choose opens a UPI payment, then the balance stays 20. `tests/unit/launch-decisions.test.ts`
- Given that payment is marked paid with a new UPI reference, then the balance is 20 plus the plan allowance and the status is ACTIVE.
- Given the same UPI reference is sent again, then the balance does not increase.
- Given a plan change from Basic to Pro, then `creditsGranted` is 0 and the balance is unchanged. `tests/unit/launch-fixes.test.ts`
- Given status EXPIRED and 5 try-ons left, when a try-on is reserved, then it is refused and the balance stays 5.

## Salon status

**Stored as** `Tenant.status` (`String`, default `TRIAL`). Values in use: `TRIAL`, `ACTIVE`, `SUSPENDED`, `EXPIRED`. [schema](https://github.com/vishwanath021/Lookuvi/blob/master/prisma/schema.prisma#L30)

**Writes**

- Create: `TRIAL`. [tenants POST](https://github.com/vishwanath021/Lookuvi/blob/master/src/app/api/v1/super/tenants/route.ts#L62)
- `expireTrials`: `TRIAL` whose `trialEndsAt` is in the past becomes `EXPIRED`. Called from retention. [trial.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/trial.ts#L4) [retention.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/retention.ts#L35)
- Suspend sets `SUSPENDED`. Resume of `SUSPENDED` sets `ACTIVE`. Resume is not offered for `EXPIRED`.
- `activatePlan` sets `ACTIVE` and clears `trialEndsAt`. [apply.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/billing/apply.ts#L28)

**Reads**

- Guest pages: `isBlockedStatus` (`SUSPENDED` or `EXPIRED`) renders the paused screen. Expired says "Trial ended".
- `reserveCredits` refuses both. [credits.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/credits.ts#L12)
- Queue join refuses both.
- Owner layout shows a banner. The owner can still sign in.

**API**

`POST /api/v1/super/tenants/:id` with `{ "status": "SUSPENDED" }` — super. `EXPIRED` is an allowed value on that route and is also set by the job.

**Screen**

Salons table Status badge. Filters include Expired, trial ending in 7 days, and low try-ons (10 or fewer).

**Tests**

- Given a trial that ended, an open trial, and an active salon with an old end date, when `expireTrials` runs, then only the ended trial becomes EXPIRED.
- Given that expired salon, when a try-on is reserved, then `CreditError` is thrown.

## Trial end

**Stored as** `Tenant.trialEndsAt` (`DateTime?`). [schema](https://github.com/vishwanath021/Lookuvi/blob/master/prisma/schema.prisma#L49)

**Writes**

- Create: now plus 14 days (`TRIAL_DAYS`). [tenants POST](https://github.com/vishwanath021/Lookuvi/blob/master/src/app/api/v1/super/tenants/route.ts#L63)
- Mark paid / `activatePlan`: set to null. [apply.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/billing/apply.ts#L32)

**Reads**

- Salons column "Trial ends", formatted in India time.
- Filter "Trial ending in 7 days": status is `TRIAL`, end is within 7 days, and the end is not already past.

**Screen**

Salons table and the salon sheet.

**Tests**

Covered with the expire-trials case above. A future end date stays `TRIAL`.

## Try-ons this month

**Not a column.** Count of `TryOn` rows with `status = SUCCEEDED` and `createdAt` on or after the Asia/Kolkata month start.

**Reads**

- `loadSalons` → `previewsThisMonth`. [directory.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/super/directory.ts#L48)
- Super overview tile "Try-ons this month" sums that field.
- Owner queue subtitle uses the same month start.

**Screen**

Salons column "Try-ons this month". Overview tile. Queue page subtitle.

**Tests**

The directory query is the same succeeded-only filter the overview already used. A failed or sample try-on is not counted. There is no separate new unit assertion for the label rename.

## Plan

**Stored as** `Tenant.plan` (`String`). Ids: `LITE` (Basic), `STARTER` (Standard), `PRO` (Pro). Display names and prices live in `src/data/plans.ts`. `CHAIN` still reads as Pro.

**Writes**

- Create: the chosen plan, or Basic when omitted. [tenants POST](https://github.com/vishwanath021/Lookuvi/blob/master/src/app/api/v1/super/tenants/route.ts#L42)
- `applyPlanChange`: sets the plan and moves `dailyCap` only when the cap still equals the previous plan's allowance. Does not add try-ons. [plan-assign.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/billing/plan-assign.ts#L27)
- `activatePlan`: sets the plan, `ACTIVE`, and the daily cap, then grants try-ons. [apply.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/billing/apply.ts#L24)

**API**

`POST /api/v1/super/tenants/:id` with `{ "plan": "PRO" }` — super.

```json
{ "plan": "PRO", "creditsGranted": 0 }
```

`POST /api/v1/admin/billing` with `{ "action": "subscribe", "plan": "LITE", "interval": "monthly" }` — owner. When Razorpay is not the live provider, the response is a pending UPI payment and the plan does not change:

```json
{ "pending": true, "amountInr": 799, "upiId": "lookuvi@upi", "upiPlaceholder": true }
```

**Screen**

Billing shows Basic, Standard, Pro and the packs. Salons table shows the display name. Change plan says it does not add try-ons.

**Tests**

- Plan prices and names. `tests/unit/product.test.ts`
- Plan change grants 0. `tests/unit/launch-fixes.test.ts`
- Pending UPI does not change the balance. `tests/unit/launch-decisions.test.ts`

## Payment and receipt

**Stored as**

- `PaymentRequest`: `kind` (`PLAN` or `PACK`), `plan`, `packId`, `interval`, `amountInr`, `status` (`PENDING`, `PAYING`, `PAID`), `upiRef`, `invoiceId`. [schema](https://github.com/vishwanath021/Lookuvi/blob/master/prisma/schema.prisma#L363)
- `UpiReference.ref` is unique. One reference pays one request.
- `Invoice`: `number`, `amountExGst`, `gstInr`, `totalInr`, `status` (`PAID`), `upiRef`, `documentKind` (`RECEIPT` or `TAX_INVOICE`). [schema](https://github.com/vishwanath021/Lookuvi/blob/master/prisma/schema.prisma#L331)
- `ReceiptSeq` allocates `ABW-YEAR-0001`. [receipt-number.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/billing/receipt-number.ts#L10)

**Writes**

- Owner Choose: `openUpiPayment` inserts or reuses a `PENDING` row and does not grant. [upi-flow.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/billing/upi-flow.ts#L19)
- Mark paid: claims `PENDING` → `PAYING`, grants, writes the invoice, then `PAID`. [upi-flow.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/billing/upi-flow.ts#L62)
- GST is 0 unless `GST_ENABLED` is on. The PDF is a receipt, not a tax invoice. [receipt-pdf.ts](https://github.com/vishwanath021/Lookuvi/blob/master/src/lib/billing/receipt-pdf.ts#L6)

**API**

`GET /api/v1/super/payments?tenantId=` — super. Lists pending payments.

`POST /api/v1/super/payments` — super.

```json
{ "tenantId": "…", "upiRef": "UPIREF123456", "plan": "LITE", "interval": "monthly" }
```

Response includes `invoiceNumber` such as `ABW-2026-0001`. A reference that is not 6–32 letters or digits returns 400 `UPI_REF`. A reference already used returns 400 `UPI_USED`.

`GET /api/v1/receipts/:id` — super, or the owner of that salon. Body is `application/pdf`.

**Screen**

Owner billing: Payment pending, UPI id, QR, and a receipt download after it is paid. Super admin: Mark paid on the salon row.

**Tests**

- Given a pending Basic payment, when it is marked paid, then the invoice kind is `RECEIPT`, GST is 0, and the PDF starts with `%PDF-`.
- Given four receipt numbers are taken together, then all four differ.
- Given the same payment reference is activated twice, then try-ons are granted once.
