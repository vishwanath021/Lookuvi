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

Baseline 2026-11-14, `npx playwright test` on master: 115 passed, 59 failed, 59 skipped. Compare later runs to this list. These are not regressions.

- Result heading missing after generate (Soft Bob or Wolf Cut): `five-tools` android, iphone, desktop, tablet; `smoke` camera and gallery on android, iphone, desktop; `phone-matrix` guest upload, no-WhatsApp, and zero try-ons; `bridal` new catalogue; `align-slider` desktop both; `qa-feedback` retake on iphone.
- Colour swatch missing (Cherry Red): `smoke` colour/brows/nails/beard on android, iphone, desktop.
- Settings toast missing (“Settings saved.”): `smoke` renamed salon on android, iphone, desktop; `operating-hours` desktop; `qa-feedback` logo desktop.
- Strict-mode duplicate text: `bridal` android “20 Dec 2026”; `phone-matrix` long name; `smoke` “Meta Muse Image” on android, iphone, desktop; `studio` face placeholder; `ux-r4` face photo box on android and desktop; `qa-feedback` tool pill `.seg`.
- Gallery image is a thumb webp, not `/styles/*.jpg`: `smoke` gallery portraits on android, iphone, desktop; `ux-simplify` Voluminous Blowout on android, iphone, desktop.
- Queue ticket DOM: `guest-regression` WebKit “a guest can join the queue”; `queue-stabilize` android ticket status, request mode 404, and visit memory.
- Other: `smoke` daily cap (response timeout on android and desktop, salon-mode missing on iphone); `studio` camera notice and live-look pixel delta; `ux-r5` hidden makeup swatch and missing “Try 2 of 3”; `qa-feedback` desktop retake missing live studio; `qa-bridal-five` android Prisma init and desktop CSP `unsafe-eval`; `launch-copy` ninth join returns 200; `launch-readiness` Sunday rush Prisma error; `request-label` goto timeout; `qr-logo` salon logo missing; `phone-matrix` queue checkbox stays checked and “Try-on is turned off” missing; `responsive` overflow on webkit-ipad-mini (72) and webkit-ipad-pro (6).
