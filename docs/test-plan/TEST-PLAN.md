# Lookuvi launch test plan

Executed on 24 October 2026 on the production build of master `4e0b8e514a85b211e84d385d759ff204c3b91428`.
The server is `next start` against Postgres. The browser is Chrome on https://127.0.0.1:3000.
AI is mock. WhatsApp is not a live handset. No provider key and no real UPI payment were used.

Result: **66 pass**, **0 fail**, **5 untested**, 71 cases.

Each pass has a screen video in `/opt/cursor/artifacts/videos`, named by the case id.
Cross-screen cases are two Chrome windows recorded together.
A case that was not run on a real screen is UNTESTED with a reason.

## How a case was run

- `screen` is one Chrome window on the real app.
- `screen-side-by-side` is the customer phone window and the desk window at the same time.
- `k6` is `scripts/k6/guest-browse.js` against the same server. 5 users, 30 seconds. 435 checks passed. p95 was 43ms.
- `device`, `money`, and `founder` were not run. They need a handset, a real payment, or a GSTIN.

## Nine salons

Demo Salon (Basic, trial, live queue, 5 customers), Rose Standard (Standard, active, bridal, 2), Lotus Pro (Pro, active, bridal and groom, 8), Quiet Chairs (Basic, trial, request mode, 3, 8 try-ons left), Ending Soon (Standard, trial ending inside 7 days, then marked paid), Paused House (Pro, suspended, 1), Ended Lane (Basic, expired, 4), Groom Studio (Standard, groom on, Hindi, 7), Home Join (Pro, live queue, 2).

## Results

### C1-01 Demo salon home (PASS)

Given Demo Salon is on a 14-day trial. When A guest opens /s/demo. Then The salon name and Use photo are on the phone screen.

### C1-02 Unknown salon (PASS)

Given No salon uses that link. When A guest opens /s/missing-salon. Then The screen is a not-found page.

### C1-03 Public queue (PASS)

Given Demo Salon queue is open. When A guest opens /s/demo/queue. Then Join the queue is on the screen, with the STOP sentence.

### C1-04 Welcome page (PASS)

Given Demo Salon exists. When A guest opens /s/demo/welcome. Then The welcome screen names the salon.

### C2-01 Suspended salon (PASS)

Given Paused House is suspended. When A guest opens /s/paused. Then The screen says the salon is paused.

### C2-02 Expired trial (PASS)

Given Ended Lane is expired. When A guest opens /s/ended. Then The screen says the trial ended.

### C9-01 Hindi salon screen (PASS)

Given Groom Studio default language is Hindi. When A guest opens /s/groom. Then The photo button is in Hindi and the Groom tab is visible.

### C6-01 Bridal tab (PASS)

Given Rose Standard has bridal on. When A guest opens the bridal section. Then Bridal looks are on the screen.

### C4-01 Photo notice (PASS)

Given A guest has not agreed yet. When They tap Use photo. Then The age and photo notice appears before the file picker.

### C3-01 Mock hairstyle preview (PASS)

Given No AI key is saved and mock AI is on. When A guest uploads a portrait and picks Soft Bob. Then A sample result image appears on the try-on screen.

### C12-01 Appointment request (PASS)

Given Quiet Chairs is in request mode. When A guest asks for a time. Then The ticket says the salon must confirm.

### O-LOGIN Owner sign-in (PASS)

Given The Demo Salon owner account exists. When They sign in on a phone. Then The queue desk opens and shows try-ons left.

### S-LOGIN Staff sign-in (PASS)

Given The Demo Salon staff account exists. When They sign in on a phone. Then The desk opens with the staff role.

### A-LOGIN Super sign-in with authenticator (PASS)

Given The super admin authenticator is on. When They sign in and enter the 6-digit code. Then The platform home opens.

### O1-01 No Styles link (PASS)

Given The owner is signed in. When They open the menu. Then Prices is there and Styles is not.

### O3-01 Prices without bridal (PASS)

Given Demo Salon bridal is off. When The owner opens Prices. Then Haircut is listed and Classic bridal is not.

### O3-02 Bridal prices (PASS)

Given Rose Standard bridal is on. When The owner opens Prices. Then Classic, Signature, and Royal are compact rows.

### O3-03 Add a price (PASS)

Given The owner can edit prices. When They add Blowdry at 699. Then The new row is on the Prices screen.

### O5-01 Customer counters (PASS)

