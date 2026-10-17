# Health-e Africa — Architecture & Build Map

Status: **planning** — no code yet. This document maps the product, the
system, the data, and the build order before we write anything.

---

## 1. What the product is

A patient-owned **health passport**. Users keep their records in one place and
use them to get care:

1. **Store**: upload clinic letters, radiology reports, blood results and
   prescriptions, and view them quickly.
2. **Share**: package records and share them with facilities chosen by
   insurance plan, distance and speciality. Sharing is consent-based, expires,
   and is audited.
3. **Book**: request appointments, with the summary shared automatically.
4. **Receive**: facilities upload reports and results back into the patient's
   record.
5. **Medicines**: request acute or repeat prescriptions from a nominated
   pharmacy, which processes and delivers them.
6. **Remind**: send push reminders for chronic-condition reviews, medication
   reviews, immunisations and national screening, based on country, age and sex.

### Who uses it

| Actor | What they do | In the current feature list? |
|---|---|---|
| **Patient** | Owns records, shares, books, requests medicines | ✅ Yes |
| **Facility staff** (clinic, hospital, lab) | View shared summaries, confirm or decline appointments, upload results | ❌ **Missing** |
| **Pharmacy staff** | Receive requests, check prescriber authorisation, dispense, deliver | ❌ **Missing** |
| **Prescriber** (doctor or nurse) | Authorise repeat and acute medicines | ❌ **Missing** |
| **Platform admin** | Verify facilities, manage reminder rules, handle support | ❌ **Missing** |
| **Carer / guardian** | Manage a child's or elderly parent's records | ❌ **Missing** (worth adding) |

> **Main gap:** the breakdown covers the patient app only. Booking, results
> coming back, and prescriptions all need someone on the other side. They need
> at least a simple **Partner Portal** (web) for facilities and pharmacies.
> See §4.

---

## 2. Recommended technology

Chosen for a small team, fast iteration, low-bandwidth Android-heavy
markets, and health-data compliance.

| Layer | Choice | Why |
|---|---|---|
| Patient app | **React + TypeScript + Vite**, Tailwind, shadcn/ui, installable **PWA** | Matches the component list (sheets, toasts, dialogs). One codebase for web and mobile. |
| Native wrapper (later) | **Capacitor** | Adds reliable push, camera and biometrics, and app-store presence, without a rewrite. |
| Partner Portal | Same React stack, separate app in the same repo | Shares types, UI kit and API client. |
| Backend | **Supabase**: Postgres, Auth, Storage, Edge Functions, Row-Level Security | Managed, and access rules live in the database. Can be self-hosted later for data residency. |
| Server state | TanStack Query | Caching, retries, offline-friendly. |
| Forms / validation | react-hook-form + **zod** (schemas shared with the backend) | One source of truth for validation. |
| Push notifications | Web Push (PWA), then FCM/APNs via Capacitor | |
| SMS / WhatsApp fallback | Africa's Talking or Twilio | Many users have patchy data or turn notifications off. |
| Document text extraction | OCR plus LLM extraction, **always reviewed by the user** before saving | Powers "import lab results" from a photo or PDF. |
| Maps / distance | PostGIS in Postgres, with a map tile provider | Distance filtering in SQL. |
| Payments (later) | Mobile money (M-Pesa, MTN MoMo), Flutterwave or Paystack | For delivery fees and co-pays. |
| Health data standard | Map internal tables to **FHIR R4** at the edges | Needed to exchange data with hospitals and labs later. |

### Repository layout (monorepo)

```
apps/
  patient/          # PWA — Home, Health, Care, More
  partner/          # Facility + pharmacy portal
packages/
  ui/               # shared shadcn components, theme
  domain/           # zod schemas, types, business rules (reminder engine, allergy checks)
  api/              # typed Supabase client + query hooks
supabase/
  migrations/       # SQL schema + RLS policies
  functions/        # edge functions (sharing, notifications, OCR, reminder generation)
  seed/             # demo facilities, reminder rules per country
docs/
```

