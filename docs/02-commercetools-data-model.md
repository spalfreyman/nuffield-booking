# commercetools data model

## Principles
- **commercetools holds catalogue, price, location, and the booking as an Order.** The calendar/slot engine is a separate service (mocked now). CT never stores individual time slots.
- Everything keyed (`key`) for idempotent import via the Import API / seed script.

## Locations → Channels
One Channel per point of service.
- `key`: `loc-<slug>` e.g. `loc-hospital-oxford`, `loc-gym-moorgate`
- `roles`: `["InventorySupply","ProductDistribution"]`
- `name` / `address` / `geoLocation` (lat/lng)
- Custom type `nh-location`: `locationType` (hospital | gym | medical-centre | physio-clinic | diagnostic-suite), `timezone`, `openingHours` (JSON), `phone`, `calendarResourceId` (id in calendar service), `region` (London | Outside London – drives physio pricing), `url`.
- Optional: a Store per audience (see pricing) with `distributionChannels` = relevant locations.

## Service availability per location → Inventory
`InventoryEntry` (sku + supplyChannel). Meaning: "this location offers this service". `quantityOnStock` = weekly capacity ceiling (coarse, for MC overview); real slots live in the calendar service. Custom type `nh-inventory`: `defaultDurationMins`, `clinicianType`. Product `masterVariant.availability.channels` then answers "where can I book this".

## Product types

| ProductType key | Used for | Key attributes |
|---|---|---|
| `nh-health-assessment` | 360+, 360, Lifestyle, Female | durationMins, includes (set), resultsDays, gymPassDays, financeAvailable |
| `nh-physio` | Initial / follow-up, online or in person | appointmentType, mode, durationMins |
| `nh-gp` | Standard 20 min, extended, medical (HGV…) | durationMins, exclusions |
| `nh-diagnostic` | MRI, CT, X-ray, blood, ultrasound, ECG | modality, bodyArea, prepNotes, requiresReferral |
| `nh-consultation` | Initial consultant consultation per specialty | specialty, consultantRequired |
| `nh-treatment` | ~480 treatments (info only; price on enquiry) | specialty, overview, recoveryNotes, relatedConsultSku, sourceUrl |
| `nh-gym-membership` | Tiers (single club / 53 / 95 / 105+) | gymAccessTier, termMonths, discountEligibility |
| `nh-gym-service` | PT, swim lessons, squash, tour | durationMins |

All bookable types share: `bookable` (bool), `bookingMode` (`slot` | `enquiry` | `purchase`), `slotDurationMins`, `leadTimeHours`, `cancellationHours`, `cancellationFeeCent`.

## Categories
```
Health assessments
Physiotherapy
Private GP
Tests & scans  > Imaging | Blood & fluids | Diagnostic procedures | Lifestyle & fitness
Consultations
Hospital treatments > <16 specialties>
Gyms > Memberships | Classes & services
```

## Pricing: public, insurance, gym, business
Embedded prices on each variant, scoped by customer group (and channel where location pricing differs, e.g. London physio).

| Audience | Customer group key | Mechanism |
|---|---|---|
| Public (self-pay) | none (default price) | Base price; London/outside via `channel` price |
| Insurance | `cg-insurance` (+ sub-groups `cg-ins-bupa`, `-axa`, `-aviva`, `-vitality`) | Price = agreed tariff, or £0 patient-pay with excess captured on order. Insurer + membership number + authorisation code as cart custom fields |
| Gym member | `cg-gym-member` | Fixed discount price (physio −20%); membership id verified at checkout |
| Business | `cg-business` (or Business Units for B2B) | Corporate rate; company code on cart; invoice payment |

Price precedence: customerGroup+channel → customerGroup → channel → base. Gym/business discounts also expressible as Cart Discounts, but explicit prices are chosen so MC users can audit per-audience price in one place and for `treatment` consult prices.
Customer group is resolved at the start of the journey (audience picker, see doc 03) and set on the cart (`customerGroup`) so price selection is server-side.

## Booking = Cart / Order
- Cart line item: sku, `distributionChannel`/`supplyChannel` = location, custom type `nh-booking-line`: `slotId`, `startsAt`, `endsAt`, `holdId`, `holdExpiresAt`, `clinicianId`, `patient` (name, dob, sex, phone), `consentFlags`.
- Cart custom type `nh-booking-cart`: `audience`, `insurer`, `membershipNumber`, `authCode`, `companyCode`.
- Order custom type adds `calendarBookingId`, `status` (confirmed | cancelled | attended | no-show). Order states for lifecycle. Cancellation fee within 72h-style window is configurable per product.
- Flow (per Bupa journey, see doc 03): audience → product → location → date → slots → **hold** (calendar, TTL) → add to cart → details → **card on file** (no charge now) → order created → **confirm** hold (Subscription/API Extension on order create). Extension rejects order if hold expired.
- Payment: Bupa takes full payment **on the day**. Model as a Payment with a stored/tokenised card (SetupIntent), order `paymentState: Pending`; capture at attendance, or no-show / late-cancel fee (e.g. £75 inside 72h, configurable). Insurance/business orders may have no payment (invoice or insurer authorisation); fields on the cart: `insurer`, `policyNumber`, `authCode`, `companyCode`.
- Lead capture (optional name + phone at step 1, "Skip") → Custom Object container `nh-leads`, not an order.
- Patient fields on cart custom type: title, dob, sexAtBirth, phone, marketingOptOut; address via cart billing/shipping address.
- Booking format `in-person | remote` is a product attribute / variant; remote products skip the location step.

## Calendar service contract (mock → real)
```
GET  /locations/{key}/availability?sku=&from=&to=      -> [{slotId,startsAt,endsAt,clinicianId,remaining}]
POST /holds {slotId, ttl}                              -> {holdId, expiresAt}
POST /bookings {holdId, orderId}                       -> {bookingId}
DELETE /bookings/{id}
GET  /locations/{key}/calendar?from=&to=               -> day/week grid for MC app
```

## Merchant Center Custom Application
"Availability & Calendars" (`@commercetools-frontend/application-shell`, Custom Views optional later).
- Location picker (list + map of channels) with type/region filters.
- Calendar views: day / week, rows = clinicians or rooms, colour = utilisation (free, held, booked, blocked).
- Heatmap: locations × next 14 days utilisation for a chosen service.
- Slot drawer: booking → links to CT Order.
- Service-by-location matrix (inventory entries) with toggle to enable/disable a service at a location.
- Price audit tab: product × audience price grid.
- Permissions: `view/manage` on products, inventory, channels, orders.

## Seed files (this repo)
- `data/locations.json` – 37 hospital channels (+ gym/medical-centre crawl to come)
- `data/customer-groups.json`, `data/product-types.json`, `data/categories.json`
- `data/products-services.json` – assessments, physio, GP, diagnostics, consults, gym memberships with 4-audience prices
- `data/treatments.json` – generated by `scripts/build-treatments.mjs`
