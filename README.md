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
| Records | Upload a photo or PDF → **scanned on the phone** → diagnoses, medicines, allergies, results, vaccines and follow-ups found and sorted for review → **verified / unverified source** badge; search includes the document text |
| Results | Panels, table and trend graph; manual entry with panel templates; paste/import with a review step; out-of-range flags |
| Immunisations | Dose series, batch, given, due and overdue tracking |
| Find care | Licensed facilities only, search, filters (service, insurance, distance, rating), distance from GPS or county, facility details, choose your pharmacy |
| Appointments | Request (summary shared automatically) → confirmed / new time proposed / declined → added to calendar → results sent back to Records and Results |
| Prescriptions | Repeat and new requests, nominated pharmacy, prescription check, allergy warnings, review dates, delivery tracking |
| Calendar | Month, agenda and health-check views; reminders from Kenyan screening, chronic-condition and vaccine rules |
| Settings | Notification preferences, English / Kiswahili, consents, activity log, data download, log out, close account (records kept 20 years) |

**Simulated in demo mode:** the clinic and pharmacy side. Yellow "Demo: act as the facility / pharmacy" buttons stand in for the Partner Portal, which isn't built yet.

## Document scanning and verification

Uploading a record scans it **on the device**; nothing is sent to a server, which keeps health data in Kenya as the legal advice requires.

- **Typed PDFs**: text is read directly (pdf.js).
- **Photos and scanned PDFs**: text is recognised with Tesseract (on-device OCR). The engine (~3 MB) and English data (~3 MB) only download the first time someone scans a photo.
- **Finding information** (`domain/extract/parse.ts`): document type, date, clinic, patient name and date of birth, signer, registration number, conditions, allergies, medicines (dose, frequency, course length, changes), lab results with ranges, vaccines and follow-ups. The patient reviews and unticks anything before it is saved. Duplicates are skipped and changed doses shown as updates.
- **Verified source** (`domain/extract/verify.ts`) requires all of: printed (not handwritten), a licensed clinic from the directory, a date, a stamp or signature, and no mismatch with the patient's name or date of birth. Anything else is saved as **unverified**.
  - Stamp: a block of coloured (blue, violet or red) ink of stamp size and shape (`domain/extract/marks.ts`).
  - Signature: pen strokes next to or above a "Signature" / "Signed" label, ignoring printed text.
  - Handwriting: letters that wobble off a straight baseline or vary in height, or low recognition confidence (`domain/extract/handwriting.ts`).
- Items keep a link to their source document, so the summary, results and shared view show a ✓ for information from verified documents.

These checks look at the document's markings; they don't prove it is genuine. Results that clinics send directly through the app (later, via the national data exchange) are verified by that route.

Try it with the files in [`samples/`](samples/).

## Run it

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (reminder rules, allergy checks, lab parsing, …)
npm run build      # type-check + production build
npm run build:offline -w apps/patient   # one self-contained HTML file for demos
```

To test on an iPhone plugged into a Windows laptop by USB-C, see [docs/TESTING-ON-IPHONE.md](docs/TESTING-ON-IPHONE.md) (`npm run phone -w apps/patient`).

`build:offline` writes `apps/patient/dist-offline/health-e-africa-demo.html`: the whole app (code, styles, font, icon) in one file. It makes no network requests, so it works with no connection, can be hosted anywhere, and can be shared as a demo. Data entered stays on that device.

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
