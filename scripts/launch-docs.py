#!/usr/bin/env python3
"""Turn docs/test-plan/results.json into markdown, CSV, XLSX, and print-ready HTML."""
import csv
import html
import json
from collections import OrderedDict
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

root = Path("docs/test-plan")
data = json.loads((root / "results.json").read_text())
results = data["results"]
summary = data["summary"]

by_func = OrderedDict()
for row in results:
    by_func.setdefault(row["functionality"], []).append(row)

def esc(value):
    return html.escape(str(value or "")).replace("\n", "<br>")

lines = []
lines.append("# Lookuvi launch test plan")
lines.append("")
lines.append("Executed on 24 October 2026 against the local server. AI provider is mock. WhatsApp is not a live handset: webhook signatures use a local secret, and reminder sends use an injected sender that never calls Meta. `OPENAI_API_KEY` was removed from the process. Demo logins only.")
lines.append("")
lines.append(f"Result: **{summary['pass']} pass**, **{summary['fail']} fail**, **{summary['untested']} untested**, {summary['total']} cases.")
lines.append("")
lines.append("The inventory counts from the approval note were sizing estimates. The column itself sums to 483 (P0 321, P1 162). The approval note rounded P0+P1 to about 340. This sheet is the case list that was actually written and run. A case that was not run is UNTESTED with a reason. Nothing here is a silent pass.")
lines.append("")
lines.append("## Onboarding checklist")
lines.append("")
lines.append("Use this for each of the seven salons. Do it in order.")
lines.append("")
checklist = [
    ("1", "Super admin creates the salon", "Name, lowercase slug, city, WhatsApp, owner email, a password of at least 12 characters that is not a demo password. Plan as sold. Queue is already on. One trial grant. Styles are copied."),
    ("2", "Owner signs in and finishes onboarding", "Brand, services, WhatsApp, languages, then Finish. Staff can see the wizard until Finish."),
    ("3", "Owner sets chairs and hours", "On the queue desk, not in Settings. Chairs 1–30, average minutes, live line or time requests, chair/station/room. Pause the line before the QR is public if the shop is not ready."),
    ("4", "Owner checks caps", "Anonymous daily, member daily, monthly try-ons, visit tries for bridal. Daily and monthly reset at midnight Asia/Kolkata."),
    ("5", "Owner confirms reminders", "On by default, 35 days, range 28–42. WhatsApp monthly cap default 50. Reminders and offers count. Queue alerts and the desk WhatsApp button do not."),
    ("6", "Print the QR only on the real domain", "The code points at the welcome page. Localhost refuses to print and says it is not ready."),
    ("7", "Staff rehearsal", "Join from a phone, Next, Start, Done. In request mode: confirm, decline, Mark visited. Walk-in only on the live line."),
    ("8", "Book this look", "A guest tap creates a lead and opens WhatsApp. Lite does not download the CSV. Starter and Pro do."),
    ("9", "STOP rehearsal", "A reply of STOP opts out that salon only. STOPALL or UNSUBSCRIBE opts out the shared number everywhere. The owner cannot undo STOP."),
    ("10", "Leave billing, bookings, guest hub, custom domain, outlets, salon AI key, embed, and the guide off", "Tell the owner those are not in this launch."),
]
lines.append("| Step | Do this | What good looks like |")
lines.append("| --- | --- | --- |")
for step, title, detail in checklist:
    lines.append(f"| {step} | {title} | {detail} |")
