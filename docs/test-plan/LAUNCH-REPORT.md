# Lookuvi launch report

Tested build: `4e0b8e514a85b211e84d385d759ff204c3b91428` (merge of pull request #32 into master, 24 October 2026).

The app under test was `next start` from that commit, on Postgres database `lookuvi`, behind a local HTTPS proxy at `https://127.0.0.1:3000`. Chrome opened the real screens. AI image generation was the mock provider. WhatsApp send was not a live handset. No provider key and no UPI money were used.

Nothing was deployed.

## Pull request

- https://github.com/vishwanath021/Lookuvi/pull/32 — merged.
- Merge commit: `4e0b8e514a85b211e84d385d759ff204c3b91428`.
- CI on the pull request: verify passed, Docker build passed. The push workflow skipped Docker, which is how that workflow is written.

## Result

66 pass, 0 fail, 5 untested, 71 cases.

65 of the passes are screen videos in `/opt/cursor/artifacts/videos`, one file per flow, named by case id. Nine of those are side-by-side recordings of two Chrome windows (customer phone and owner or staff desk). `P-K6` is the k6 run, not a video: 5 virtual users for 30 seconds, 435 checks passed, 0 failed requests, p95 43ms, against the same server.

## Decisions shipped on that commit

- D14. A finished trial becomes `EXPIRED`, distinct from `SUSPENDED`. Guests are blocked. The owner can still sign in. Resume is only for a founder suspension. Mark paid sets `ACTIVE`.
- D15. One try-on is one credit. The HD double charge is gone. The hair-type picker is unchanged.
- D16. Display names are Basic ₹799 / 50, Standard ₹1,499 / 120, Pro ₹2,499 / 220. Stored ids stay `LITE`, `STARTER`, `PRO`. Annual is 10× monthly. Trial is 14 days and 20 try-ons. Choosing a plan or changing a plan does not grant try-ons. Mark paid grants the plan allowance once per UPI reference, on top of the remaining balance.
- D17. GST is off. Choose opens a UPI QR and stays at Payment pending. The receipt is not a tax invoice. Numbers are race-safe. Razorpay stays behind its keys.
- D18. Styles left the owner menu. Density and texture are platform data. Prices is one compact page. Bridal is off for a new salon, and packages are created only when bridal is turned on.
- D19. Customers is four counters plus one banner while WhatsApp is disconnected, and an add-customer form. QR is one download, with a plain sentence when no public domain is set. Visit codes hide when bridal and groom are both off.
- D20. Two AI key rows, one In use model, a spend bar with a per-salon cap, and a spend board of three tiles plus a per-salon table. The image log is a link. The hardcoded ₹0.60 fallback is gone from the board.
- D21. No production deploy, no SMS or email payment confirmation, no magic-link screen. Production super-admin sign-in still requires the authenticator.

## What the screens showed

Nine seeded salons, each with its own owner and staff: Demo Salon (Basic, trial, live queue, 5 customers), Rose Standard (Standard, active, bridal, 2), Lotus Pro (Pro, active, bridal and groom, 8), Quiet Chairs (Basic, trial, request mode, 3, low try-ons), Ending Soon (Standard, then marked paid), Paused House (Pro, suspended, 1), Ended Lane (Basic, expired, 4), Groom Studio (Standard, groom on, Hindi, 7), Home Join (Pro, live queue, 2).

- Guest try-on on Demo Salon produced a sample image. Lotus Pro stayed at 220 try-ons, which is the no-key rule.
- Adjust try-ons moved Lotus from 220 to 219 on the owner phone and on the salons table together.
- Home Join: the guest ticket and the desk both showed token 1, then Your turn, You are being served, and This visit is finished. Pause, no-show, and a second salon that does not list the first salon's walk-in were recorded side by side.
- Ending Soon: Mark paid with UPI reference `LAUNCHREF01` set the salon active, raised try-ons from 15 to 135, and the owner downloaded the receipt PDF.
- Change plan on Groom Studio set Pro and left the try-on balance at 40.
- Rose Guest 1 replied STOP through the signed webhook. The owner list shows Replied STOP.
- Staff on Demo Salon could not save settings, prices, or billing. The owner could.
- Super-admin filters for trial ending within 7 days and low try-ons, the expired filter, AI rows, spend tiles, styles, and authenticator sign-in all opened on the real pages.
- A new salon, Launch Row, was created from the super-admin form on the Basic trial with 20 try-ons.

## Bugs

The Docker CI failure (Google font fetch during `next build`) was fixed on the pull request with self-hosted fonts before the merge. The browser pass did not find a product defect that needed another code change. Failures during the first recording passes were in the test runner: the phone menu is hidden until Menu is tapped, the ticket says "Your turn", and the local webhook is plain HTTP on the app port. Those flows were re-run and recorded only after they passed.

## Untested, with reasons

| Id | Needs | What the screen already shows |
| --- | --- | --- |
| U-PHONE | A handset and a public domain | The QR page refuses to print a localhost code |
| U-UPI | Real money from a UPI app | Payment pending, placeholder `lookuvi@upi` |
| U-WA | A Meta key and a handset | Reminders paused. STOP was recorded without a live send |
| U-AI | A paid provider key | A sample image that does not spend a try-on |
| U-GST | A GSTIN and a founder decision to turn GST on | The downloaded file is a receipt |

## Artifacts

- `/opt/cursor/artifacts/videos/` — 65 videos
- `/opt/cursor/artifacts/VIDEO-INDEX.md` — id to file
- `/opt/cursor/artifacts/PRODUCT-GUIDE.pdf`
- `/opt/cursor/artifacts/TEST-PLAN.pdf`
- `/opt/cursor/artifacts/cases.csv` and `cases.xlsx`
- `/opt/cursor/artifacts/receipt.pdf` — Ending Soon receipt
- `/opt/cursor/artifacts/screenshots/` — stills from the same passes