---

## 3. System overview

```
 ┌──────────────┐        ┌──────────────────┐
 │ Patient PWA  │        │ Partner Portal   │
 │ (Capacitor)  │        │ facility/pharmacy│
 └──────┬───────┘        └────────┬─────────┘
        │  HTTPS (JWT)            │
        ▼                         ▼
 ┌─────────────────────────────────────────────┐
 │ Supabase                                    │
 │  Auth ─ Postgres (+RLS, PostGIS) ─ Storage  │
 │  Edge Functions:                            │
 │   • create-share / resolve-share            │
 │   • booking-workflow                        │
 │   • prescription-workflow                   │
 │   • extract-document (OCR/LLM)              │
 │   • reminder-scheduler (cron)               │
 │   • notify (push / SMS / email)             │
 └──────────┬──────────────────────┬───────────┘
            │                      │
     ┌──────▼──────┐        ┌──────▼──────────┐
     │ Push / SMS  │        │ OCR / LLM API   │
     │ providers   │        │ (no data kept)  │
     └─────────────┘        └─────────────────┘
```

---

## 4. Feature map

### Patient app (your breakdown, with additions marked ➕)

**Home**: dashboard, snapshot cards, quick links, reminders preview,
donor status, profile-completeness prompt.

**Health**
- *Medical Summary*: identity, blood group, donor, emergency contact,
  medications, diagnoses, allergies, recent labs, immunisations. Sharing flow:
  choose summary type → consent → expiring link → audit trail.
- *Records*: upload (camera, PDF, gallery) and browse.
  ➕ categories (letter, radiology, lab, prescription, other), date, source
  facility, search, and **"Received from facility"** badge for returned results.
- *Results (Labs)*: panels, table and graph views, import and review.
  ➕ reference ranges and out-of-range flags.
- *Immunisations*: history, due/overdue, dose series, batch, add/edit.

**Care**
- *Find Care*: directory, filters (location, service, insurance, rating),
  details, share summary, request appointment.
  ➕ "accepts my insurance" uses the plan saved in My Bio. ➕ verified badge.

**More**
- *My Appointments*: list, filters, cancel, confirmed → calendar.
- *Prescriptions*: repeat list, acute request, review dates, history,
  allergy-conflict warnings.
  ➕ **nominated pharmacy**, delivery address, delivery status tracking.
- *Calendar*: month/agenda, CRUD events, preventive-care reminder generation.
- *My Bio*: personal, location, emergency contact, health profile.
  ➕ insurance plan(s), ➕ dependants.
- *Settings*: notification toggles, privacy, account, logout.
  ➕ MFA / biometric lock, ➕ data export, ➕ delete account.
- *Notifications*: list, read state, deep links.

### Partner Portal (new)

| Screen | Facility | Pharmacy |
|---|---|---|
| Inbox of incoming requests | Appointment requests | Prescription requests |
| View shared summary (time-limited, logged) | ✅ | ✅ (medicines + allergies only) |
| Accept / propose new time / decline | ✅ | — |
| Upload result or report to patient | ✅ | — |
| Check prescriber authorisation, dispense, mark dispatched or delivered | — | ✅ |
| Staff accounts and roles | ✅ | ✅ |
| Facility profile (services, insurers, hours, location) | ✅ | ✅ |

### Admin (minimal, can start as Supabase dashboard + SQL)
Facility verification, reminder rule tables per country, support tools,
audit log viewer.

---

## 5. Core workflows

### 5.1 Share medical summary
1. Patient picks scope (full, medicines + allergies, specific records) and
   recipient (facility or one-off link).
2. Consent screen states who, what and for how long.
3. A `summary_share` row is created with a random token, scope and `expires_at`.
4. Recipient opens the link or portal → edge function checks token, expiry and
   revocation → returns **only the scoped data** → writes `share_access_log`.
