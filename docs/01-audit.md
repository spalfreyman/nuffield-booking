# Nuffield Health – site audit (19 Nov 2026)

Source: nuffieldhealth.com (nav, /treatments, /hospitals, /tests-scans, /health-assessments, /physiotherapy, /gyms/membership, /hospitals/private-gp-service).

## 1. Top-level offer

| Pillar | URL | Bookable today? | CT modelling |
|---|---|---|---|
| Hospitals (37) | /hospitals | Consultation via /consultants | Channels (`hospital`) |
| Treatments (~480, A–Z) | /treatments | Consultation first, price on enquiry | Catalogue products (`treatment`) + consult SKUs |
| Tests & scans | /tests-scans | MRI, X-ray, CT, blood | Bookable products (`diagnostic`) |
| Health assessments | /health-assessments | Phone only (03452 302 040) | Bookable products (`health-assessment`) |
| Physiotherapy | /physiotherapy | Online/phone, 100+ sites | Bookable products (`physio`) |
| Private GP | /hospitals/private-gp-service | Per clinic, ~40 clinics | Bookable products (`gp`) |
| Pathology Direct | /pathology-direct | Blood tests | Bookable (`diagnostic`) |
| Mental health | /advice-hubs/mental-health | Enquiry | Bookable (`mental-health`) |
| Gyms (110) | /gyms | Tour booking; membership | Channels (`gym`) + membership products |
| Gym services | /gyms/services | PT, swimming, squash, crèche | Bookable (`gym-service`) |
| Medical centres | /medical-centres | GP / assessments | Channels (`medical-centre`) |
| Nuffy Bear nursery | /nuffy-bear-day-nursery | Enquiry | Out of scope v1 |
| Corporate | /corporate-healthcare | Employer-funded | Business customer group |

## 2. Hospitals (37 points of service)
Bournemouth, Brentwood, Brighton, Bristol, Cambridge, Cardiff and Vale, Cheltenham, Chester, Chichester, Derby, Exeter, Glasgow, Guildford, Haywards Heath, Hereford, Ipswich, Leeds, Leicester, Manchester Diagnostic Suite, Manchester Institute of Health & Performance, Newcastle upon Tyne, North Staffordshire, Oxford, Plymouth, Shrewsbury, Taunton, Tees, Tunbridge Wells, Warwickshire, Wessex, Woking, Wolverhampton, York, Parkside, Highgate, Edinburgh, The Holly. Seeded in `data/locations.json`.
Gyms (~110), medical centres and physio sites: crawl `/gyms`, `/medical-centres`, `/physiotherapy` (script TODO, see roadmap).

## 3. Treatments
~480 treatments in a flat A–Z list (no categories on the site). We classify into specialties with `scripts/build-treatments.mjs` (keyword rules → `data/treatments.json`). Specialties: Orthopaedics, Spine, Cardiology & vascular, Cosmetic & reconstructive, Ophthalmology, ENT, Urology & prostate, Gynaecology & fertility, General surgery & hernia, Colorectal, Bariatric, Oncology, Dermatology, Pain management, Dental & maxillofacial, Therapies & other.
Treatments are **not directly bookable or priced** on site (price on enquiry / self-pay pricing page `/hospitals/pricing`). Model: informational product + bookable "Initial consultation" SKU.

## 4. Services with pricing evidence

| Service | Evidence |
|---|---|
| Health assessments | 360+, 360, Lifestyle, Female. No prices published. Includes doctor/physiologist time, same-day results, report in 2 weeks, free 30-day gym pass, referral. 0% finance over 6/12 months. |
| Physio | Initial £79 London / £72 elsewhere; follow-up £52 / £49. Gym members 20% off. Seen in 24h. Online or face-to-face. |
| Private GP | 20 min standard; fee per clinic, confirmed upfront. Add-ons: bloods, imaging referral, ECG, prescriptions. Mostly self-funded (insurers rarely cover GP). |
| Gym membership | £68–£163 pm by club, 12-month; tiers by number of gyms (53/95/105–109). Discounts: Vitality up to 50%, student 15%, over-65 15%, Blue Light 20%, family from £6/child, AXA Health, corporate. |
| Tests & scans | MRI, X-ray, CT, blood tests; filters: blood & fluids, diagnostic procedure, exploratory surgery, imaging & radiology, lifestyle & fitness. |

Payment: self-pay, medical insurance, personal medical loans, NHS patients (`/hospitals/paying-for-healthcare-treatment`).

## 5. Audit gaps (need confirming)
- Hospital/gym/clinic addresses, geo, opening hours, phone (crawl each location page).
- Health-assessment prices and durations (not on public page).
- Insurer tariffs (per insurer; Bupa, AXA Health, Aviva, Vitality, WPA, Cigna…).
- Bupa booking journey: bupa.co.uk returned HTTP 403 to automated fetch and is blocked in the in-app browser by org policy. See `03-booking-journey.md` for what was recoverable.
- All prices in seed data marked `"_placeholder": true` unless sourced above.
