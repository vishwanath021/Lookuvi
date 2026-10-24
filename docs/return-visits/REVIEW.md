# Architect review

Reviewed against the running queue, `notifyGuest`, the `Customer` unique key, and the rupee spend lock. Findings below were applied to the other four docs before implementation.

## Checklist

The checks are observable and they match the revised scope: list, links, one reminder, cap, STOP, attribution, dashboard. Two gaps were real.

The 60-day return rate undercounts a salon that picks 42 days. The reminder goes out on day 42, and only 18 days remain inside the window. The rate is now 90 days.

The checklist did not say what the guest agrees to. Queue consent today is "queue updates", which reads as today's token. Item 19 now requires an English line on the join form about one later reminder and STOP.

Phone-keyed try-on limits are not a checklist miss. The preview request has no phone. Item 17 keeps the existing signed-in and anonymous daily caps and adds the monthly count.

## Owner screen

The screen is one page a non-technical owner can use: figures, three controls, a list, plain result sentences. Staff do not get a greyed-out offer button. They do not see the form.

The desk `wa.me` button was easy to confuse with the capped Cloud API send. The screen copy and the architecture now say the staff chat is outside the monthly limit.

"Turn reminders on" after STOP would look like a working button and then fail. The screen shows the words "Replied STOP" and no button.

## Architecture

Reusing `Customer (tenantId, phone)` is the right isolation boundary. A second list would split the OTP guest from the queue guest. The upset path must not wipe birthday, people, or saved looks. That is specified.

The cap must not include live token alerts. Those are the product the guest just asked for. Counting them would silence the queue on a busy Saturday while leaving the marketing budget notionally "full". The reservation counts only reminder and offer rows.

Claim order matters. Clearing `needsReminder` before WhatsApp accepts the send loses the customer if the process dies. Locking with `reminderLockUntil`, then reserving a `PENDING` row, then clearing the flag only on success, is the sequence to build. Stale `PENDING` rows have to expire or a crash burns the cap forever.

`CANCEL` as an opt-out word is wrong. Guests already cancel a token. Only STOP, STOPALL, and UNSUBSCRIBE.

A plain STOP is per salon, attributed to the last message we sent that phone. STOPALL and UNSUBSCRIBE opt out of the shared Lookuvi number for every salon. That is the path off the sender when Meta’s one-number rule applies. The owner cannot override a STOP.

The unsigned webhook was rejected. Without `WHATSAPP_APP_SECRET` the route refuses the body. Desk opt-out still works when the webhook is not configured.

Broadcast pagination that stops at 2000 and then starts again at the top would send the same regulars twice and never reach the rest. The walk continues until the cap or the end of the list, and one broadcast id cannot send twice to the same customer.

Advisory lock `872164` stays off the rupee lock `872163`.

## Database

Defaults make the migration safe for salons that already have customers. `needsReminder` false and `lastVisitAt` null means the first cron after deploy sends nothing. That is the reason reminders can default to on.

`WhatsAppSend.customerId` stays a string so send history survives guest-account deletion. `CustomerReturn.customerId` is a real foreign key. Attribution then fails closed if the login is already gone. The join still succeeds. The foreign key from the return to the send is `ON DELETE CASCADE` so a salon delete does not deadlock on the send row.

No counter column for the cap. A counter drifts when a send crashes. The count of rows inside the reservation transaction is the cap.

No push tables.

## Try-on cost

The monthly allowance fits the existing `TryOn` count and the Kolkata month already used by spend. It is a hard count, including staff, and it does not replace `beginPaidCall`. A phone-level daily cap does not fit this change. Building it would invent an identity the preview route does not have.

## Left as specified

Template variable counts change. Production WhatsApp keeps failing those templates until the new templates are approved. Local and unconfigured servers keep the log provider and still save the customer. That is the existing queue failure mode, not a new one.
