# Health-e Africa

A patient-owned health passport for Kenya. Patients keep their records in one place, share them safely with clinics, book appointments, order medicines from their pharmacy, and get reminders for check-ups, screenings and vaccines.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full plan, data model, legal requirements and build order.

## Status: working demo (patient app)

The patient app works end to end in **demo mode**. All data is saved in the browser on the user's device (IndexedDB), and nothing is sent to a server. This follows the legal advice: no real patient data until ODPC registration, the DPIA and DHA certification are done.

| Area | What works |
|---|---|
| Sign-up | Profile, versioned consent record, "try with a sample patient" |
| Home | Health passport card, profile completeness, allergies, medicines, conditions, blood group, quick actions, upcoming events, latest updates |
| Medical summary | View and edit conditions, allergies and medicines (with allergy warnings); recent labs; immunisations |
| Sharing | Choose what to share, who with, and for how long → consent → link + QR code → what the clinic sees → access log → stop sharing |
| Records | Upload a photo or PDF, categories, search, "received from clinic" badge |
| Results | Panels, table and trend graph; manual entry with panel templates; paste/import with a review step; out-of-range flags |
| Immunisations | Dose series, batch, given, due and overdue tracking |
| Find care | Licensed facilities only, search, filters (service, insurance, distance, rating), distance from GPS or county, facility details, choose your pharmacy |
| Appointments | Request (summary shared automatically) → confirmed / new time proposed / declined → added to calendar → results sent back to Records and Results |
| Prescriptions | Repeat and new requests, nominated pharmacy, prescription check, allergy warnings, review dates, delivery tracking |
| Calendar | Month, agenda and health-check views; reminders from Kenyan screening, chronic-condition and vaccine rules |
| Settings | Notification preferences, English / Kiswahili, consents, activity log, data download, log out, close account (records kept 20 years) |

**Simulated in demo mode:** the clinic and pharmacy side. Yellow "Demo: act as the facility / pharmacy" buttons stand in for the Partner Portal, which isn't built yet.

## Run it

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (reminder rules, allergy checks, lab parsing, …)
npm run build      # type-check + production build
```

## Code layout

```
apps/patient/src/
  pages/          screens (health/, care/, more/)
  components/     shared UI: ui/ kit, layout, share and booking sheets, clinical forms
  domain/         pure logic with tests: reminder rules, allergy checks, labs, sharing, distance
  db/             data types, on-device database, actions (all writes go through here), sample data
  data/           Kenyan reference data (counties, insurers, services, vaccines) and demo facilities
  i18n/           English is the key; sw.ts holds the Kiswahili translations
```

`db/types.ts` mirrors the planned Postgres tables. To move to the Kenya-hosted backend, replace `db/db.ts` and `db/actions.ts` with Supabase calls; the screens use the same functions.

## Before real patients

- Kenya-hosted backend (self-hosted Supabase), real sign-in (phone OTP), server-side share links.
- Partner Portal for clinics and pharmacies.
- Clinical review of the reminder rules (`domain/reminders.ts`) and allergy groups (`domain/allergy.ts`).
- Native-speaker review of the Kiswahili text (`i18n/sw.ts`).
- Compliance steps in `docs/ARCHITECTURE.md` §7–8.