lines.append("")
lines.append("## How a case was run")
lines.append("")
lines.append("- `http` is a request to the local Next server.")
lines.append("- `http+db` checks the row afterwards.")
lines.append("- `library` calls the same function the server uses, with a fake WhatsApp sender where a real send would cost money or need Meta.")
lines.append("- `db` reads the seeded row.")
lines.append("- `script` is `npm run scan:secrets`.")
lines.append("- `k6` is the browse script. It is UNTESTED because k6 is not installed here.")
lines.append("")
lines.append("## Integration")
lines.append("")
lines.append("Mock AI returns a JPEG and sets `x-demo-reason: no-key`. The credit balance does not move. A succeeded-cap test inserts a SUCCEEDED row, because a mock sample is stored as DEMO and does not count. The WhatsApp webhook is signed with the local app secret. Cron uses the local bearer secret. Neither path calls Meta or OpenAI.")
lines.append("")
lines.append("Performance: `scripts/k6/guest-browse.js` loads health, the welcome page, and the public queue for the demo salon. Five virtual users, 30 seconds. Thresholds: failed requests under 5 percent, 95th percentile under 1.5 seconds. Not run in this environment.")
lines.append("")
lines.append("## Results by functionality")
lines.append("")
lines.append("| Id | Pass | Fail | Untested |")
lines.append("| --- | --- | --- | --- |")
for func, rows in by_func.items():
    passed = sum(1 for row in rows if row["status"] == "PASS")
    failed = sum(1 for row in rows if row["status"] == "FAIL")
    untested = sum(1 for row in rows if row["status"] == "UNTESTED")
    lines.append(f"| {func} | {passed} | {failed} | {untested} |")
