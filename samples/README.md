# Sample documents for testing document scanning

All patients, clinics and results here are **fictional**. Every document is marked
"SAMPLE DOCUMENT - FOR DEMO ONLY". The patient matches the app's sample patient
(*Try it with a sample patient*: Amina Wanjiru, born 12/03/1974).

| File | What it shows | Expected result |
|---|---|---|
| `01-lab-report-mwangaza-VERIFIED.pdf` | Printed lab report: blood count, HbA1c, lipids, kidney function. Blue stamp, signature. | **Verified source**, 15 results |
| `02-clinic-letter-uzima-VERIFIED.pdf` | Printed clinic letter: diagnoses, allergies, medicines (with dose changes), flu vaccine, plan. Purple stamp, signature. | **Verified source**, conditions, allergies, medicines, vaccine and 2 follow-ups |
| `03-handwritten-note-UNVERIFIED.pdf` | Scanned handwritten note (no text layer): tonsillitis, amoxicillin. | **Unverified** (handwritten). Shows an allergy warning: amoxicillin vs penicillin |
| `04-discharge-summary-unlisted-hospital-UNVERIFIED.pdf` | Printed discharge summary from a hospital that isn't in the directory. Signed, no stamp. | **Unverified** (clinic not recognised) |
| `05-lab-report-photo.jpg` | Phone photo of the lab report. | **Verified source**, read with on-device text recognition |

Regenerate with `python3 samples/generate_samples.py` (needs reportlab, Pillow and poppler).
Fonts in `fonts/` are under the SIL Open Font License.