Given Rose has a reminder, an offer, and a return. When The owner opens Customers. Then The four counters and the WhatsApp banner are visible.

### O5-02 Add customer (PASS)

Given The owner is on Customers. When They add a phone and name. Then The new customer is in the list.

### O8-01 Visit list hidden (PASS)

Given Demo bridal and groom are off. When The owner opens the desk. Then Recent visits is not on the screen.

### O8-02 Visit list when bridal is on (PASS)

Given Rose bridal is on. When The owner opens the desk. Then Recent visits is above the visit code.

### O9-01 QR without a public domain (PASS)

Given The site is still on a local address. When The owner opens QR. Then A friendly note is shown instead of a code.

### O10-01 Choose a plan stays pending (PASS)

Given Billing is mock and UPI is not confirmed. When The owner chooses Basic. Then Payment pending shows a UPI QR and does not say the plan is active.

### O10-02 Annual price (PASS)

Given The owner is on Billing. When They tick Annual. Then Basic shows ten times the monthly price.

### O10-03 Try-on pack stays pending (PASS)

Given The owner has not paid. When They tap the 25 try-on pack. Then Payment pending shows the pack amount.

### O-SET Settings on a phone (PASS)

Given The owner is signed in. When They open Settings. Then Salon name, Bridal, and Save are on one phone screen.

### O-TEAM Team section (PASS)

Given The owner is signed in. When They open the team block. Then The staff member is listed.

### O-SEC Owner security (PASS)

Given The owner has no authenticator. When They open Security. Then Authenticator is off and setup is offered.

### O-ONB Onboarding wizard (PASS)

Given The salon already finished setup. When The owner opens Onboarding. Then The wizard is on the screen.

### O-LEAD-LITE Basic cannot export leads (PASS)

Given Demo Salon is Basic. When The owner opens Leads. Then The screen says export is for Standard and Pro.

### O-LEAD-STD Standard can export leads (PASS)

Given Rose Standard is the Standard plan. When The owner opens Leads. Then Download CSV is on the screen.

### S-SET Staff cannot change settings (PASS)

Given A staff member is signed in. When They open Settings. Then The screen says staff cannot change settings or prices.

### S-PRICE Staff cannot change prices (PASS)

Given A staff member is signed in. When They open Prices. Then The price field is locked and the owner-only note is shown.

### S-BILL Staff cannot change the plan (PASS)

Given A staff member is signed in. When They open Billing. Then The screen says only the owner can change the plan.

### S-WALK Staff walk-in (PASS)

Given The Demo desk is open. When Staff adds a walk-in named Ravi. Then Token for Ravi is on the desk.

### S-CONFIRM Confirm a requested time (PASS)

Given Kavya requested a time at Quiet Chairs. When Staff taps Confirm time. Then The request leaves the open list.

### A-NINE Nine salons (PASS)

Given Nine salons are seeded. When Super admin opens Salons. Then All nine names, Link, and Try-ons left are on the table, with the no-key warning.

### A-TRIAL Trial ending filter (PASS)

Given Ending Soon ends inside 7 days. When Super admin filters Trial ending in 7 days. Then Ending Soon is listed and Demo Salon is not.

### A-LOW Low try-ons filter (PASS)

Given Quiet Chairs has 8 try-ons left. When Super admin filters Low try-ons left. Then Quiet Chairs is listed.

### A-EXP Expired status filter (PASS)

Given Ended Lane is expired. When Super admin filters Expired. Then Ended Lane is the expired row.

### A-AI AI key rows (PASS)

Given No provider key is saved. When Super admin opens AI. Then OpenAI and fal rows, Test, and the price list are on the screen.

### A-SPEND Spend tiles (PASS)

Given No paid images have run. When Super admin opens Spend. Then Month spend, images, and average are the three tiles.

### A-LOG Image log (PASS)

Given The image log is behind a link. When Super admin opens the log. Then The image costs heading is on the screen.

### A-STYLE Platform style tags (PASS)

Given Styles are platform data. When Super admin opens Styles. Then Density and texture controls are on the screen.

### A-HOME Platform snapshot (PASS)

Given Nine salons exist. When Super admin opens the home. Then Try-ons this month and Try-ons left tiles are visible.

### A-SEC Authenticator required (PASS)

Given This is a production process. When Super admin opens Security. Then The screen says an authenticator is required and is on.

