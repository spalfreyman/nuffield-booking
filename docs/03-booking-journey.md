# Booking journey – replicated from the Bupa booking tool

Source: 17 screenshots in `journey/` (captured 19 Nov 2026). Not captured: the step‑3 date picker as its own screen, the step‑6 Confirm screen, any insurance/business/GP‑subscription branch, error/expired‑hold states. Those are marked **(inferred)**.

## 0. Entry – service landing page
Hero card (H1 "Health assessments", one‑line promise, phone number, primary **Book a health assessment**, secondary outline **Compare assessments**). Below: "What's included" with tick list, repeat primary CTA, then a product/FAQ table. Persistent "Talk to us" chat bubble bottom‑right.
→ Nuffield: one landing page per service family (health assessments, physio, GP, scans…), each with the same two CTAs.

## 1. Choose your customer type  *(pre‑stepper, no progress bar)*
Three full‑width outlined cards (icon, title, one‑line description):
- Pay as you go customer – "You pay for each appointment yourself."
- GP subscriptions – existing/new subscriber, over 18s only.
- Business customer – "Your health benefits are paid for by your employer."

**Nuffield mapping (4 audiences):**

| Card | Description | Customer group |
|---|---|---|
| Self‑pay | You pay for each appointment yourself | none (public price) |
| Medical insurance | Your insurer funds your appointment | `cg-insurance` |
| Nuffield Health gym member | Member discount applies | `cg-gym-member` |
| Business customer | Paid for by your employer | `cg-business` |

Selection sets the cart's customer group, so every later price is audience‑correct.

## Stepper (steps 1–6, progress bar under header)
`1. Product · 2. Location · 3. Date · 4. Appointment · 5. Personal Details · 6. Confirm`
Current step is blue; progress bar fills at each step (≈ 1/6, 1/3, …). "‹ Back" link above the H1 on every step. Sticky bottom bar on steps after product: **What you have selected … £price** with a "…" expander. Minimal chrome: logo, "Help and support" only.

## Step 1 – Product (three sub‑screens)

### 1a. Pick an appointment type
Stacked outlined cards (icon, title, description). Bupa list → Nuffield equivalent:

| Bupa | Nuffield |
|---|---|
| Health assessments | Health assessments |
| GP appointments (face‑to‑face & remote; under‑18s phone) | Private GP |
| Cancer screening | Tests & scans → cancer/diagnostic screening |
| Sexual health services | Private GP → sexual health (STI screening) |
| Muscle, bone and joints | Physiotherapy |
| Specialised treatments (earwax, period/menopause plan, weight plan, contraception) | Specialised clinics (microsuction earwax, menopause, weight management, contraception, dietician) |
| DNA testing | (omit v1) |
| Mental health and wellbeing | Mental health support |
| – | **Consultant consultation / hospital treatments** |
| – | **Gym tour & membership** |
Footer carries legal entity / regulatory small print and a "Having problems booking? Report a technical issue" button.

### 1b. Choose a format
Title "Choose a format"; collapsible **How do remote appointments work?**; two cards: **In person** ("face‑to‑face at a clinic") and **Remote** ("telephone or video call"). Format filters the product list and the location step (remote skips location).

### 1c. Choose an appointment (product cards)
Info banner: "We now offer 0% finance on products over £250… **Apply now**" (Nuffield: Chrysalis 0% over 6/12 months).
Card anatomy: coloured **badge** (Essential / Popular / In‑depth / 65+, none for others) · name · **More information (i)** link · **price + duration** (bold, e.g. `£289.00 60 minutes`) · one‑line description · full‑width outline **Select**.
Bupa examples for reference: Be.Motivated £289/60m, Be.Reassured £929/120m, Be.Ahead £1,199/180m, Mature health £1,009/120m, Coronary Health Check £1,264/60m.
Nuffield: 360+ (In‑depth), 360 (Popular), Lifestyle (Essential), Female, plus age/cardio variants later. Price shown = price for the audience chosen in step 0 (strike‑through of public price for gym/business is an optional enhancement).

### 1d. Optional "Enter your details" (callback capture)
Inline after product select: *Your full name*, *Your telephone number*, copy "We will only use your details to contact you in relation to this enquiry. Your details will be handled in accordance with the privacy policy." Buttons **Continue** (primary) and **Skip** (outline). Purpose: abandoned‑journey lead capture. → write a lead record, not an order.

## Step 2 – Location
H1 "Choose a location". Single field, label **Location**, helper "Enter a city, postcode or Health Centre and select from the list". Typeahead dropdown headed "Locations" with pin icon rows (`London EC2R 7DA, UK`). Validation banner (amber, ⚠) "Enter a city, postcode or Health Centre and select from the list" when free text isn't selected. **Continue ›**.
→ Typeahead over: geocoded postcodes/cities **and** our channels by name. Needs a geocoder (postcodes.io for mock) + channel geo.

## Step 3 – Date
Not captured as a screen. Evidence: summary banner on step 4 reads `<Category> - <Product>, <Weekday Dth Month>, <Location>` with **Edit**, so a date is chosen (default today) before step 4. **(inferred)** simple date picker defaulting to today, "Continue".