lines.append("")
planned = {
    "C1": 6, "C2": 3, "C3": 22, "C4": 12, "C5": 10, "C6": 18, "C7": 12, "C9": 8, "C10": 16,
    "C11": 14, "C12": 8, "C13": 4, "C14": 6, "C17": 4,
    "S1": 4, "S2": 12, "S3": 4, "S4": 4, "S5": 6, "S6": 3, "S7": 8, "S8": 4, "S9": 4,
    "O1": 6, "O2": 8, "O3": 6, "O4": 8, "O5": 8, "O6": 4, "O7": 4, "O8": 6, "O9": 8,
    "O10": 8, "O11": 8, "O12": 6, "O13": 6, "O14": 8, "O15": 4,
    "A1": 4, "A2": 10, "A3": 10, "A4": 6, "A5": 12, "A8": 6, "A10": 4,
    "P1": 8, "P2": 12, "P3": 8, "P4": 6, "P5": 8, "P6": 6, "P7": 8, "P8": 5, "P13": 3,
    "X1": 10, "X2": 8, "X3": 8, "X4": 6, "X5": 4, "X6": 8, "X7": 4, "X8": 8, "X9": 3,
    "X10": 8, "X11": 4, "X12": 6,
}
reasons = {
    "C3": "Five tools each have a success case, and one case turns colour, brows, beard, and nails off. The estimate also counted a bad id and a hide for every tool, plus gallery taps. Women, men, and kids flags are saved in one case. ENABLED_TOOLS is a process setting, so it was not flipped on a running server.",
    "C4": "Consent, a short session, an unknown salon, and a file over 2 MB are run. Camera, retake, pinch, and HEIC are in the browser. The nails face check is UNTESTED: the portrait was refused as a look that is not on the menu, so the hand classifier did not run.",
    "C5": "The mock response is a labelled JPEG and the credit balance does not move. The before/after slider, pinch zoom, and the WhatsApp share sheet are on-screen gestures, covered by the customer video, not by a second HTTP row.",
    "C6": "Bridal and mehendi refusals, bridal turned off, the trial form, and the six-look ceiling are run. Makeup chips, live colour on the phone, and compare-two are client state.",
    "C7": "P1. Own-look refuses a paid call with no OpenAI key, requires a selfie, and follows the bridal switch. Each jewellery slot is the same upload path.",
    "C9": "Default 3, the 1–20 bound, the cap message, and a cached look that does not call the generator are run. Staff bonus tries are S6. Groom shares the same counter and stays off unless the owner turns it on.",
    "C10": "Salon daily, anonymous daily, a zero anonymous cap, monthly allowance, a demo row that does not count, and a zero-balance credit reserve are run. Hourly abuse limits and the rupee spend caps need a paid provider, which this cycle does not call. A mock preview never reaches reserveCredits.",
    "C11": "Join, validation, pause, one open token, cancel, product off, the STOP sentence, and On the way are run. Polling is the same status read the ticket already uses.",
    "C12": "Date, future slot, past date, and a second request for the same phone are run. Confirm, decline, and Mark visited are S5. The wait figure is omitted because request mode does not return one.",
    "C13": "P1. The welcome page is the QR target and it renders. A printed sheet and a phone camera are not a local HTTP case.",
    "C14": "A lead and a wa.me link, a style that is not on the menu, a suspended salon, and a missing WhatsApp number are run. Phone-login-before-book is O6 and is off for the guest hub.",
    "S2": "Open, pause, next, an empty line, a busy chair, no-show, start, and done are run. One card per chair and the 2.5s poll are the same snapshot.",
    "S5": "Confirm, decline, and Mark visited are run. Repeating those verbs on a closed card is the same state machine.",
    "O1": "The owner can finish, and staff see the link until then. The wizard's earlier steps save the same settings fields as O2.",
    "O2": "Name, colours, WhatsApp, address, a bad colour, and GSTIN are run. Logo and maps use the same save. Deleting the salon from the owner API is refused.",
    "O3": "Groom stays off until the owner turns it on, and that switch can be turned back off. Visit tries are C9. Bridal off is C6.",
    "O4": "P1. The hair-suggestion toggles save. Each everyday tool switch is the C3 hide case.",
    "O5": "Bounds above 500 and 5000 are rejected. Zero anonymous previews are accepted and then block. Live colour does not use that cap.",
    "O6": "P1. Starter cannot remove branding. Require-phone-to-book can be turned on. The guest hub behind that switch is off for launch.",
    "O7": "P1. Rotating the salon link changes the token. A second rotation is the same write.",
    "O8": "P1. A short staff password, removing the last owner, and inviting a super-admin email are refused.",
    "O9": "Price and duration bounds, and hiding a service from the join list, are run. Bridal package prices use the same service row.",
    "O10": "P1. Disabling one style removes it from booking. The Lite ceiling of 25 is X11. Sort and rename are the same catalogue save.",
    "O11": "Chair count, average minutes, and the 0–120 alert window are run. Live versus request mode is C12 and X3. The place label is X4.",
    "O12": "P1. The owner can set the switch, the 28–42 day gap, and the WhatsApp cap. Staff cannot, which is S7.",
    "O13": "P1. An offer is refused when WhatsApp is off, a two-character offer is rejected, and 200 characters are stored as 180. No message is sent to Meta.",
    "O14": "P1. A desk stop can be resumed and a STOP reply cannot. The month stats are the same customers payload.",
    "O15": "The QR page loads, and localhost printing returns LOCAL_DOMAIN. The embed snippet is behind FEATURE_EMBED, which is off.",
    "A1": "P1. The overview lists salons. An owner opening /super gets the shell and a redirect, with no salon data. The spend figure needs a paid month.",
    "A2": "Queue on, one trial grant, slug rules, a short password, a 14-day trial, and a full style copy are run. City and WhatsApp on create are the same form.",
    "A3": "Upgrade, repeat upgrade, downgrade, a custom daily cap, and turning one salon's queue off are run. Rename and status use the same salon update.",
    "A4": "Goodwill does not move the plan mark, a balance cannot go below zero, a zero delta writes nothing, and a note is stored. The +50 button is the same delta.",
    "A5": "P1. A saved key is not echoed. Changing the guest engine, approving medium, and the spend cap are production key operations and were not done with a live key.",
    "A8": "P1. Costs are readable by the super admin only. fal billing sync would call the provider.",
    "A10": "P1. Development does not require an authenticator. The production redirect is UNTESTED because this server is not production.",
    "P1": "Wrong password, the email form, forgot-password privacy, the reset screen, and the absence of a magic-link form are run. The 8-per-email and 30-per-IP limits are the shared limiter the login route calls. Hammering the login IP would lock the rest of this sheet.",
    "P2": "Staff cannot save settings, an owner cannot call super APIs, an anonymous admin call is rejected, and a cross-site POST is rejected. A demotion is the same membership check on the next request.",
    "P3": "A lead from another salon cannot be updated, staff cannot read owner settings, and another salon's waiting guest is not on this desk. Customer search isolation is X12.",
    "P4": "Health and the guest page do not name a provider. Readiness checks the database. Mock is the only generate path in this run.",
    "P5": "P1. With templates unset, a queue alert is not sent to Meta. A live handset was not used.",
    "P6": "P1. The inventory's 'one STOP blocks every salon' was wrong and was fixed: plain STOP is per salon, STOPALL is global. Signature, verify, and the parser are run. The sheet has more cases than the estimate because that fix needed them.",
    "P7": "P1. Cron without the secret is rejected, cron with the secret does not call Meta, and a due reminder uses the injected sender.",
    "P8": "P1. Both cron routes use the same secret rule. Liveness is the health check in P4.",
    "P13": "The secret scan is clean. Provider keys are not stored in this run. Log redaction is covered by the same scan and by not printing request bodies.",
    "X1": "Wait maths, the order of people ahead, a service duration, and token numbering are run. The per-salon day boundary is the same token rule.",
    "X2": "Next and no-show show on the public ticket. Pause blocking a join is C11. Start and done showing on the ticket are S2.",
    "X3": "Switching mode does not convert old tokens. Walk-in and next in request mode are C12.",
    "X4": "The place label is on the public board. Chair bounds are O11. Wait maths for more chairs are X1.",
    "X5": "P1. A 45 minute service is listed. The active flag hiding a service is O9.",
    "X6": "P1. A return link on join is attributed. Mark visited starting the clock is S5.",
    "X7": "The saved name and the saved colour are on the public page. WhatsApp on Book this look is C14.",
    "X8": "Customers follows the queue product. Try-on off sending guests to the queue is C3. Groom off is O3.",
    "X9": "The owner can still sign in while the salon is suspended, and resume clears the paused page. The guest paused page itself is C2.",
    "X10": "Customers shows the allowance the owner saved. The blocks themselves are C10 and O5, so they are not copied into a second id.",
    "X11": "P1. The Lite cap names Lite. Enabling and disabling a style is O10.",
    "X12": "Customer search does not cross salons, and the demo salon is left on Pro with the queue on. The desk isolation case is P3.",
}
lines.append("## Coverage against the inventory")
lines.append("")
lines.append("Executed counts below are cases in this sheet. Planned counts are the inventory column from the approval note. Where this sheet has fewer, the reason is the one agreed in D13: a repeated click was not added to make the column match.")
lines.append("")
lines.append("| Id | Priority | Planned | Executed | Why it is lower |")
lines.append("| --- | --- | ---: | ---: | --- |")
priority_of = {}
for row in results:
    priority_of.setdefault(row["functionality"], row["priority"])
