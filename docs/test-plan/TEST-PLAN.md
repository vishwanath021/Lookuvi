# Lookuvi launch test plan

Executed on 24 October 2026 against the local server. AI provider is mock. WhatsApp is not a live handset: webhook signatures use a local secret, and reminder sends use an injected sender that never calls Meta. `OPENAI_API_KEY` was removed from the process. Demo logins only.

Result: **193 pass**, **0 fail**, **4 untested**, 197 cases.

The inventory counts from the approval note were sizing estimates. This sheet is the case list that was actually written and run. A case that was not run is UNTESTED with a reason. Nothing here is a silent pass.

## Onboarding checklist

Use this for each of the seven salons. Do it in order.

| Step | Do this | What good looks like |
| --- | --- | --- |
| 1 | Super admin creates the salon | Name, lowercase slug, city, WhatsApp, owner email, a password of at least 12 characters that is not a demo password. Plan as sold. Queue is already on. One trial grant. Styles are copied. |
| 2 | Owner signs in and finishes onboarding | Brand, services, WhatsApp, languages, then Finish. Staff can see the wizard until Finish. |
| 3 | Owner sets chairs and hours | On the queue desk, not in Settings. Chairs 1–30, average minutes, live line or time requests, chair/station/room. Pause the line before the QR is public if the shop is not ready. |
| 4 | Owner checks caps | Anonymous daily, member daily, monthly try-ons, visit tries for bridal. Daily and monthly reset at midnight Asia/Kolkata. |
| 5 | Owner confirms reminders | On by default, 35 days, range 28–42. WhatsApp monthly cap default 50. Reminders and offers count. Queue alerts and the desk WhatsApp button do not. |
| 6 | Print the QR only on the real domain | The code points at the welcome page. Localhost refuses to print and says it is not ready. |
| 7 | Staff rehearsal | Join from a phone, Next, Start, Done. In request mode: confirm, decline, Mark visited. Walk-in only on the live line. |
| 8 | Book this look | A guest tap creates a lead and opens WhatsApp. Lite does not download the CSV. Starter and Pro do. |
| 9 | STOP rehearsal | A reply of STOP opts out that salon only. STOPALL or UNSUBSCRIBE opts out the shared number everywhere. The owner cannot undo STOP. |
| 10 | Leave billing, bookings, guest hub, custom domain, outlets, salon AI key, embed, and the guide off | Tell the owner those are not in this launch. |

## How a case was run

- `http` is a request to the local Next server.
- `http+db` checks the row afterwards.
- `library` calls the same function the server uses, with a fake WhatsApp sender where a real send would cost money or need Meta.
- `db` reads the seeded row.
- `script` is `npm run scan:secrets`.
- `k6` is the browse script. It is UNTESTED because k6 is not installed here.

## Integration

Mock AI returns a JPEG and sets `x-demo-reason: no-key`. The credit balance does not move. A succeeded-cap test inserts a SUCCEEDED row, because a mock sample is stored as DEMO and does not count. The WhatsApp webhook is signed with the local app secret. Cron uses the local bearer secret. Neither path calls Meta or OpenAI.

Performance: `scripts/k6/guest-browse.js` loads health, the welcome page, and the public queue for the demo salon. Five virtual users, 30 seconds. Thresholds: failed requests under 5 percent, 95th percentile under 1.5 seconds. Not run in this environment.

## Results by functionality

| Id | Pass | Fail | Untested |
| --- | --- | --- | --- |
| C1 | 7 | 0 | 0 |
| C2 | 4 | 0 | 0 |
| C3 | 11 | 0 | 0 |
| C4 | 5 | 0 | 1 |
| C5 | 3 | 0 | 0 |
| C6 | 4 | 0 | 0 |
| C7 | 3 | 0 | 0 |
| C9 | 3 | 0 | 0 |
| C10 | 5 | 0 | 0 |
| C11 | 11 | 0 | 0 |
| C12 | 4 | 0 | 0 |
| C13 | 2 | 0 | 0 |
| C14 | 4 | 0 | 0 |
| C17 | 4 | 0 | 0 |
| S1 | 3 | 0 | 0 |
| S2 | 5 | 0 | 0 |
| S3 | 2 | 0 | 0 |
| S5 | 3 | 0 | 0 |
| S4 | 1 | 0 | 0 |
| S7 | 5 | 0 | 0 |
| S8 | 4 | 0 | 0 |
| P2 | 4 | 0 | 0 |
| P3 | 2 | 0 | 0 |
| S9 | 2 | 0 | 0 |
| O2 | 4 | 0 | 0 |
| O6 | 2 | 0 | 0 |
| O3 | 1 | 0 | 0 |
| O8 | 3 | 0 | 0 |
| O9 | 3 | 0 | 0 |
| O11 | 2 | 0 | 0 |
| O12 | 2 | 0 | 0 |
| O13 | 3 | 0 | 0 |
| O14 | 1 | 0 | 0 |
| A1 | 2 | 0 | 0 |
| A2 | 4 | 0 | 0 |
| A3 | 5 | 0 | 0 |
| A4 | 3 | 0 | 0 |
| A5 | 1 | 0 | 0 |
| A8 | 1 | 0 | 0 |
| A10 | 1 | 0 | 1 |
| P1 | 5 | 0 | 0 |
| P4 | 2 | 0 | 0 |
| P5 | 1 | 0 | 0 |
| P6 | 10 | 0 | 0 |
| P7 | 3 | 0 | 0 |
| P8 | 2 | 0 | 0 |
| P13 | 1 | 0 | 0 |
| X1 | 4 | 0 | 0 |
| X2 | 1 | 0 | 0 |
| X3 | 1 | 0 | 0 |
| X7 | 1 | 0 | 0 |
| X8 | 2 | 0 | 0 |
| X9 | 1 | 0 | 0 |
| X10 | 1 | 0 | 0 |
| X11 | 1 | 0 | 0 |
| X12 | 2 | 0 | 0 |
| O1 | 1 | 0 | 0 |
| O7 | 1 | 0 | 0 |
| S6 | 1 | 0 | 0 |
| X6 | 1 | 0 | 0 |
| OFF | 5 | 0 | 0 |
| P10 | 0 | 0 | 1 |
| K6 | 0 | 0 | 1 |
| O4 | 1 | 0 | 0 |
| O15 | 1 | 0 | 0 |
| O5 | 2 | 0 | 0 |
| O10 | 1 | 0 | 0 |
| X4 | 1 | 0 | 0 |
| X5 | 1 | 0 | 0 |

