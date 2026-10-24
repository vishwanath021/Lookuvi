# Lookuvi

Lookuvi is the try-on and token queue for a family salon. A guest does not make an account. The owner and the staff use a phone. The three founders use the super-admin screens.

This guide matches the screens on master `4e0b8e514a85b211e84d385d759ff204c3b91428`. Money, a live AI key, and a WhatsApp handset are not connected in this copy. The screens still show what the salon will see.

## Plans

| Plan | Monthly | Try-ons included | Annual |
| --- | --- | --- | --- |
| Basic | ₹799 | 50 | ₹7,990 |
| Standard | ₹1,499 | 120 | ₹14,990 |
| Pro | ₹2,499 | 220 | ₹24,990 |

Annual is ten times the monthly price. A new salon starts on a 14-day trial with 20 try-ons, on the Basic allowance for the cap. Choosing a plan does not turn it on for free. The owner sees a UPI QR and the words Payment pending. A founder marks the UPI reference paid. That activates the plan, adds the try-ons, and creates a receipt. The receipt is not a tax invoice. GST is off until Lookuvi has a GSTIN.

Try-on packs, also pending until marked paid: 25 for ₹299, 60 for ₹649, 150 for ₹1,499.

One try-on is one credit. With no AI key saved, guests see a sample image and the try-on count does not move. The salons table says: No AI key is saved. Customers see sample images.

## What a guest does

Open the salon link. Take or upload a photo, agree to the photo notice, and pick a style. The result appears on the same screen. If bridal or groom is on for that salon, those sections are tabs. If the salon's language is Hindi, the buttons are in Hindi.

Join the queue with a name, a mobile number, and consent. The consent line says the salon may send one WhatsApp reminder and that STOP opts out. The ticket shows the token. The desk shows the same token. Next, Start, and Done on the desk show up on the ticket: Your turn, You are being served, This visit is finished. A no-show says the token was marked as a no-show. If the desk pauses the line, the guest sees that the queue is paused and cannot join.

A salon in request mode asks for a date and a time. Staff confirm it on the desk.

A suspended salon says the salon is paused. An expired trial says the trial ended. The owner can still sign in.

## What the owner sees on a phone

The menu has Queue, Customers, Leads, and QR. More has Prices, Settings, Team, Billing, and Security. Styles is not an owner menu. Density and texture are platform data on the super-admin Styles page.

Prices is one row per service: name, a small rupee field, an on/off switch, and delete behind the ⋯ menu. Bridal packages appear only when bridal is on. They are off for a new salon. When bridal and groom are both off, the visit-code list is hidden. When either is on, Recent visits comes first and the visit code is under it.

Customers shows four numbers: reminders, offers, WhatsApp used, and came back. Until WhatsApp is connected, one line says reminders are paused. Add a customer with a phone and a name. A CSV file can be uploaded from the same card. A STOP reply shows as Replied STOP. Staff cannot turn that back on.

QR, on a local address, does not print a code. It says to add the public website address first.

Billing lists Basic, Standard, and Pro, an annual switch, and the packs. Choose and a pack both stop at Payment pending, with the UPI QR. After a founder marks a payment, the receipt number is on this page and Download saves the PDF.

Settings holds the salon name, bridal, groom, and Save. GSTIN is hidden while GST is off. Staff who open Settings or Prices are told they cannot change them. Staff who open Billing are told only the owner can change the plan.

## What the founders see

The salons table has the link, plan, status, try-ons left, try-ons this month, trial end, and created date. Filters cover plan, status (including expired), trial ending within 7 days, and low try-ons left (10 or fewer).

Change plan does not add try-ons. Mark paid does, and it writes the receipt. Adjust try-ons changes the number on the owner phone and on this table together.

AI settings are two rows, OpenAI and fal, each with a masked saved state, Save, and Test. One row is marked In use. The price list is the source for cost maths. Spend and costs shows month spend, images, and average rupees per image, then a per-salon table. The image log is a separate link.

A production super-admin sign-in asks for the authenticator code before the platform opens.

## What still needs a real phone, real money, or a decision

- Paying from a UPI app. The placeholder ID is lookuvi@upi until a real ID is set.
- A WhatsApp message arriving on a handset. The product is ready to record STOP and to show the paused-reminders banner.
- A paid AI image, which spends one try-on. Samples do not.
- A printed QR on the public domain, then a camera scan.
- A tax invoice, after GSTIN and the GST switch.

Lead export is on Standard and Pro. Basic shows that sentence instead of the download.