## Step 4 – Appointment (the key screen)
Layout: two columns on desktop — results left, **map right** (numbered pins matching clinic numbers); stacked on mobile.
- Summary banner (light blue) with **Edit**.
- H2 "We've got **8** health clinics near you", link‑styled subtitle "Pick a day and time at the clinic that suits you".
- Info callout: "We're showing you the next available appointments at each clinic."
- Filter pills with chevrons: **Sort by · Dr. preference · Distance · Date**.
- Horizontal **carousel of mini cards**: `① Basinghall (0 mi)` / "First available appointment: **Saturday 16th January**" / **Select**; skeleton "Loading appointments…" while fetching.
- Below, **clinic result cards**: number badge, distance chip (`0.1 mi`), clinic name (H3), address, then a **date strip** (`Sat Jan 16 | Sat Jan 23 | Mon Jan 25 …` with `›` paging; red underline = has availability, selected date has blue outline), then "Available slots on 16th January 2027" and the time buttons (cut off in screenshot **(inferred)** grid of `HH:MM` buttons).
- Chosen slot ends up in the summary as e.g. "16:00 on 5th January 2027".
→ Calls: `availability?sku&from&to` per channel within radius; "first available" = min(startsAt) per channel.

## Step 5 – Personal details (+ payment on same page)
Two‑column: left accordion form, right **summary** card.
Left, accordion "**1. Your personal details**": Title (select) · First name · Last name · Date of birth (DD/MM/YYYY with calendar icon) · **Sex at birth†** (radio cards Male/Female) · Postcode + **Enter address manually** link · Address (dropdown from postcode lookup) · Email · Confirm email · Phone · **Continue**. Below: privacy/marketing opt‑out copy, "† helps us interpret tests… a question on gender identity follows after booking", inclusivity line.
Right: card **What you have selected** (You have chosen: `<Category> - <Product>` / `<time> on <date>` / **More information ›**), accordions **What if you need to cancel your appointment?** and **What to know before your appointment**, and "check our FAQs" link.

Accordion "**2. Your payment details**" opens after Continue:
- Explainer box **"Why do we need your card details?"** – "You won't be charged now, but we store card details as you may still be charged if you don't attend. **Full payment is taken on the day of your appointment.**"
- **Billing address** (defaults to personal address) + outline **Update billing address**.
- **Total £289.00**
- 3‑D Secure / scheme badges (Amex SafeKey, Mastercard ID Check, Verified by Visa, Maestro) + "SECURE SSL encryption".
- Hosted card form "Your card details": Name · Card · Expiry (MMYY) · CVC (?) · green **Confirm card details**.
- Total repeated, **Booking** T&Cs line "By confirming your appointment you confirm you have read and agree…".

## Step 6 – Confirm  **(inferred)**
Confirmation page: reference number, summary (product, date/time, clinic address + map link), add‑to‑calendar (.ics), prep instructions ("What to know before your appointment"), manage/cancel link, confirmation email, next‑day pre‑assessment questionnaire email. Free cancel/change ≥72h, £75 fee inside 72h (Bupa, from search results; Nuffield rule configurable per product).

## Key design decisions this implies

1. **Card‑on‑file, pay on the day.** Booking creates an order with `paymentState: Pending`; a SetupIntent/tokenised card is stored; capture happens at attendance (or no‑show/late‑cancel fee). Gym/insurance/business variants replace the card step (see below). Finance (0%) is a separate application link, not in checkout.
2. **Product before location before date**, with price fixed at step 1 and carried in a sticky bar.
3. **Date step is global, availability is per clinic** — slots fetched for all clinics in radius, shown as "next available" then drill‑down date strips.
4. **Lead capture** at step 1 with Skip.
5. Details and payment live on one page as two accordions.

## Nuffield audience variants of step 5 (our additions)

| Audience | Extra fields (step 5) | Payment accordion |
|---|---|---|
| Self‑pay | – | Card on file, pay on day (as Bupa) |
| Insurance | Insurer (select), policy/membership no., authorisation code (optional – "we'll chase if you don't have one"), excess note | No card required if authorised; card on file for excess/no‑show |
| Gym member | Membership number (verify) | Card on file at member price |
| Business | Company name/code, employee email domain check | No payment – invoiced to employer; optional card for no‑show |

## Build mapping (screen → API)

| Step | commercetools | Calendar (mock) |
|---|---|---|
| 0 audience | create cart, set `customerGroup` + `custom.audience` | – |
| 1 product | product projection search by category, price by group | – |
| 2 location | channels (geo), inventory by sku | – |
| 3–4 appointment | – | `GET availability` per channel |
| select slot | add line item (sku, `supplyChannel`), line custom `slotId` | `POST holds` (TTL) |
| 5 details | set shipping/billing address, customer fields | – |
| 5 payment | payment object (SetupIntent/token) | – |
| 6 confirm | create order from cart | `POST bookings` (confirm hold) |

## Component inventory for the storefront
`AudiencePicker`, `Stepper`, `StickySummaryBar`, `ChoiceCard`, `ProductCard(badge)`, `FinanceBanner`, `LeadCapture`, `LocationTypeahead`, `ClinicCarousel`, `ClinicResultCard`, `DateStrip`, `SlotGrid`, `ClinicMap`, `FilterPills`, `AccordionSection`, `PersonalDetailsForm`, `AddressLookup`, `PaymentCardForm (hosted fields)`, `BookingConfirmation`.

Visual language to copy: single‑column narrow (≈640px) cards with 2px blue outline and rounded corners, large light H1 centred, thin top stepper, full‑width primary buttons, soft grey/blue info panels. Use Nuffield Health brand colours/typography instead of Bupa blue.