### A-PLAN Change plan does not add try-ons (PASS)

Given Groom Studio has 40 try-ons left. When Super admin sets the plan to Pro. Then The toast says try-ons are added only when payment is marked paid.

### A-PAID Mark paid (PASS)

Given Ending Soon is still on trial. When Super admin marks a UPI reference paid. Then The salon becomes active and a receipt can be downloaded.

### O-RECEIPT Receipt download (PASS)

Given Ending Soon was marked paid. When The owner opens Billing. Then A receipt row has a Download link.

### A-NEW New salon trial (PASS)

Given Super admin can create a salon. When They create Launch House. Then The row appears with 20 try-ons left.

### C-STOP STOP shows on the customer card (PASS)

Given Rose has one customer on that phone. When A signed STOP webhook arrives. Then The owner screen says Replied STOP.

### O-BAD Wrong password (PASS)

Given The login form is open. When The password is wrong. Then The screen says the details did not match.

### P-TERMS Terms without GST (PASS)

Given GST is off. When A guest opens Terms. Then The screen says GST is not charged yet.

### O-PAUSE-BANNER Paused salon banner (PASS)

Given Paused House is suspended. When The owner signs in. Then A banner says guests cannot try on.

### O-EXPIRED-BANNER Trial ended banner (PASS)

Given Ended Lane is expired. When The owner opens the desk. Then A banner says the trial ended.

### X-TOKEN Token 1 on both screens (PASS)

Given Home Join has an empty live queue. When A guest joins while the desk is open. Then Both screens show token 1 at the same time.

### X-NEXT Next calls the guest (PASS)

Given A guest is waiting at Home Join. When The desk taps NEXT. Then The guest screen says Your turn.

### X-START Start service (PASS)

Given Asha has been called. When The desk taps Start. Then The guest screen says they are being served.

### X-DONE Done (PASS)

Given Asha is in service. When The desk taps Done. Then The guest screen says the visit is finished.

### X-SKIP No-show skip (PASS)

Given A second guest is waiting. When The desk marks them a no-show. Then The guest screen says the token was a no-show.

### X-PAUSE Pause blocks a join (PASS)

Given The Home Join desk is open. When The owner pauses and a guest tries to join. Then The guest sees the queue is paused and cannot join.

### X-ISO Salon isolation (PASS)

Given Ravi is a Demo Salon walk-in. When Lotus Pro desk is open beside it. Then Ravi is on Demo and not on Lotus.

### X-SAMPLE Sample try-on leaves the counter (PASS)

Given Lotus has 220 try-ons and no AI key. When A guest gets a sample while the owner desk is open. Then The result is on the guest screen and the owner still has 220 try-ons left.

### X-CREDIT Adjust try-ons on both screens (PASS)

Given Lotus still has 220 try-ons left. When Super admin subtracts 1. Then The owner sidebar and the salons table both show 219.

### U-PHONE Scan a printed QR with a phone camera (UNTESTED)

Given A public domain is set. When Someone scans the printed code. Then The phone opens the welcome page.

This host is local, so the QR page refuses to print a code. A handset scan needs the real domain.

### U-UPI Pay from a UPI app (UNTESTED)

Given A real UPI ID is configured. When The owner pays. Then Money arrives and a person marks it paid.

No money was sent. The screen stops at Payment pending. The placeholder UPI ID is lookuvi@upi.

### U-WA WhatsApp arrives on a handset (UNTESTED)

Given Meta WhatsApp is connected. When A reminder is due. Then The customer receives it.

No Meta key is configured. The customers screen shows reminders paused. Outbound WhatsApp was not called.

### U-AI A paid provider image (UNTESTED)

Given A real AI key is saved. When A guest tries a style. Then The image is from that provider and one try-on is spent.

No provider key was saved, so the screen shows a sample and the balance does not move. Spending a try-on was shown with Adjust try-ons instead.

### U-GST Tax invoice (UNTESTED)

Given GSTIN exists and GST is on. When A payment is marked paid. Then The PDF is a tax invoice.

GST is off. The downloaded file is a receipt, not a tax invoice.

### P-K6 Guest browse under k6 (PASS)

Given The production server is up with mock AI. When Five virtual users browse health, welcome, and the public queue for 30 seconds. Then Failed requests stay under 5 percent and p95 stays under 1.5 seconds.

435 checks passed, 0 failed requests, p95 43ms, against http://127.0.0.1:3001