for func, plan in planned.items():
    rows = by_func.get(func, [])
    done = len(rows)
    if done >= plan:
        continue
    pri = priority_of.get(func, "P0")
    why = reasons.get(func, "The inventory number was a sizing estimate. The named behaviour is already covered by the cases for this id.")
    lines.append(f"| {func} | {pri} | {plan} | {done} | {why} |")
lines.append("")
lines.append("Ids at or above the inventory column are omitted from this table. P2 and P3 rows were out of scope. OFF, K6, and P10 are launch notes, not inventory rows: flag-off routes, the k6 script, and Razorpay.")
lines.append("")
lines.append("## Cases")
lines.append("")
for func, rows in by_func.items():
    lines.append(f"### {func}")
    lines.append("")
    for row in rows:
        lines.append(f"#### {row['id']} {row['title']} ({row['status']})")
        lines.append("")
        lines.append(f"- Priority: {row['priority']}. Area: {row['area']}. Method: {row['method']}.")
        lines.append(f"- Given: {row['given']}")
        lines.append(f"- When: {row['when']}")
        lines.append(f"- Then: {row['then']}")
        if row.get("detail"):
            lines.append(f"- Detail: {row['detail']}")
        lines.append("")

(root / "TEST-PLAN.md").write_text("\n".join(lines))

fields = ["id", "functionality", "priority", "area", "title", "given", "when", "then", "status", "method", "detail"]
with (root / "cases.csv").open("w", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=fields)
    writer.writeheader()
    for row in results:
        writer.writerow({key: row.get(key, "") for key in fields})

book = Workbook()
sheet = book.active
sheet.title = "Results"
header_fill = PatternFill("solid", fgColor="1F3A34")
header_font = Font(color="FFFFFF", bold=True)
for col, key in enumerate(fields, 1):
    cell = sheet.cell(1, col, key)
    cell.fill = header_fill
    cell.font = header_font
