# Database changes

SQLite stays the committed Prisma provider so `npm test` can `db push`. Production Postgres is updated by `prisma/migrations/20261024000000_return_visits`. New columns have defaults so existing rows stay valid. No backfill of old queue rows: visits count from the first Done after this ships, or from a date the owner imports.

## Tenant

| Column | Type | Default | Why |
|---|---|---|---|
| `remindersOn` | boolean | true | Owner switch. True is safe on deploy because no existing row has `lastVisitAt`. |
| `reminderDays` | int | 35 | 28 to 42 in the API. |
| `whatsappMonthlyCap` | int | 50 | Reminder plus offer sends that WhatsApp accepted this Asia/Kolkata month. |
| `monthlyTryAllowance` | int | 30 | Hard count of succeeded previews this Asia/Kolkata month. |

## Customer

The table already exists, unique on `(tenantId, phone)`.

| Column | Type | Default | Why |
|---|---|---|---|
| `visitCount` | int | 0 | Completed visits. |
| `lastVisitAt` | timestamp, null | null | Set on Done or a valid import date. Reminders read this. |
| `needsReminder` | boolean | false | Set true on a new visit. Cleared only after a reminder is accepted. |
| `reminderLockUntil` | timestamp, null | null | Short claim so two sweeps do not send twice. Expired claims can be taken again. |
| `lastRemindedVisitAt` | timestamp, null | null | The visit the last successful reminder was for. |
| `optedOutAt` | timestamp, null | null | Set means no reminder and no offer. |
| `optOutSource` | text | `""` | `STOP` or `DESK`. Empty when they can be reminded. |

Index `(tenantId, needsReminder, lastVisitAt)` for the due query.

Deleting a guest account still deletes the `Customer` row, which is the existing OTP behaviour. A STOP row for that salon, or a shared-number row, opts the phone out again the next time it is saved.

## WhatsAppOptOut

One row per phone and salon. `phone` is `91XXXXXXXXXX`. `tenantId` empty means STOPALL or UNSUBSCRIBE on the shared Lookuvi number, which blocks every salon. A plain STOP sets `tenantId` to the salon whose message was answered. Rows that existed before this change are kept as shared-number rows so an old opt-out is not dropped.

## WhatsAppSend

One row per reminder or offer attempt. Live queue alerts are not rows here.

| Column | Notes |
|---|---|
| `tenantId` | Cascade when the salon is deleted. |
| `customerId` | The customer id at send time. Not a foreign key, so the send history remains if the guest deletes their login. |
| `phone` | Normalised phone that was sent. |
| `kind` | `reminder` or `offer`. |
| `status` | `PENDING`, `SENT`, `FAILED`. Pending older than 10 minutes is failed inside the next reservation. |
| `provider` | `whatsapp` when accepted. |
| `error` | Short code such as `HTTP_400`, `TEMPLATE`, `STALE`. |
| `broadcastId` | Set for offers. Empty for reminders. |
| `linkToken` | Unique, nullable. Random token in the join link. Null is not used for these rows. |
| `monthKey` | `YYYY-MM` in Asia/Kolkata. The cap counts `SENT` and fresh `PENDING` for this key. |

Indexes: `(tenantId, monthKey, status)`, `(tenantId, kind, createdAt)`, unique `linkToken`.

## CustomerReturn

One row when a join attributes a reminder. `sendId` is unique and references `WhatsAppSend` with `ON DELETE CASCADE`, so removing a salon can delete the send and the return together. `tenantId` and `customerId` cascade as well. A second join with the same token cannot insert another row. If the guest has already deleted their login, the return insert fails closed and the join itself still succeeds.

## SalonBroadcast

`tenantId`, the offer text, `sent`, `held` (not sent because the cap was reached), and `createdAt`.

## What is deliberately not a column

- No push subscription, no VAPID key, no device endpoint.
- No per-phone try-on counter. Daily try-on caps stay on `anonDailyCap`, `memberDailyCap`, and the existing `TryOn.actorKey`.
- The outreach cap is not a balance column. It is a count of `WhatsAppSend` for the month, in the same transaction as the insert, so a restart cannot drift a counter.