## Cases

### C1

#### C1-01 Public route /s/demo (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The seeded demo salon exists and mock AI is on
- When: A guest opens /s/demo
- Then: The page returns 200 and mentions Demo Salon

#### C1-02 Public route /s/does-not-exist-505a (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The seeded demo salon exists and mock AI is on
- When: A guest opens /s/does-not-exist-505a
- Then: The page returns 404

#### C1-03 Public route /s/demo/queue (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The seeded demo salon exists and mock AI is on
- When: A guest opens /s/demo/queue
- Then: The page returns 200 and mentions queue

#### C1-04 Public route /s/demo/welcome (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The seeded demo salon exists and mock AI is on
- When: A guest opens /s/demo/welcome
- Then: The page returns 200 and mentions Welcome

#### C1-05 Public route /s/demo/q/not-a-token (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The seeded demo salon exists and mock AI is on
- When: A guest opens /s/demo/q/not-a-token
- Then: The page returns 200

#### C1-06 Subdomain rewrite is wired for a salon host (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: ROOT_DOMAIN is localhost
- When: A request arrives with host demo.try.localhost
- Then: Middleware rewrites it toward /s/demo

#### C1-07 Home page loads (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The server is up
- When: GET /
- Then: 200

### C2

#### C2-01 Suspended salon shows the paused page (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: QA salon is suspended
- When: A guest opens /s/qalaunch505a
- Then: The page says the salon is paused

#### C2-02 Suspended salon refuses a try-on (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: QA salon is suspended
- When: A guest posts a preview
- Then: The API returns SUSPENDED

#### C2-03 Suspended salon refuses a queue join (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: QA salon is suspended and the queue is on
- When: A guest joins the line
- Then: The API returns SUSPENDED

#### C2-04 Paused page names the salon (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: Suspended QA salon
- When: The public page renders
- Then: Both the name and the paused heading are present

### C3

#### C3-01 Mock hairstyle preview returns a JPEG sample (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: AI_PROVIDER is mock and the salon has the style tool on
- When: A guest submits the sample portrait and a women's style
- Then: The response is an image and the demo reason is no-key

#### C3-02 Colour preview uses the shade id (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The colour tool is on
- When: A guest requests tool=colour with a known shade
- Then: Mock AI returns an image

#### C3-03 brows tool accepts a preview when the tool is on (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: toolBrows is true
- When: A signed-in owner requests tool=brows
- Then: The API returns 200 or a placement/style refusal, and never calls a paid provider

#### C3-04 beard tool accepts a preview when the tool is on (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: toolBeard is true
- When: A signed-in owner requests tool=beard
- Then: The API returns 200 or a placement/style refusal, and never calls a paid provider

#### C3-05 nails tool accepts a preview when the tool is on (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: toolNails is true
- When: A signed-in owner requests tool=nails
- Then: The API returns 200 or a placement/style refusal, and never calls a paid provider

#### C3-06 Unknown style is rejected (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The salon menu is the seeded catalogue
- When: The guest asks for styleId=not-a-style
- Then: The API returns STYLE

#### C3-07 Missing photo is rejected (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: A session id is present
- When: The guest omits the photo
- Then: The API returns INVALID

#### C3-08 A non-image file is rejected (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The upload is text, not a JPEG
- When: The guest posts it as the photo
- Then: The API returns TYPE

#### C3-09 Turning the style tool off hides that try-on (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The owner sets toolStyle false
- When: A guest requests a hairstyle
- Then: The API returns TOOL

#### C3-10 Try-on off with queue on sends the public home to the queue (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: productTryOn, bridal, and groom are off and the queue is on
- When: A guest opens /s/qalaunch505a
- Then: The server redirects to the queue

#### C3-11 Show women, men, and kids flags save (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The owner is signed in
- When: All three audience flags are set
- Then: They are stored

### C4

#### C4-01 Photo notice requires the age gate (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: A guest session
- When: Consent is posted with ageGate false
- Then: The API returns CONSENT

#### C4-02 Accepted photo notice is stored (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: A guest agrees
- When: Consent is posted with accepted and ageGate
- Then: A consent id is returned

#### C4-03 A preview stores consent for that session (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: No prior consent row
- When: A mock preview is generated
- Then: A TRYON_PREVIEW consent row exists

#### C4-04 Nails rejects a portrait that classifies as a face (UNTESTED)

- Priority: P0. Area: customer. Method: http.
- Given: The sample portrait is a face
- When: It is sent as a nails photo
- Then: A resolved nails look returns HAND for this portrait, or the case is untested if the look is not on the menu
- Detail: UNTESTED nails look was not on the menu, so the face check did not run

#### C4-05 Session id shorter than 8 characters is rejected (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: A photo is attached
- When: sessionId is 'short'
- Then: The API returns INVALID

#### C4-06 Unknown salon is rejected (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: No salon with that slug
- When: A preview is posted
- Then: The API returns TENANT 404

### C5

#### C5-01 Demo sample is labelled and does not spend credits (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: No provider key is configured
- When: A mock preview succeeds
- Then: x-demo-reason is no-key and the credit balance is unchanged

#### C5-02 Preview response is a JPEG body (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: A successful mock preview
- When: The bytes are inspected
- Then: They start with the JPEG marker

#### C5-03 Credits left header is present on a demo preview (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: A mock preview
- When: Headers are read
- Then: x-credits-left is a number

### C6

#### C6-01 Bridal look preview returns a mock sample (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: productBridal is on
- When: tool=bridal and styleId is a catalogue look
- Then: The API returns an image with demo reason no-key