fills = {
    "PASS": PatternFill("solid", fgColor="E5F4EA"),
    "FAIL": PatternFill("solid", fgColor="F8D7DA"),
    "UNTESTED": PatternFill("solid", fgColor="FFF3CD"),
}
for index, row in enumerate(results, 2):
    for col, key in enumerate(fields, 1):
        cell = sheet.cell(index, col, row.get(key, ""))
        cell.alignment = Alignment(wrap_text=True, vertical="top")
        if key == "status":
            cell.fill = fills.get(row["status"], PatternFill())
widths = [12, 14, 10, 12, 42, 36, 36, 42, 12, 12, 42]
for col, width in enumerate(widths, 1):
    sheet.column_dimensions[get_column_letter(col)].width = width
sheet.auto_filter.ref = f"A1:{get_column_letter(len(fields))}{len(results)+1}"
sheet.freeze_panes = "A2"

check = book.create_sheet("Onboarding")
for col, name in enumerate(["Step", "Do this", "What good looks like"], 1):
    cell = check.cell(1, col, name)
    cell.fill = header_fill
    cell.font = header_font
for index, item in enumerate(checklist, 2):
    for col, value in enumerate(item, 1):
        check.cell(index, col, value).alignment = Alignment(wrap_text=True, vertical="top")
check.column_dimensions["A"].width = 8
check.column_dimensions["B"].width = 42
check.column_dimensions["C"].width = 88

book.save(root / "cases.xlsx")

body = []
body.append("<!doctype html><html><head><meta charset='utf-8'><title>Lookuvi launch test plan</title>")
body.append("<style>body{font-family:Georgia,serif;max-width:900px;margin:32px auto;color:#1c1c1c;line-height:1.45}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #ccc;padding:6px;vertical-align:top}th{background:#1F3A34;color:white}h1,h2,h3{font-family:Palatino,serif}.pass{color:#146c43}.fail{color:#9b1c1c}.untested{color:#8a5a00}code{font-family:ui-monospace,monospace}</style></head><body>")
body.append(f"<h1>Lookuvi launch test plan</h1><p>{esc(lines[2])}</p>")
body.append(f"<p><strong>{summary['pass']} pass</strong>, {summary['fail']} fail, {summary['untested']} untested, {summary['total']} cases.</p>")
body.append("<h2>Onboarding checklist</h2><table><tr><th>Step</th><th>Do this</th><th>What good looks like</th></tr>")
for step, title, detail in checklist:
    body.append(f"<tr><td>{esc(step)}</td><td>{esc(title)}</td><td>{esc(detail)}</td></tr>")
body.append("</table><h2>Results by functionality</h2><table><tr><th>Id</th><th>Pass</th><th>Fail</th><th>Untested</th></tr>")
for func, rows in by_func.items():
    body.append("<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>".format(
        esc(func),
        sum(1 for row in rows if row["status"] == "PASS"),
        sum(1 for row in rows if row["status"] == "FAIL"),
        sum(1 for row in rows if row["status"] == "UNTESTED"),
    ))
body.append("</table><h2>Coverage against the inventory</h2>")
body.append("<p>Planned counts are the inventory column. About 340 was the rounded P0+P1 figure. The column sums to 483. A lower executed count is explained here and is not a silent pass.</p>")
body.append("<table><tr><th>Id</th><th>Priority</th><th>Planned</th><th>Executed</th><th>Why it is lower</th></tr>")
for func, plan in planned.items():
    rows = by_func.get(func, [])
    if len(rows) >= plan:
        continue
    body.append("<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>".format(
        esc(func), esc(priority_of.get(func, "P0")), plan, len(rows), esc(reasons.get(func, "")),
    ))
body.append("</table><h2>Cases</h2>")
for row in results:
    klass = row["status"].lower()
    body.append(f"<h3>{esc(row['id'])} {esc(row['title'])} <span class='{klass}'>{esc(row['status'])}</span></h3>")
    body.append(f"<p><strong>Given</strong> {esc(row['given'])}<br><strong>When</strong> {esc(row['when'])}<br><strong>Then</strong> {esc(row['then'])}</p>")
    if row.get("detail"):
        body.append(f"<p>{esc(row['detail'])}</p>")
body.append("</body></html>")
(root / "test-plan.html").write_text("".join(body))
print("wrote", summary)
