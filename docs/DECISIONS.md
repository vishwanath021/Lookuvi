# Decisions

Each change is reviewed twice before it is implemented: once as a senior architect, once as the product owner. The questions below are the ones each side actually raised. The decision is the answer we shipped.

Date of this review: 24 October 2026. Scope: the seven-salon launch on top of return visits (PR #28, already merged to master with green CI).

## D1. New salons start with the queue on

**Architect.** If the queue is on, the public join page is live, the line defaults to open, and there is one chair. A slug that leaks before the founder sets the hours will accept real tokens. Reminders also default to on, so a later visit can text people once WhatsApp is connected. Existing salons must not be flipped; many were saved with the old default of off on purpose. The migration should change the default only.

**Product owner.** The seven clients are being sold a token queue plus try-on. Creating a salon and then forgetting the queue switch is how the first shop goes live without join-from-home. The owner has to see Customers and the join link on day one. Turning the queue off must stay a deliberate super-admin action for a try-on-only shop.

**Decision.** New salons get `productQueue = true`. Rows that already exist keep their current value. The demo seed sets the queue on. The line stays open with one chair, which is the existing queue default, so join-from-home works as soon as the link is shared.

**Rationale.** The cost of a forgotten switch is a salon that cannot run the pilot. The cost of an early public link is a few tokens on a one-chair line, and the founder can pause the line on the desk before printing the QR. We do not backfill old salons.

**Not done.** We did not default the line to paused. That would hide the bug the owner asked us to remove.

## D2. Changing a plan must not double-grant credits

**Architect.** The old code added the whole plan allowance on every plan save and also overwrote `dailyCap` with that same number. Clicking Pro twice minted 1800 tries twice. Lite, then Pro, then Lite, then Pro minted them again. A daily cap the salon had customised was wiped. Granting nothing is safe, but a high-water mark is safer than a human remembering to type the difference. Goodwill credits must not change the mark, and a downgrade must not take tries away. A paid renewal is a new period: it may add one full pack, once per payment id, and it must raise the same mark so a later free plan click does not add that pack again.

**Product owner.** If we move a Starter trial (900 tries already granted) to Pro and add nothing, the owner still has 900 tries and will think Pro is broken when the counter stops. The plan on the screen has to mean the tries included in that plan. Moving down must not confiscate tries they already paid for or already used. The founder should not have to open Adjust credits for a normal upgrade.

**Decision.** Each salon stores `includedCreditMark`, the highest plan inclusion already granted. A super-admin plan change grants only `max(0, new plan credits − mark)` and then raises the mark to the new plan. It never goes down, so a downgrade and a repeat upgrade grant 0. `dailyCap` moves to the new plan's included credits only when it still equals the previous plan's included credits. A custom daily cap stays. Salon creation still grants the plan once and sets the mark to that amount. Existing rows are backfilled from their current plan so the next click does not grant the whole plan again. A paid activation still grants one full period, once per payment id, and raises the mark.

**Rationale.** The salon receives the gap between the plan they had and the plan they have now, exactly once. A mis-click, a downgrade, or a second upgrade does not mint a second pack. The daily preview cap stops tracking a plan the owner has already overridden.

**Not done.** We did not set the balance to the new plan's credits. Tries already used would reappear. We did not claw back on a downgrade.

## D3. STOP is per salon, with one shared-number escape

**Architect.** Lookuvi sends from one WhatsApp business number. Meta's opt-out is for that number, not for our tenant table. A plain STOP has no salon id in the webhook. Guessing wrong opts the wrong shop out, or, if we fan out, every shop. The words STOPALL and UNSUBSCRIBE are the explicit "stop this sender" path and should remain global. If we cannot tell the salon, and the phone is saved at more than one salon, we must not guess. Queue "your turn" alerts are a different message from the later reminder. The join form promises one reminder after the visit, so STOP is about that reminder.

**Product owner.** A guest who replies STOP to Salon A must still be reachable by Salon B. Otherwise one reply kills reminders for every shop on the platform, which is the bug we were told to fix. The owner of A must not be able to turn a real STOP back on. A desk stop stays reversible. The guest should not keep getting offers after STOP. Missing their turn today because we swallowed the queue alert is worse than one operational text.

**Decision.** Plain STOP opts out only the salon we can attribute: the latest sent reminder or offer, otherwise the latest queue entry with that phone, otherwise the only salon that has the number. If the phone is on several salons and we have no message to point at, nothing is changed. STOPALL and UNSUBSCRIBE write one shared-number row (empty salon id) and opt the phone out everywhere. Old global rows stay global so an opt-out already stored is not dropped. STOP still does not block a live queue alert for a visit they have already joined. The owner cannot undo STOP. A desk stop stays on that salon and can be turned back on when no STOP row covers it.

**Rationale.** This matches the owner's instruction. The shared-number words are the Meta-safe path off the one sender. We accept a residual risk: a plain STOP does not silence a different salon's later reminder on the same WhatsApp number, and attribution can follow the later message rather than the one the guest thought they were answering. WhatsApp does not tell us which outbound message they meant unless we start storing provider message ids. That is not in this launch.

**Not done.** We did not make every STOP global. We did not block queue alerts.

## D4. Daily and monthly caps share midnight in Asia/Kolkata

**Architect.** Monthly try-ons, the WhatsApp cap, and the AI spend cap already reset at 00:00 Asia/Kolkata. The salon daily cap and the per-person daily cap used the server's local midnight. On a UTC host that is 05:30 in India, so a guest can be "out of tries" for five and a half hours of the next Indian morning, or can get a second daily allowance before the shop opens. Rolling rate limits (per hour, per minute) are abuse controls, not a calendar day, and should stay as they are.

**Product owner.** The owner thinks the day ends when the shop's day ends, which is midnight in India. The number on Customers ("included try-ons this month") and the daily preview cap have to roll over together or the founder will not be able to explain a refusal.

**Decision.** Salon daily cap, anonymous daily cap, signed-in daily cap, and the desk's "tries today" list all count from `kolkataDayStart` (00:00 Asia/Kolkata, 18:30 the previous UTC day). Monthly counters stay on the Kolkata month they already use.

**Rationale.** One clock for every calendar limit the owner can see. No change to connection rate limits.

## D5. The style-cap error names the real plan

**Architect.** Only Lite has a style ceiling (25). The API text said "Starter includes 25 styles" for whichever plan hit the ceiling. That sends the founder to the wrong upgrade conversation.

**Product owner.** The person reading the error is in the shop, not in the code. The plan name has to be the plan they are on.

**Decision.** The message uses the salon's plan name: "Lite includes 25 styles. Upgrade to enable more."

## D6. Product guide

**Architect.** A guide written from memory will document flags that are off and screens that redirect. It has to be traced from the routes, and it has to say when a control on one screen changes another. Screenshots of the seeded demo are evidence. A PDF that cannot be regenerated from the markdown will drift.

**Product owner.** The reader is a co-founder onboarding seven salons, not an engineer. Each screen needs what it does, the steps, every option and limit, and the business catch. Features that are not in the launch (guest hub, bookings, custom domain, outlets, salon AI key, embed, guide, billing self-serve, OTP) must be named so nobody promises them, and then left alone. Return visits are only on the merged PR #28 line and must be marked so a reader of an older build is not surprised.

**Decision.** One English guide at `docs/product-guide/`, markdown plus a PDF rendered from it. It covers every P0 and P1 screen, the cross-screen effects, and a short "off for launch" list. PR #28 behaviour is marked. Screenshots come from the local seeded demo with mock AI. No secrets, no live server.

## D7. Test plan and how a case counts as run

**Architect.** About 340 cases cannot all be clicked by hand in one pass without lying. A case that was not executed must say so. Unit tests already cover caps, STOP, credits, and queue maths. The browser is for the paths a founder will show a salon. A k6 script that is never installed should ship as a file and be marked blocked, not as a pass.

**Product owner.** The co-founder has to be able to run the sheet without reading the code. Given / When / Then, priority, expected result, grouped by the functionality ids already agreed. The onboarding checklist is the thing they follow for each of the seven shops. Pass/fail has to be a column they can see, including UNTESTED and why.

**Decision.** `docs/test-plan/` holds the markdown, a PDF, a CSV, and an XLSX. Cases use Given / When / Then and the C/S/O/A/P/X ids for P0 and P1 only. Execution writes a results sheet. Automated checks and browser runs may mark PASS. Anything not run is UNTESTED with the reason. The k6 script is committed. It is run only if k6 is installed. Mock AI only. `OPENAI_API_KEY` is removed from the test process even if the environment has one.

## D8. Videos

**Architect.** One video per test case will not be watched and will record setup noise. A video of a failing run should not be kept.

**Product owner.** They need to see each area work: the guest, the desk, the owner, the super admin, and a change on one screen showing up on another. Short enough to send to a co-founder.

**Decision.** Six videos, about one to three minutes each: customer, staff, owner, super admin, platform, and cross-screen. Recorded after the path succeeds. Saved as artifacts and linked from the guide.

## D9. Merge and deploy

**Architect.** PR #28's CI was green (verify and docker) and GitHub already shows it merged to master. The fixes branch must rebase onto that master, go green on its own CI, and only then merge. A red check or a drift failure stops the merge.

**Product owner.** Do not touch the live demo. Do not spend on AI. Use the seeded demo logins only.

**Decision.** No deploy. No paid provider call. Fixes merge only after local tests, the schema-drift check, and GitHub CI are green.

## D10. Lite does not download the lead file

**Architect.** `plans.ts` sets `leadExport: false` on Lite and true on Starter and Pro. The leads API and the Download CSV button never read that flag, so a Lite salon can export every lead. The on-screen list is a different thing: the desk still has to work today's bookings. The gate belongs on the API, with the button hidden so the founder does not click a link that 403s.

**Product owner.** Export is part of why a shop moves from Lite to Starter. If the file downloads on Lite, that conversation is false. Staff and the owner of a Starter or Pro salon both need the file. Hiding the rows as well would stop the desk working.

**Decision.** `GET /api/v1/admin/leads/export` returns 403 when the salon's plan does not include lead export. The button is hidden in that case. The on-screen list stays for every plan.

**Rationale.** The price list already said this. The code did not. A Lite shop can still read and update leads in the browser.

## D11. A credit adjustment below zero is a refusal, not a crash

**Architect.** `grantCredits` throws `CreditError` inside a transaction, so the balance rolls back. The salon route did not catch it, and the founder received a 500. The ledger must stay unchanged. The response should be a 400 with a sentence the founder can read.

**Product owner.** Adjust credits is how goodwill and corrections are made. Typing a number that is larger than the balance should say the balance cannot go below zero. It must not look like the platform broke, and it must not leave a half-applied change.

**Decision.** The salon update route catches `CreditError` and returns 400 with "The balance can't go below zero." The balance and the ledger stay as they were.

## D12. The test sheet is the cases that were run

**Architect.** The approval note's case counts were estimates, about 340. Inventing near-duplicate clicks to hit that number would produce a sheet that looks complete and proves nothing. A case the runner did not execute has to stay UNTESTED. Browser video covers the screens an HTTP call cannot click, and it is not a second pass of every row.

**Product owner.** Every agreed functionality id still has to appear, with Given / When / Then and a result a co-founder can read. Missing k6, a production authenticator, a live WhatsApp handset, or a payment must be visible as not run, not as a pass.

**Decision.** `docs/test-plan/` is the case list that was executed on the local mock server. The first pass was 193 pass, 0 fail, 4 untested. The four are production TOTP, the k6 script (k6 is not installed), Razorpay (billing is off for launch), and the nails face check (the portrait was not accepted as a nails look, so the hand check did not run). Six short videos cover the customer, staff, owner, super admin, platform, and cross-screen paths after those paths succeeded. D13 adds the named P0 behaviours that pass skipped.

## D13. Fill skipped P0 behaviours, do not pad the estimate

**Architect.** The inventory column sums to 483. The approval note rounded P0+P1 to about 340. Both numbers were sizing, not a case catalogue. A second pass that repeats a join ten times to match a column will not find a new bug. A named behaviour with no case is a real skip: start and done, a walk-in with no phone, localhost QR, a zero daily cap, the same bridal look served from cache, a credit reserve at a zero balance.

**Product owner.** If a control we promised the seven salons was never tried, add that case and run it. If the shortfall is the same click counted three ways, or a gesture that only exists in the browser, say so in the sheet. Do not call the estimate a failure of the run.

**Decision.** The runner gained the P0 cases that named a behaviour the first pass did not execute. They are run on the same mock server. The second execution is 221 pass, 0 fail, 4 untested, 225 cases. The test plan lists every P0 and P1 id whose executed count is still below the inventory column, and why. We do not add filler rows to reach 340 or 483. Production TOTP, k6, Razorpay, and the nails face check stay UNTESTED for the same reasons as D12.