#### C6-02 Unknown bridal look is rejected (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: Bridal is on
- When: styleId is not a bridal look
- Then: The API returns STYLE

#### C6-03 Bridal off returns PRODUCT (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The owner turns productBridal off
- When: A guest requests a bridal look
- Then: The API returns PRODUCT

#### C6-04 Mehendi without a full choice is rejected (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: Bridal is on
- When: tool=mehendi and styleId is incomplete
- Then: STYLE

### C7

#### C7-01 Own saree route refuses a paid call when no OpenAI key is set (PASS)

- Priority: P1. Area: customer. Method: http.
- Given: OPENAI_API_KEY is empty and no platform key is stored
- When: A selfie is posted to /api/v1/bridal/own
- Then: The API returns KEY 503 and does not call OpenAI

#### C7-02 Own look requires a selfie (PASS)

- Priority: P1. Area: customer. Method: http.
- Given: Bridal is on
- When: The form has no photo
- Then: The API returns INVALID

#### C7-03 Own look is off when bridal is off (PASS)

- Priority: P1. Area: customer. Method: http.
- Given: productBridal is false
- When: A selfie is posted
- Then: The API returns PRODUCT

### C9

#### C9-01 Default visit try limit is 3 (PASS)

- Priority: P0. Area: customer. Method: db.
- Given: A newly created salon
- When: visitTryLimit is read
- Then: It is 3

#### C9-02 Owner can set visit tries between 1 and 20 (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The owner is signed in
- When: visitTryLimit is set to 1 and then 20
- Then: Both saves succeed and 21 is rejected

#### C9-03 A session that already used its visit tries is refused (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: visitTryLimit is 1 and one SUCCEEDED bridal row exists
- When: The same session requests another bridal preview
- Then: The API returns 429

### C10

#### C10-01 Salon daily cap counts succeeded previews from Kolkata midnight (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: dailyCap is 1 and one SUCCEEDED preview exists after kolkataDayStart
- When: Another preview is requested
- Then: The API returns DAILY_CAP

#### C10-02 Monthly allowance blocks after the Kolkata month is full (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: monthlyTryAllowance is 1 and one succeeded preview exists this month
- When: Another preview is requested
- Then: The API returns MONTHLY_CAP

#### C10-03 Anonymous daily cap blocks the second guest preview (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: anonDailyCap is 1 and that actor already succeeded once today
- When: The same anonymous actor tries again
- Then: The API returns CAP

#### C10-04 Owner settings accept the documented cap bounds (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The owner is signed in
- When: anon 0 and 500, member 0 and 500, monthly 0 and 5000 are saved
- Then: Each save returns 200 and one step past the max returns 400

#### C10-05 A DEMO preview does not consume the succeeded daily cap (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: dailyCap is 1 and only DEMO rows exist
- When: Another mock preview runs
- Then: It is still allowed, because the cap counts SUCCEEDED

### C11

#### C11-01 Join from home issues a token (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The QA line is live and open
- When: A guest joins with name, phone, and consent
- Then: The ticket has token 1 or higher and a public link

#### C11-02 Join without consent is refused (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The line is open
- When: consent is false
- Then: The API returns CONSENT

#### C11-03 A short phone is refused (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The line is open
- When: The phone has 5 digits
- Then: The API returns PHONE

#### C11-04 An empty name is refused (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The line is open
- When: The name is blank
- Then: The API returns INVALID

#### C11-05 A paused line refuses new joins (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The desk pauses the line
- When: A guest joins
- Then: The API returns CLOSED

#### C11-06 The same phone keeps one live token (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: A guest already joined today
- When: They join again with the same phone
- Then: The same token is returned

#### C11-07 Public board shows the open line (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The line is open
- When: GET /api/v1/queue?slug= is called
- Then: open is true and mode is LIVE

#### C11-08 Join form copy mentions STOP (PASS)

- Priority: P1. Area: customer. Method: http.
- Given: The queue page is public
- When: The HTML is loaded
- Then: It tells the guest they can reply STOP

#### C11-09 A guest can cancel their own ticket (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: A live ticket with a ref
- When: POST /api/v1/queue/visit action cancel
- Then: The visit closes

#### C11-10 Queue is absent when the product is off (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: productQueue is false
- When: The public board is requested
- Then: 404 PRODUCT

#### C11-11 Join copy is on the queue page (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: Queue product on
- When: GET /s/qalaunch505a/queue
- Then: The page mentions the queue

### C12

#### C12-01 Time request requires a date and slot (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The desk is in REQUEST mode
- When: A guest joins without a slot
- Then: The API returns INVALID

#### C12-02 A future slot is accepted (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: REQUEST mode
- When: The guest picks tomorrow 11:00
- Then: The ticket status is REQUESTED

#### C12-03 A past date is refused (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: REQUEST mode
- When: The date is yesterday
- Then: The API returns INVALID

#### C12-04 Walk-in and next stay on the live desk only (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: Mode was returned to LIVE
- When: The public board is read
- Then: mode is LIVE

### C13

#### C13-01 Welcome page is the QR target (PASS)

- Priority: P1. Area: customer. Method: http.
- Given: The salon has no public domain
- When: GET /api/v1/qr?slug= is called on localhost
- Then: The API returns LOCAL_DOMAIN and refuses a printable code

#### C13-02 Welcome page renders for the demo salon (PASS)

- Priority: P1. Area: customer. Method: http.
- Given: The demo salon exists
- When: A guest opens /s/demo/welcome
- Then: The page says Welcome

### C14

#### C14-01 Book this look creates a lead and a WhatsApp link (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The salon has a WhatsApp number and the style is on the menu
- When: POST /api/v1/leads
- Then: A lead id and a wa.me link are returned

#### C14-02 A style that is not on the menu cannot be booked (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: styleId is unknown
- When: A lead is posted
- Then: The API returns STYLE

#### C14-03 Suspended salon cannot take a lead (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: The salon is suspended
- When: A lead is posted
- Then: The API returns TENANT

