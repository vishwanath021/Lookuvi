# Owner screen

One page, `/admin/customers`, in the main menu when the queue product is on. English. Same purple metal buttons as the rest of the salon desk. The page grows with the window. It does not add its own scrollbar.

The page title is "Customers". Under it, one sentence: a number is saved when the desk types a phone or someone joins from home, and a visit is counted when the desk marks them done.

## This month

Four figures in a card, in this order:

- Reminders sent
- Offers sent
- WhatsApp used, written as `12 of 50`
- Came back from a reminder link

Under the figures, one sentence for the pilot metric. Example: `8 of 20 people reminded in the last 90 days joined again from the link (40%). The pilot target is 20%.` Ninety days covers a 6-week interval plus time to come back in. When nobody has been reminded, the sentence is `No reminders in the last 90 days yet. The pilot target is 20% of reminded people joining again from the link.`

If try-on is on, one more sentence: `18 of 30 included try-ons used this month.` The allowance itself is edited under Settings, next to the daily preview caps, labelled "Included try-ons per month". The daily field that already exists is labelled "Tries per signed-in customer per day".

If the server has no WhatsApp token, a sentence says WhatsApp is not connected, so reminders and offers are waiting and the monthly limit is not used. Queue tokens on screen are unchanged.

The salon's join-from-home link and try-on link are shown as plain text so the owner can copy them into a chat.

## Reminder settings

Owner only. Staff do not see the form. They see `The owner sets reminders and offers.`

- Reminders on or off. Default on.
- Days after the last visit. Whole number from 28 to 42. Default 35.
- WhatsApp reminders and offers this month. Whole number from 0 to 5000. Default 50. Zero means send none.

The save button is "Save reminder settings". It is a normal button. A result sentence appears under it.

A note under the fields: people with a last visit older than this interval are reminded on the next check, up to the monthly limit. Live queue messages are not counted in the limit.

## Send an offer

Owner only. A short text box (180 characters) and a button labelled "Send offer". The button is not greyed out when WhatsApp is off or the cap is used. The result sentence says what happened:

- WhatsApp is not connected, so nothing was sent.
- The monthly limit is used, so nothing new was sent.
- Sent to N people. M were not sent because the monthly limit was reached.
- The template is missing, so nothing was sent.

## Add a number

Phone, optional name, button "Add number". A bad phone leaves the sentence `Enter a 10-digit Indian mobile number.`

Import box, one person per line, button "Save numbers". Accepted shapes:

- `9876543210`
- `9876543210, Asha`
- `Asha, 9876543210, 2026-09-01`

The result sentence says how many were saved, how many lines were not Indian mobiles, and how many dates were ignored. More than 500 lines is refused with no partial save.

A date sets the last visit only when that salon has no later visit already. Those people become eligible for a reminder once the interval has passed. Staff and the owner can both import.

## Saved numbers

Search box matches a name or any digits in the phone. The list shows up to 100 rows. If the search is empty and there are more, the sentence says to search to narrow.

Each row: name or "No name", the 10-digit phone, visit count, last visit date or "No visit yet", and the reminder state.

- Active: button "Stop reminders".
- Stopped at the desk: the owner sees "Turn reminders on". Staff see the words "Stopped at the desk" and no button.
- Replied STOP: the words "Replied STOP" and no button. There is no control that looks switched off.

## Desk

The queue desk is unchanged except two additions.

- The WhatsApp link the desk opens already contains the join-from-home line and the try-on line.
- A confirmed time request has a "Mark visited" button. That is what counts the visit in request mode. Live mode still uses Done.

## Guest

The join-from-home page is the existing `/s/{slug}/queue` page. A reminder opens it with `?r=` on the link. The guest does not see a new screen. Joining still asks for a name, a mobile, and the consent tick.

Under the tick, an English line: `This salon may send one WhatsApp reminder after your visit. Reply STOP to opt out.` The tick itself stays in the salon's language. The desk's own WhatsApp button opens a chat on the staff phone. That chat is not counted in the monthly limit.
