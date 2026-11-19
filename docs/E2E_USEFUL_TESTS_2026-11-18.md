# E2E useful tests (2026-11-19)

Playwright E2E now covers **app behaviour only** (queue, auth, locks, desk, settings, leads). Mock-AI try-on specs used for image quality, pixels, CV, or marketing screenshots were removed; one try-on smoke path remains in `guest-regression.spec.ts` (save + download).

**Counts (`npx playwright test --list`):** before **200 tests / 27 files** → after **180 tests / 23 files**.

## Remaining spec files

| Spec | Behaviour covered |
|---|---|
| `brow-cards.spec.ts` | Brow picker diagrams; chips do not call generate |
| `camera.spec.ts` | Fake camera capture/retake; denied-camera messaging |
| `due-visit.spec.ts` | Desk send/skip/finish counts; mobile arrived + undo |
| `existing-token.spec.ts` | Second queue join on same phone shows existing token |
| `guest-models.spec.ts` | Super-admin guest fal model selection UI |
| `guest-regression.spec.ts` | Guest nav, queue, **one** try-on save/download, NOT_AT_SALON lock, owner desk |
| `launch-copy.spec.ts` | Visit-code help copy; hourly join cap label |
| `launch-readiness.spec.ts` | Multi-salon Sunday rush (desk + products) |
| `live-hours.spec.ts` | Queue join refused outside India salon hours |
| `loyalty.spec.ts` | Finish earns point; redeem spends it |
| `magic-link.spec.ts` | Magic link sign-in; invalid/expired/used links; password login |
| `operating-hours.spec.ts` | Owner hours block request joins; clearing restores default hours |
| `other-bookings.spec.ts` | Ticket links to earlier booking on same phone |
| `phone-matrix.spec.ts` | Guest tabs/bridal split; queue; owner desk; super-admin products/credits |
| `qr-logo.spec.ts` | Printable standee shows salon logo |
| `queue-stabilize.spec.ts` | Queue desk stabilization regressions |
| `queue.spec.ts` | Join, token, desk Next/Done, request mode, paused queue |
| `request-label.spec.ts` | Request-a-time copy on welcome and try-on |
| `responsive.spec.ts` | Layout overflow/tap targets across viewports (no try-on generate) |
| `session-hours.spec.ts` | Desk session banner: early close, late open, closed today |
| `smoke.spec.ts` | Guest chrome, cap/salon mode, bookings OTP, owner/super settings (no full try-on tour) |
| `soft-delete.spec.ts` | Super-admin delete salon; guest 404 |
| `ux-simplify.spec.ts` | Login ready gate, manifest, nav, queue copy, nails hand photo |

Helpers kept: `safe-shot.ts`, `arrive-demo.ts` (`arriveDemoGuest`, `salonDayUnlock`), `live-entry.ts`.

## Deleted (why)

| File | Reason |
|---|---|
| `five-tools.spec.ts` | Mock try-on across five tools + `before-after` timing |
| `studio.spec.ts` | Screenshot tour + live-look canvas pixel/CV checks |
| `makeup-studio.spec.ts` | Makeup paint/screenshot + photoreal sample visuals |
| `bridal.spec.ts` | Full bridal mock generate, before/after, screenshot harvest |

**Trimmed (not deleted):** `smoke.spec.ts`, `phone-matrix.spec.ts` — removed mock generate / pixel / doc screenshot paths; `guest-regression.spec.ts` — dropped second colour-tab generate (single try-on path kept).

`playwright.config.ts`: removed `tablet` project (`five-tools` only) and obsolete `testIgnore` entries for deleted specs.

## Core local run

Seed once: `npm run seed`. Then:

```bash
npx playwright test \
  tests/e2e/guest-regression.spec.ts \
  tests/e2e/queue.spec.ts \
  tests/e2e/queue-stabilize.spec.ts \
  tests/e2e/magic-link.spec.ts \
  tests/e2e/loyalty.spec.ts \
  tests/e2e/operating-hours.spec.ts \
  tests/e2e/live-hours.spec.ts \
  tests/e2e/session-hours.spec.ts \
  tests/e2e/soft-delete.spec.ts \
  tests/e2e/due-visit.spec.ts \
  tests/e2e/existing-token.spec.ts \
  tests/e2e/phone-matrix.spec.ts \
  tests/e2e/smoke.spec.ts \
  tests/e2e/brow-cards.spec.ts \
  tests/e2e/camera.spec.ts \
  tests/e2e/guest-models.spec.ts \
  tests/e2e/launch-copy.spec.ts \
  tests/e2e/launch-readiness.spec.ts \
  tests/e2e/other-bookings.spec.ts \
  tests/e2e/qr-logo.spec.ts \
  tests/e2e/request-label.spec.ts \
  tests/e2e/ux-simplify.spec.ts \
  --reporter=line
```

Add `tests/e2e/responsive.spec.ts` for layout-only multi-viewport checks (often the noisiest project).