#### C14-04 Lead without a WhatsApp number is refused (PASS)

- Priority: P0. Area: customer. Method: http.
- Given: A salon with an empty WhatsApp field
- When: A lead is posted
- Then: The API returns WHATSAPP

### C17

#### C17-01 /privacy is public (PASS)

- Priority: P1. Area: customer. Method: http.
- Given: No login
- When: A guest opens /privacy
- Then: The page loads

#### C17-02 /terms is public (PASS)

- Priority: P1. Area: customer. Method: http.
- Given: No login
- When: A guest opens /terms
- Then: The page loads

#### C17-03 A data request is stored (PASS)

- Priority: P1. Area: customer. Method: http.
- Given: A guest asks to delete their preview
- When: POST /api/v1/data-requests
- Then: The API accepts access, delete, and withdraw

#### C17-04 Data request for an unknown salon is 404 (PASS)

- Priority: P1. Area: customer. Method: http.
- Given: No such slug
- When: POST data-requests
- Then: TENANT

### S1

#### S1-01 Admin home redirects to the queue when the queue product is on (PASS)

- Priority: P0. Area: staff. Method: http.
- Given: Demo staff is signed in and the demo queue is on
- When: They open /admin
- Then: The response redirects to /admin/queue

#### S1-02 Logged-out admin is sent to login (PASS)

- Priority: P0. Area: staff. Method: http.
- Given: No session cookie
- When: Someone opens /admin/queue
- Then: They are redirected to /login

#### S1-03 Queue desk page loads for staff (PASS)

- Priority: P0. Area: staff. Method: http.
- Given: QA staff
- When: GET /admin/queue
- Then: 200

### S2

#### S2-01 Next calls the first waiting guest (PASS)

- Priority: P0. Area: staff. Method: http.
- Given: One guest is waiting and a chair is free
- When: Staff taps next
- Then: That guest becomes CALLED

#### S2-02 Next is refused when the only chair is busy (PASS)

- Priority: P0. Area: staff. Method: http.
- Given: One chair and a guest is in service
- When: Another guest is waiting and staff taps next
- Then: The API says every place is busy

#### S2-03 No-show closes a called guest (PASS)

- Priority: P0. Area: staff. Method: http.
- Given: A guest has been called
- When: Staff marks no-show
- Then: The action succeeds

#### S2-04 Pause and open round-trip (PASS)

- Priority: P0. Area: staff. Method: http.
- Given: The live desk
- When: Staff pauses and the owner opens
- Then: The public board follows

#### S2-05 Next on an empty line says nobody is waiting (PASS)

- Priority: P0. Area: staff. Method: http.
- Given: No WAITING guests remain, or the line can be emptied by finishing
- When: Staff taps next with nobody waiting
- Then: The API returns EMPTY

### S3

#### S3-01 Walk-in joins the live line (PASS)

- Priority: P0. Area: staff. Method: http.
- Given: LIVE mode
- When: Staff adds a walk-in with a phone
- Then: The snapshot includes the walk-in

#### S3-02 Walk-in is refused in request mode (PASS)

- Priority: P0. Area: staff. Method: http.
- Given: The desk is in REQUEST mode
- When: Staff adds a walk-in
- Then: The API returns STATE

### S5

#### S5-01 Staff can confirm a time request (PASS)

- Priority: P0. Area: staff. Method: http.
- Given: A REQUESTED visit exists
- When: Staff confirms it
- Then: The visit becomes CONFIRMED

#### S5-02 Staff can decline a time request (PASS)

- Priority: P0. Area: staff. Method: http.
- Given: Another REQUESTED visit
- When: Staff declines it
- Then: The action succeeds

#### S5-03 Mark visited records a customer visit (PASS)

- Priority: P0. Area: staff. Method: http.
- Given: A confirmed request
- When: Staff marks it visited
- Then: The customer visit count increases

### S4

#### S4-01 Desk snapshot exposes a WhatsApp link that is not a platform send (PASS)

- Priority: P1. Area: staff. Method: http.
- Given: A waiting guest has a phone
- When: Staff loads the desk
- Then: A wa.me URL is present for that card

### S7

#### S7-01 Staff can add a customer (PASS)

- Priority: P1. Area: staff. Method: http.
- Given: The queue product is on
- When: Staff posts action add
- Then: The customer is listed

#### S7-02 Import rejects a blank file and accepts a valid line (PASS)

- Priority: P1. Area: staff. Method: http.
- Given: Staff is signed in
- When: They import one phone line
- Then: The import succeeds

#### S7-03 Staff can stop reminders and cannot resume them (PASS)

- Priority: P1. Area: staff. Method: http.
- Given: A customer exists
- When: Staff stops, then tries to resume
- Then: Stop succeeds and resume is owner-only

#### S7-04 Staff cannot change reminder settings or send an offer (PASS)

- Priority: P1. Area: staff. Method: http.
- Given: Staff is signed in
- When: They post settings and broadcast
- Then: Both return 403

#### S7-05 Search returns at most the people who match (PASS)

- Priority: P1. Area: staff. Method: http.
- Given: A uniquely named customer
- When: Staff searches that name
- Then: The name is present

### S8

#### S8-01 Lead status cycles through the allowed values (PASS)

- Priority: P1. Area: staff. Method: http.
- Given: A lead exists on the QA salon
- When: Staff sets CONTACTED, BOOKED, CLOSED, then NEW
- Then: Each update returns 200

#### S8-02 Lite cannot download the lead CSV (PASS)

- Priority: P1. Area: staff. Method: http.
- Given: The isolation salon is on Lite
- When: Its owner downloads /api/v1/admin/leads/export
- Then: The API refuses because Lite does not include lead export

#### S8-03 Starter can download the lead CSV (PASS)

- Priority: P1. Area: staff. Method: http.
- Given: QA salon is Starter
- When: Staff downloads the CSV
- Then: The body is CSV

#### S8-04 An unknown lead status is rejected (PASS)

- Priority: P1. Area: staff. Method: http.
- Given: A lead id
- When: status is WON
- Then: 400

