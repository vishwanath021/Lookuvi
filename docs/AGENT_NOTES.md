# Lookuvi agent notes

Read this file first. Do not deploy. Never print secrets. Mock AI and synthetic faces only.

## App map

Guest (`/s/[slug]`, `src/components/tryon/TryOnApp.tsx` plus panes):

- Everyday try-on: style, colour, brows, beard, nails. `LookPicker`, `BeforeAfter`, `ColourStage` (on-device colour).
- Bridal (`BridalFlow`, `BridalOwnLook`), Groom (`GroomFlow`), Makeup (`MakeupStudio`).
- Queue join `/s/[slug]/queue`, ticket `/s/[slug]/q/[token]`. Saved `/saved`. Services `/services`.
- Shared chrome: `GuestNav`, `AtSalonProvider` (`AtSalonNote.tsx`), `AtSalonSheet`.

Owner (`/admin`, `src/app/admin/layout.tsx`): queue `QueueDesk`, settings, onboarding `OnboardingWizard`, customers, bookings, services, styles, billing, QR, leads, reminders, security.

Super (`/super`): salons `SalonsBoard` → `POST /api/v1/super/tenants/[id]`, AI, costs, audit, security, styles.

## Try-on lock and credits

Schema default `tryOnsAtSalon` is **true**. Demo seed create and update set it **true**. Migration `20261114120000_demo_tryons_at_salon` sets it true for slug `demo` only, so an existing production demo row locks on deploy. Other salons are untouched.

When the flag is on, a try-on is allowed only after staff tap **Arrived** (`markArrived` sets `arrivedAt` and `SalonDayUnlock` for that Asia/Kolkata day). Joining the queue (`WAITING`) does not unlock. Server gate is `gatePaidForm` → `blockPaidVisit` → `refuseAtSalon`. Refusal is HTTP 403 `{ error: "NOT_AT_SALON" }` before a try is reserved or a cached image is replayed. Endpoints: `POST /api/v1/tryon/generate` (style, colour, brows, beard, nails, bridal, mehendi), `/api/v1/bridal/own`, `/api/v1/groom`, `/api/v1/makeup-studio/render`, `/api/v1/tryon/suggest`.

Client: `showLockedBrowse`. Before `/api/v1/at-salon` returns, trust `config.tryOnsAtSalon === true`. Try opens `AtSalonSheet` (“unlocks when you reach the salon”) and does not call generate. Signed-in owner, staff, and super-admin bypass the lock (`deskUserId`) so the desk can preview. A guest session does not.

Repeat Try: same photo, style, and session replays the ready `GenerationJob` (`x-tryon-id: replay`) and does not reserve another try. The at-salon gate still runs first, so a replay cannot skip Arrived.

## Standing rules

Nothing existing may break. Minimal root-cause fixes in shared components. Short impact note per fix. Tests first. Full Playwright (WebKit 390×844 + desktop 1280) only at the start and end of a change set; zero new failures. Few screenshots. Diff-only review of the final diff. No deploy. No real or famous faces.

## Tests

```bash
npm test                  # vitest, tests/unit, DATABASE_URL file:./test.db
npx playwright test       # tests/e2e, 1 worker, mock AI
```

Regression viewports are projects `regression-iphone` (WebKit, 390×844) and `regression-desktop` (1280×800), file `tests/e2e/guest-regression.spec.ts`. The dev server uses `AI_PROVIDER=mock` and `file:./dev.db`. Seed demo before the first e2e run (`npm run seed`). Guest tests that generate on the demo call `arriveDemoGuest` in `tests/e2e/arrive-demo.ts` so staff have marked Arrived.

## Known failing E2E

Baseline 2026-11-18 cleanup subset (edited specs + `guest-regression` + `queue`, not full suite): **79 passed, 47 failed, 8 did not run** (134 tests). Owner full-suite baseline 2026-11-14 was 115 passed / 59 failed / 59 skipped. See `docs/E2E_CLEANUP_2026-11-18.md`.

Removed one-off specs: `ux-r4`, `ux-r5`, `qa-bridal-five`, `qa-feedback`, `align-slider`, `bridal-slider`, `generation-ux` (covered by `guest-regression`).

Still noisy after cleanup:

- `guest-regression` queue join (ticket DOM / navigation).
- `responsive` horizontal overflow on some WebKit iPad and `desk-1440` (6px on `webkit-ipad-pro` — likely real layout; not fixed in cleanup PR).
- `smoke` / `five-tools` / `phone-matrix` generate timing on some chromium projects (mock AI, `before-after` visibility).
- `studio` live-look canvas deltas and consent copy on some viewports.
- `launch-readiness` only runs on desktop; requires `launch-qa.db` (`beforeAll` now runs `prisma db push`).
- Full-suite-only: `queue-stabilize`, `launch-copy`, `qr-logo`, `request-label`, `operating-hours` (unchanged this round).