5. Patient can see every access and revoke at any time.

### 5.2 Appointment booking
```
patient requests → PENDING → facility accepts → CONFIRMED → (visit) → COMPLETED
                         ↘ facility proposes time → patient accepts → CONFIRMED
                         ↘ DECLINED
patient may cancel while PENDING or CONFIRMED → CANCELLED
```
- Request automatically creates a share scoped to that facility that expires
  N days after the appointment.
- CONFIRMED → calendar event + reminders (24 h and 2 h before).
- If the facility has no portal account yet: send the request by email or
  WhatsApp with a secure link (lets us launch before facilities sign up).

### 5.3 Results returned
Facility uploads a file or structured result against the appointment →
stored as a `record` (and `lab_results` if structured) with
`source = facility` → patient notified → appears in Records/Results with a
"received" badge.

### 5.4 Prescription request
```
patient selects repeat items (or describes acute need)
  → allergy/interaction check (client + server)
  → SUBMITTED to nominated pharmacy
  → pharmacy checks authorisation ──(needs prescriber)──→ AWAITING_PRESCRIBER
  → APPROVED → DISPENSED → OUT_FOR_DELIVERY → DELIVERED
                         ↘ REJECTED (reason shown to patient)
```
> ⚠️ **Regulatory:** in most African jurisdictions a pharmacist cannot issue
> prescription-only medicines without a valid prescription. Repeat requests
> need a prescriber in the loop, or a valid existing prescription on file.
> Acute requests will often need a consultation. **Confirm per launch country
> before building this flow.**

### 5.5 Preventive-care reminders
- `reminder_rules` table per country: condition / age range / sex / interval
  (for example: cervical screening, women 25–49, every 3 years; HbA1c for
  diabetes, every 6 months; national EPI schedule for children).
- A daily scheduled job evaluates each user's profile against the rules and
  creates `calendar_events` + `notifications` (deduplicated).
- Rules are **data, not code**, so clinicians can review and update them.

---

## 6. Data model (first pass)

All patient-owned tables have `user_id` and RLS: *the owner can read and write;
others only through an active share or a linked appointment or prescription*.

**Identity & profile**
- `profiles`: name, dob, sex, country, region, phone, location (PostGIS),
  blood_group, donor_status, emergency_contact_*.
- `dependants`: guardian_user_id, dependant_profile_id, relationship.
- `insurance_plans`: user_id, provider, plan_name, member_number.

**Clinical**
- `diagnoses`: name, code (ICD-10, optional), status, onset_date, chronic flag.
- `allergies`: substance, reaction, severity, status.
- `medications`: name, dose, frequency, type (repeat/acute), start/end,
  review_date, prescriber.
- `immunisations`: vaccine, dose_number, series_total, date, batch,
  administered_by, status (given/due/scheduled/overdue), notes.
- `records`: category, title, date, file_path (Storage), source (patient or
  facility), facility_id, extracted_text.
- `lab_panels`: name, date, facility_id, record_id.
- `lab_results`: panel_id, analyte, value, unit, ref_low, ref_high, flag.

**Care network**
- `facilities`: type (clinic/hospital/lab/pharmacy), name, services[],
  location, address, contact, hours, rating, verified.
- `facility_insurers`: facility_id, insurer.
- `facility_staff`: facility_id, user_id, role.

**Workflows**
- `appointments`: user_id, facility_id, requested_at, slot, reason, status,
  share_id.
- `medication_requests`: user_id, pharmacy_id, items (jsonb), type, status,
  delivery_address, status_history.
- `summary_shares`: user_id, scope (jsonb), recipient (facility_id or email),
  token_hash, expires_at, revoked_at.
- `share_access_log`: share_id, accessed_by, accessed_at, ip, what was viewed.

**Engagement**
- `calendar_events`: user_id, type, title, start/end, source (manual,
  appointment, reminder_rule), rule_id.