### P2

#### P2-01 Staff cannot save salon settings (PASS)

- Priority: P0. Area: platform. Method: http.
- Given: QA staff is signed in
- When: PUT /api/v1/admin/settings
- Then: The API returns OWNER_ONLY

#### P2-02 A salon owner cannot open super APIs (PASS)

- Priority: P0. Area: platform. Method: http.
- Given: The demo owner is signed in
- When: GET /api/v1/super
- Then: The API returns 403

#### P2-03 Anonymous calls to admin APIs are rejected (PASS)

- Priority: P0. Area: platform. Method: http.
- Given: No session
- When: GET /api/v1/admin/queue
- Then: The API returns 401

#### P2-04 A cross-site admin POST is rejected (PASS)

- Priority: P0. Area: platform. Method: http.
- Given: The owner has a session
- When: PUT settings is sent with a foreign Origin
- Then: The API returns CSRF

### P3

#### P3-01 A lead id from another salon cannot be updated (PASS)

- Priority: P0. Area: platform. Method: http.
- Given: A lead belongs to the QA salon
- When: The other salon's owner patches it
- Then: The API returns NOT_FOUND and the status stays NEW

#### P3-02 Staff settings GET is owner-only (PASS)

- Priority: P0. Area: platform. Method: http.
- Given: QA staff
- When: GET /api/v1/admin/settings
- Then: 403

### S9

#### S9-01 Salon switch refuses a salon the user does not belong to (PASS)

- Priority: P1. Area: staff. Method: http.
- Given: QA staff belongs only to the QA salon
- When: They post the demo tenant id
- Then: The API returns NO_TENANT

#### S9-02 Switching to the user's own salon sets the salon cookie (PASS)

- Priority: P1. Area: staff. Method: http.
- Given: QA staff belongs to the QA salon
- When: They post that tenant id
- Then: The response sets helix_salon

### O2

#### O2-01 Owner can save name, colours, WhatsApp, and address (PASS)

- Priority: P0. Area: owner. Method: http.
- Given: QA owner is signed in
- When: PUT settings with those fields
- Then: The salon row matches

#### O2-02 A bad colour is rejected (PASS)

- Priority: P0. Area: owner. Method: http.
- Given: The owner is signed in
- When: primaryColor is not a hex colour
- Then: The API returns 400

#### O2-03 Lite does not enforce the two-language catalogue limit (PASS)

- Priority: P1. Area: owner. Method: http.
- Given: The salon plan is Lite
- When: The owner saves six languages
- Then: The save succeeds. This is a known launch gap, not a silent pass of a limit.

#### O2-04 Deleting a salon from the owner API is refused (PASS)

- Priority: P0. Area: owner. Method: http.
- Given: The owner is signed in
- When: DELETE /api/v1/admin/settings
- Then: 405 and the salon remains

### O6

#### O6-01 Starter cannot remove Lookuvi branding (PASS)

- Priority: P1. Area: owner. Method: http.
- Given: The salon is on Starter
- When: removeBranding is true
- Then: The API returns PLAN

#### O6-02 Require phone login to book can be turned on (PASS)

- Priority: P1. Area: owner. Method: http.
- Given: Try-on is on
- When: requireLoginToBook is true
- Then: The flag is stored

### O3

#### O3-01 Groom stays off unless the owner turns it on (PASS)

- Priority: P0. Area: owner. Method: http.
- Given: A new salon
- When: productGroom is read
- Then: It is false, and the owner can turn it on

### O8

#### O8-01 Owner cannot invite with a short password (PASS)

- Priority: P1. Area: owner. Method: http.
- Given: The email is new
- When: The password is 6 characters
- Then: The API returns WEAK

#### O8-02 Owner cannot remove themselves when they are the only owner (PASS)

- Priority: P1. Area: owner. Method: http.
- Given: QA salon has one owner
- When: DELETE team with their user id
- Then: The API returns LAST_OWNER or SELF

#### O8-03 A super admin email cannot be invited as staff (PASS)

- Priority: P1. Area: owner. Method: http.
- Given: super@agenticbuildworks.com
- When: The owner invites that email
- Then: 403

### O9

#### O9-01 A service accepts price and duration inside the limits (PASS)

- Priority: P0. Area: owner. Method: http.
- Given: The owner is signed in
- When: They save a service at 499 for 30 minutes
- Then: The row is stored

#### O9-02 A price above 500000 is rejected (PASS)

- Priority: P0. Area: owner. Method: http.
- Given: The owner is signed in
- When: priceInr is 500001
- Then: The API returns 400

#### O9-03 Duration outside 5 to 480 is rejected (PASS)

- Priority: P0. Area: owner. Method: http.
- Given: The owner is signed in
- When: durationMin is 4 and then 481
- Then: Both return 400

### O11

#### O11-01 Queue settings reject a chair count outside 1 to 30 (PASS)

- Priority: P0. Area: owner. Method: http.
- Given: The owner is signed in
- When: units is 0 and then 31
- Then: Both return 400

#### O11-02 Average minutes outside 5 to 240 is rejected (PASS)

- Priority: P0. Area: owner. Method: http.
- Given: The owner is signed in
- When: avgMinutes is 4
- Then: The API returns 400

### O12

#### O12-01 Owner can set reminders, the day gap, and the WhatsApp cap (PASS)

- Priority: P1. Area: owner. Method: http.
- Given: The owner is signed in
- When: settings are 28 days and cap 50
- Then: The customer settings echo those values

#### O12-02 Reminder days outside 28 to 42 are clamped or rejected (PASS)

- Priority: P1. Area: owner. Method: http.
- Given: The owner posts 10 days
- When: The value is stored
- Then: The stored gap is inside 28 to 42

### O13

#### O13-01 An offer is not sent when WhatsApp is not connected (PASS)

- Priority: P1. Area: owner. Method: http.
- Given: No WhatsApp token is configured
- When: The owner broadcasts a short offer
- Then: The API says nothing was sent

#### O13-02 A two-character offer is rejected (PASS)

- Priority: P1. Area: owner. Method: http.
- Given: The owner is signed in
- When: The text is 'hi'
- Then: The API returns 400

#### O13-03 Offer text is capped at 180 characters (PASS)

- Priority: P1. Area: owner. Method: http.
- Given: A 200 character offer
- When: cleanOffer runs and the broadcast is posted
- Then: The stored broadcast is at most 180 characters

### O14

#### O14-01 Owner can resume a desk stop and cannot resume a STOP reply (PASS)

- Priority: P1. Area: owner. Method: http.
- Given: One customer was stopped at the desk and one replied STOP
- When: The owner resumes each
- Then: The desk stop resumes and the STOP reply stays off

### A1

#### A1-01 Super overview lists salons (PASS)

- Priority: P1. Area: super. Method: http.
- Given: The super admin is signed in and TOTP is not required in development
- When: GET /api/v1/super
- Then: The QA salon is in the payload

#### A1-02 Salon owner cannot open the super page (PASS)

- Priority: P1. Area: super. Method: http.
- Given: Demo owner session
- When: GET /super
- Then: Redirect to login

### A2

#### A2-01 A new salon starts with the queue on and one plan grant (PASS)

- Priority: P0. Area: super. Method: http+db.
- Given: Super admin creates a salon
- When: The row is read
- Then: productQueue is true, the mark equals the plan credits, and one TRIAL_GRANT exists

#### A2-02 A reserved or duplicate slug is rejected (PASS)

- Priority: P0. Area: super. Method: http.
- Given: demo already exists
- When: Super admin posts slug demo
- Then: The API returns 409

#### A2-03 A short owner password is rejected (PASS)

- Priority: P0. Area: super. Method: http.
- Given: The email is new
- When: ownerPassword is 'tiny'
- Then: The API returns PASSWORD

#### A2-04 Slug must be lowercase words (PASS)

- Priority: P0. Area: super. Method: http.
- Given: Super admin
- When: slug is 'Bad Slug'
- Then: 400

### A3

#### A3-01 Upgrading Starter to Pro grants only the gap (PASS)

- Priority: P0. Area: super. Method: http.
- Given: QA salon mark is 900
- When: The plan is set to PRO
- Then: 900 credits are added and the mark becomes 1800

#### A3-02 Repeating Pro grants nothing (PASS)

- Priority: P0. Area: super. Method: http.
- Given: The mark is already 1800
- When: The plan is set to PRO again
- Then: creditsGranted is 0

#### A3-03 A downgrade does not take tries away (PASS)

- Priority: P0. Area: super. Method: http.
- Given: The salon is Pro
- When: The plan is set to LITE
- Then: creditsGranted is 0 and the balance stays

#### A3-04 A custom daily cap is kept when the plan changes (PASS)

- Priority: P0. Area: super. Method: http.
- Given: dailyCap was set to 12, which is not the Lite inclusion
- When: The plan returns to PRO
- Then: dailyCap stays 12 and the grant is 0 because the mark is already 1800

#### A3-05 Super admin can turn the queue off for one salon (PASS)

- Priority: P0. Area: super. Method: http.
- Given: The isolation salon has the queue on
- When: productQueue is set false
- Then: The public queue returns PRODUCT and the demo salon is untouched

### A4

#### A4-01 Goodwill of 50 adds 50 and does not move the plan mark (PASS)

- Priority: P0. Area: super. Method: http.
- Given: A known balance and mark
- When: creditDelta is 50
- Then: Balance rises by 50 and the mark is unchanged

#### A4-02 Credits cannot be reduced below zero (PASS)

- Priority: P0. Area: super. Method: http.
- Given: The balance is finite
- When: creditDelta is a large negative number
- Then: The API refuses and the balance is unchanged

#### A4-03 A credit delta of zero does not write a ledger row (PASS)

- Priority: P0. Area: super. Method: http.
- Given: The current ledger count
- When: The body includes creditDelta 0 and a name change
- Then: No new ADJUSTMENT row is created

### A5

#### A5-01 AI settings do not echo a raw key (PASS)

- Priority: P1. Area: super. Method: http.
- Given: Super admin opens AI settings
- When: GET /api/v1/super/ai
- Then: The body has no sk- key and no OPENAI secret

### A8

#### A8-01 Costs page data is readable by super admin only (PASS)

- Priority: P1. Area: super. Method: http.
- Given: Super admin and a salon owner
- When: Each opens /api/v1/super/ai/costs
- Then: Super admin gets 200 and the owner gets 403

### A10

#### A10-01 Development does not force an authenticator (PASS)

- Priority: P1. Area: super. Method: http.
- Given: NODE_ENV is not production and the super admin has no TOTP
- When: They open /super
- Then: The page loads

#### A10-02 Production sends a super admin without TOTP to security (UNTESTED)

- Priority: P1. Area: super. Method: not-run.
- Given: NODE_ENV is production and totpEnabled is false
- When: They open any /super page except security
- Then: They are redirected to /super/security
- Detail: This server is development. The gate is NODE_ENV === production in requireSuper and pageSuper. Starting a production server was not done because this run must not deploy.

### P1

#### P1-01 Wrong password does not create a session (PASS)

- Priority: P0. Area: platform. Method: http.
- Given: The demo owner email
- When: The password is wrong
- Then: No session cookie is set

#### P1-02 Login page is email and password (PASS)

- Priority: P0. Area: platform. Method: http.
- Given: No session
- When: GET /login
- Then: The page has a password field and does not present a magic-link form

#### P1-03 Forgot password does not reveal whether the email exists (PASS)

- Priority: P0. Area: platform. Method: http.
- Given: Mail is not configured
- When: An unknown email and the demo email are submitted
- Then: Both responses use the same public message

#### P1-04 Reset page is the password reset screen (PASS)

- Priority: P0. Area: platform. Method: http.
- Given: No token
- When: GET /login/reset
- Then: The page loads

#### P1-05 Magic link route is not the login screen (PASS)