- `notifications`: user_id, type, title, body, link, read_at.
- `notification_prefs`, `push_subscriptions`.
- `reminder_rules`: country, condition, sex, age_min, age_max, interval,
  message.

**Platform**
- `audit_log`: actor, action, entity, entity_id, at. Append-only. Covers
  every read of clinical data by anyone other than the owner.

---

## 7. Security, privacy & compliance

Health data is the most sensitive category under every relevant law.

- **Laws to plan for:** Nigeria NDPA 2023, Kenya Data Protection Act 2019
  (and Digital Health Act 2023), South Africa POPIA, Ghana Data Protection Act
  2012, Rwanda DPP Law 2021. Most require registration with the regulator,
  explicit consent for health data, breach notification, and some impose
  **data-localisation** rules. Choose the hosting region per launch country.
- **Access control:** Postgres RLS on every table. Partner staff see data only
  through an active share. No broad "doctor can see everything" role.
- **Encryption:** TLS everywhere; encrypted at rest; private Storage buckets
  with short-lived signed URLs; no PHI in push notification text (say
  "You have a new result" rather than the result itself).
- **Auth:** phone OTP plus email; optional MFA; biometric app lock in the
  native build; session timeout.
- **Consent & audit:** every share and every view is logged and visible to the
  patient.
- **Patient rights:** export all data (JSON + PDFs) and delete the account.
- **AI extraction:** process without storing data at the provider; the user
  confirms values before saving; never auto-diagnose.
- **Clinical safety:** allergy warnings and reminders are *decision support*.
  Show a disclaimer and have rules reviewed by a clinician.

---

## 8. Build order

Each phase produces something usable on its own.

| Phase | Scope | Needs partners? |
|---|---|---|
| **0. Foundation** | Monorepo, Supabase project, auth (phone/email), app shell, 4-tab nav, sheets, toasts, 404, design system, CI | No |
| **1. Health Passport (MVP)** | My Bio, Medical Summary (view), Diagnoses/Allergies/Medications CRUD, Records upload & browse, Labs (manual entry, table/graph), Immunisations, Home dashboard | No |
| **2. Share & Find Care** | Facility directory (seeded), filters incl. insurance & distance, summary sharing via expiring link, access log, revoke | No (link-based) |
| **3. Calendar & Reminders** | Calendar, notifications centre, push, reminder rules engine (1 launch country first) | No |
| **4. Appointments + Partner Portal v1** | Booking flow, facility inbox, accept/decline, results returned to patient | **Yes**: pilot clinics |
| **5. Prescriptions + Pharmacy Portal** | Repeat/acute requests, allergy checks, nominated pharmacy, dispensing & delivery status | **Yes**: pilot pharmacy + regulatory sign-off |
| **6. Smart import & hardening** | OCR/LLM lab import, Capacitor native apps, offline cache, SMS/WhatsApp, data export, security review / pen test | — |

Phases 1–3 deliver a useful app with **no partners**, so it can be built and
tested with real users while facilities and pharmacies are being signed up.

---

## 9. Decisions needed before building

1. **Launch country (or countries)?** This sets the compliance regime,
   hosting region, screening and vaccine rules, and the insurer list.
2. **Web/PWA first, or native app stores from day one?** (Recommended:
   PWA first, then wrap with Capacitor in Phase 6.)
3. **Backend: Supabase OK?** (Or do you need a specific cloud or region for
   data residency?)
4. **Is there an existing prototype** (for example from Lovable or Figma)
   whose code or designs we should start from? The feature breakdown reads
   like one.
5. **Partners:** are any clinics or pharmacies lined up for a pilot? This sets
   when Phases 4–5 can start.
6. **Prescriptions:** who authorises repeats in your launch market: the
   pharmacist, the patient's own doctor, or a telehealth prescriber you
   partner with?
7. **Dependants:** should one account manage family members' records at
   launch?
8. **Languages:** English only at first, or also French, Swahili, etc.?