- Priority: P0. Area: platform. Method: http.
- Given: ALLOW_DEV_MAGIC_LINK may be true
- When: The login HTML is read
- Then: It does not offer to email a magic link

### P4

#### P4-01 Health does not name a provider (PASS)

- Priority: P0. Area: platform. Method: http.
- Given: The server is up
- When: GET /api/health
- Then: ok is true and the body does not mention openai

#### P4-02 Readiness checks the database (PASS)

- Priority: P0. Area: platform. Method: http.
- Given: SQLite is reachable
- When: GET /api/ready
- Then: ok and db are true

### P5

#### P5-01 Queue alerts are not sent to Meta when templates are unset (PASS)

- Priority: P1. Area: platform. Method: http.
- Given: WHATSAPP_TOKEN is empty
- When: A guest joins
- Then: The ticket still succeeds

### P6

#### P6-01 Webhook without a signature is rejected (PASS)

- Priority: P1. Area: platform. Method: http.
- Given: A WhatsApp app secret is configured
- When: POST /api/whatsapp/webhook has no signature
- Then: The API returns 403

#### P6-02 Plain STOP opts out only the salon of the latest send (PASS)

- Priority: P1. Area: platform. Method: http.
- Given: The same phone has customers at two salons and a SENT row on the QA salon
- When: A signed webhook contains STOP
- Then: Only the QA salon is opted out

#### P6-03 STOPALL opts the phone out of every salon (PASS)

- Priority: P1. Area: platform. Method: http.
- Given: The phone is on two salons
- When: A signed webhook contains STOPALL
- Then: Both customers are opted out

#### P6-04 Verify handshake rejects a bad token (PASS)

- Priority: P1. Area: platform. Method: http.
- Given: A verify token is configured
- When: hub.verify_token does not match
- Then: The API returns 403

#### P6-05 Verify handshake echoes the challenge (PASS)

- Priority: P1. Area: platform. Method: http.
- Given: WHATSAPP_VERIFY_TOKEN matches
- When: hub.mode is subscribe
- Then: The body is the challenge

#### P6-06 Stop parser for "STOP" (PASS)

- Priority: P1. Area: platform. Method: library.
- Given: An inbound text
- When: stopScope runs
- Then: The scope is salon

#### P6-07 Stop parser for "stop." (PASS)

- Priority: P1. Area: platform. Method: library.
- Given: An inbound text
- When: stopScope runs
- Then: The scope is salon

#### P6-08 Stop parser for "UNSUBSCRIBE" (PASS)

- Priority: P1. Area: platform. Method: library.
- Given: An inbound text
- When: stopScope runs
- Then: The scope is global

#### P6-09 Stop parser for "hello" (PASS)

- Priority: P1. Area: platform. Method: library.
- Given: An inbound text
- When: stopScope runs
- Then: It is not a stop word

#### P6-10 A bad signature is rejected (PASS)

- Priority: P1. Area: platform. Method: http.
- Given: A secret is configured
- When: The signature is sha256=00
- Then: 403

### P7

#### P7-01 Cron without the secret is rejected (PASS)

- Priority: P1. Area: platform. Method: http.
- Given: CRON_SECRET is set
- When: POST /api/cron/queue has no Authorization
- Then: The API returns 403

#### P7-02 Cron with the secret runs and does not call Meta (PASS)

- Priority: P1. Area: platform. Method: http.
- Given: WhatsApp is not connected
- When: POST /api/cron/queue uses the bearer secret
- Then: ok is true and reminders are not sent

#### P7-03 A due reminder sends through the injected mock, not Meta (PASS)

- Priority: P1. Area: platform. Method: library.
- Given: A customer visited 40 days ago and reminders are on
- When: sweepDueReminders is called with a fake sender
- Then: The send is counted and the provider is the mock

### P8

#### P8-01 Retention cron uses the same secret (PASS)

- Priority: P1. Area: platform. Method: http.
- Given: CRON_SECRET is set
- When: POST /api/cron/retention with the bearer token
- Then: The API returns 200

#### P8-02 Retention cron rejects a short secret (PASS)

- Priority: P1. Area: platform. Method: http.
- Given: No bearer token
- When: POST /api/cron/retention
- Then: 403

### P13

#### P13-01 Secret scan has nothing to report (PASS)

- Priority: P0. Area: platform. Method: script.
- Given: The working tree
- When: npm run scan:secrets runs
- Then: It exits 0

### X1

#### X1-01 Wait is the minutes ahead divided by chairs (PASS)

- Priority: P0. Area: cross. Method: library.
- Given: Two people ahead at 20 minutes and one chair
- When: waitMinutes is called
- Then: The wait is 40

#### X1-02 People ahead are in service, then called, then earlier tokens (PASS)

- Priority: P0. Area: cross. Method: library.
- Given: Four rows
- When: peopleAhead is called for the later waiting token
- Then: The in-service and called guests and the earlier token are ahead

#### X1-03 A service duration replaces the salon average (PASS)

- Priority: P1. Area: cross. Method: library.
- Given: A service of 45 minutes and an average of 20
- When: serviceMinutes is called
- Then: The result is 45, and a missing duration uses 20

#### X1-04 A new live token is one higher than today's max (PASS)

- Priority: P0. Area: cross. Method: http.
- Given: The live line has a known max token
- When: Another guest joins
- Then: Their token is max+1

### X2

#### X2-01 A desk next shows up on the public ticket (PASS)

- Priority: P0. Area: cross. Method: http.
- Given: A guest has a ticket
- When: Staff calls next
- Then: The public status for that ref is CALLED

### X3

#### X3-01 Switching mode does not convert existing tokens (PASS)

- Priority: P0. Area: cross. Method: http+db.
- Given: A live waiting token exists
- When: The desk switches to REQUEST
- Then: The old row stays WAITING and is not REQUESTED

### X7

#### X7-01 The public page shows the salon name saved in settings (PASS)

- Priority: P0. Area: cross. Method: http.
- Given: The QA salon name is QA Launch Salon
- When: A guest opens the public page
- Then: The HTML contains that name

### X8

#### X8-01 Customers navigation follows the queue product (PASS)

- Priority: P0. Area: cross. Method: http.
- Given: productQueue is true
- When: The owner HTML for /admin/customers is loaded
- Then: The page is not a 404

#### X8-02 Groom off means the groom API is not the everyday path (PASS)

- Priority: P0. Area: cross. Method: http.
- Given: productGroom is false
- When: POST /api/v1/groom without a full body
- Then: The request does not succeed as a preview

### X9

#### X9-01 A suspended salon still lets the owner sign in (PASS)

- Priority: P0. Area: cross. Method: http.
- Given: The other salon is suspended
- When: Its owner opens settings
- Then: The API returns 200

### X10

#### X10-01 Customers shows the monthly allowance the owner saved (PASS)

- Priority: P0. Area: cross. Method: http.
- Given: monthlyTryAllowance is 30
- When: GET /api/v1/admin/customers
- Then: The payload includes the cap fields

### X11

#### X11-01 Lite style cap names Lite (PASS)

- Priority: P1. Area: cross. Method: http.
- Given: The salon is on Lite
- When: More than 25 styles are enabled
- Then: The message says Lite includes 25 styles

### X12

#### X12-01 Customer search does not return another salon's people (PASS)

- Priority: P0. Area: cross. Method: http.
- Given: A customer named Only Other exists on the isolation salon
- When: The QA owner searches
- Then: That name is absent

#### X12-02 The seeded demo salon is still Pro with the queue on (PASS)

- Priority: P0. Area: cross. Method: db.
- Given: QA used a separate salon
- When: The demo row is read
- Then: plan is PRO and productQueue is true

### O1

#### O1-01 Onboarding can be finished by the owner (PASS)

- Priority: P0. Area: owner. Method: http.
- Given: onboardingDone is false
- When: The owner sets onboardingDone true
- Then: The flag is stored

### O7

#### O7-01 Rotating the salon link changes the token (PASS)

- Priority: P1. Area: owner. Method: http.
- Given: The owner is signed in
- When: POST /api/v1/admin/salon-token twice
- Then: The two URLs differ

### S6

#### S6-01 Staff can unlock extra visit tries for a session code (PASS)

- Priority: P1. Area: staff. Method: http.
- Given: A session has a consent row
- When: Staff posts the last 8 characters
- Then: A bonus is recorded

### X6

#### X6-01 A return link on join attributes the visit (PASS)

- Priority: P1. Area: cross. Method: http+db.
- Given: A reminder send has a link token
- When: The guest joins with returnToken
- Then: A customer return row exists

### OFF

#### OFF-01 /admin/bookings stays off (PASS)

- Priority: P1. Area: platform. Method: http.
- Given: The launch flags are unset
- When: A signed-in user opens /admin/bookings
- Then: The page is 404

#### OFF-02 /s/demo/guide stays off (PASS)

- Priority: P1. Area: platform. Method: http.
- Given: The launch flags are unset
- When: A signed-in user opens /s/demo/guide
- Then: The page is 404

#### OFF-03 /s/demo/me stays off (PASS)

- Priority: P1. Area: platform. Method: http.
- Given: The launch flags are unset
- When: A signed-in user opens /s/demo/me
- Then: The page is 404

#### OFF-04 /embed/demo stays off (PASS)

- Priority: P1. Area: platform. Method: http.
- Given: The launch flags are unset
- When: A signed-in user opens /embed/demo
- Then: The page is 404

#### OFF-05 Self-serve billing is open only because this process is not production (PASS)

- Priority: P1. Area: owner. Method: http.
- Given: BILLING_PROVIDER is mock and NODE_ENV is development
- When: The owner posts a subscribe action
- Then: The production block is not active. The guide tells founders that production mock billing is blocked.

### P10

#### P10-01 Razorpay webhook is not exercised (UNTESTED)

- Priority: P1. Area: platform. Method: not-run.
- Given: Billing self-serve is off for launch
- When: A payment webhook would arrive
- Then: Not run. No live payment and no deploy.
- Detail: Payments are out of the launch scope. The route exists and was not called with a signed Razorpay payload.

### K6

#### K6-01 k6 guest browse (UNTESTED)

- Priority: P1. Area: platform. Method: k6.
- Given: k6 is installed
- When: scripts/k6/guest-browse.js runs against the local server
- Then: Health and the public board stay under the threshold
- Detail: k6 is not installed in this environment. The script is committed at scripts/k6/guest-browse.js and was not executed.

### O4

#### O4-01 Hair suggestion toggles save (PASS)

- Priority: P1. Area: owner. Method: http.
- Given: Try-on is on
- When: hairPickerOn and hairSuggestOn change
- Then: They are stored

### O15

#### O15-01 QR page loads for the owner (PASS)

- Priority: P0. Area: owner. Method: http.
- Given: Try-on is on
- When: The owner opens /admin/qr
- Then: The page returns 200

### O5

#### O5-01 Member daily cap of 501 is rejected (PASS)

- Priority: P0. Area: owner. Method: http.
- Given: The owner is signed in
- When: memberDailyCap is 501
- Then: The API returns 400

#### O5-02 Monthly allowance of 5001 is rejected (PASS)

- Priority: P0. Area: owner. Method: http.
- Given: The owner is signed in
- When: monthlyTryAllowance is 5001
- Then: The API returns 400

### O10

#### O10-01 Disabling one style removes it from booking (PASS)

- Priority: P1. Area: owner. Method: http.
- Given: The catalogue save sets one style disabled
- When: A lead uses that style
- Then: The API returns STYLE

### X4

#### X4-01 Chair label is returned on the public board (PASS)

- Priority: P0. Area: cross. Method: http.
- Given: unitLabel is room
- When: The board is read
- Then: unitLabel is room

### X5

#### X5-01 A 45 minute service is listed on the public board (PASS)

- Priority: P1. Area: cross. Method: http.
- Given: A service of 45 minutes
- When: The board is read
- Then: That service shows 45 minutes
