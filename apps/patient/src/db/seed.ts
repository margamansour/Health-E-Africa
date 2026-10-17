import { db } from "./db";
import { demoFacilities } from "@/data/facilities";
import type { LabResult } from "./types";
import { addDays, addMonths, nowIso, toDateKey, uid } from "@/lib/utils";

/** Facilities are reference data; load them on first run. */
export async function ensureFacilities() {
  if ((await db.facilities.count()) === 0) await db.facilities.bulkPut(demoFacilities());
}

/** Fill the current profile with realistic sample health data (demo only). */
export async function loadSampleHealthData() {
  const t = new Date();
  const d = (days: number) => toDateKey(addDays(t, days));
  const m = (months: number) => toDateKey(addMonths(t, months));
  const created = nowIso();

  await db.transaction(
    "rw",
    [db.conditions, db.allergies, db.medications, db.immunisations, db.labPanels, db.labResults, db.records, db.ruleStatus, db.profile],
    async () => {
      const p = await db.profile.get("me");
      if (p) {
        await db.profile.update("me", {
          bloodGroup: p.bloodGroup ?? "O+",
          donorStatus: p.donorStatus ?? "registered",
          emergencyName: p.emergencyName ?? "Joseph Wanjiru",
          emergencyPhone: p.emergencyPhone ?? "+254711000222",
          emergencyRelation: p.emergencyRelation ?? "Spouse",
          insurance: p.insurance.length
            ? p.insurance
            : [{ provider: "SHA (Social Health Authority)", plan: "Primary care", memberNumber: "SHA-DEMO-123456" }],
          nominatedPharmacyId: p.nominatedPharmacyId ?? "fac-004",
          deliveryAddress: p.deliveryAddress ?? "Apartment 4B, Kilimani, Nairobi",
        });
      }

      await db.conditions.bulkAdd([
        { id: uid(), name: "Type 2 diabetes", status: "active", chronic: true, onsetDate: m(-60), createdAt: created },
        { id: uid(), name: "Hypertension", status: "active", chronic: true, onsetDate: m(-36), createdAt: created },
        { id: uid(), name: "Malaria", status: "resolved", chronic: false, onsetDate: m(-14), createdAt: created },
      ]);
      await db.allergies.bulkAdd([
        { id: uid(), substance: "Penicillin", reaction: "Rash and swelling", severity: "severe", status: "active", createdAt: created },
        { id: uid(), substance: "Sulfa drugs", reaction: "Hives", severity: "moderate", status: "active", createdAt: created },
      ]);
      await db.medications.bulkAdd([
        { id: uid(), name: "Metformin", dose: "500 mg", frequency: "Twice daily with meals", type: "repeat", status: "active", prescriptionOnly: true, startDate: m(-60), reviewDate: d(12), prescriber: "Dr. A. Otieno", createdAt: created },
        { id: uid(), name: "Amlodipine", dose: "5 mg", frequency: "Once daily", type: "repeat", status: "active", prescriptionOnly: true, startDate: m(-36), reviewDate: m(4), prescriber: "Dr. A. Otieno", createdAt: created },
        { id: uid(), name: "Atorvastatin", dose: "20 mg", frequency: "Once daily at night", type: "repeat", status: "active", prescriptionOnly: true, startDate: m(-24), reviewDate: d(-5), prescriber: "Dr. A. Otieno", createdAt: created },
        { id: uid(), name: "Paracetamol", dose: "1 g", frequency: "Up to 4 times daily when needed", type: "acute", status: "active", prescriptionOnly: false, startDate: d(-3), createdAt: created },
      ]);
      await db.immunisations.bulkAdd([
        { id: uid(), vaccine: "Tetanus-diphtheria (Td)", doseNumber: 1, seriesTotal: 1, dateGiven: m(-50), batchNumber: "TD-88231", administeredBy: "Uzima Family Clinic", site: "Left arm", createdAt: created },
        { id: uid(), vaccine: "COVID-19", doseNumber: 1, seriesTotal: 2, dateGiven: m(-40), batchNumber: "CV-11920", administeredBy: "Afya Bora Hospital", site: "Left arm", createdAt: created },
        { id: uid(), vaccine: "COVID-19", doseNumber: 2, seriesTotal: 2, dateGiven: m(-38), batchNumber: "CV-12007", administeredBy: "Afya Bora Hospital", site: "Left arm", createdAt: created },
        { id: uid(), vaccine: "Hepatitis B", doseNumber: 1, seriesTotal: 3, dateGiven: m(-2), batchNumber: "HB-5521", administeredBy: "Uzima Family Clinic", createdAt: created },
        { id: uid(), vaccine: "Hepatitis B", doseNumber: 2, seriesTotal: 3, dueDate: d(-6), createdAt: created },
        { id: uid(), vaccine: "Influenza", doseNumber: 1, seriesTotal: 1, dueDate: d(20), createdAt: created },
      ]);

      // HbA1c and lipid trends across 4 visits.
      const visits = [-12, -8, -4, -1];
      const hba1c = [8.4, 7.9, 7.3, 6.9];
      const ldl = [4.1, 3.8, 3.2, 2.9];
      const results: LabResult[] = [];
      for (let i = 0; i < visits.length; i++) {
        const date = m(visits[i]!);
        const p1 = uid();
        const p2 = uid();
        await db.labPanels.bulkAdd([
          { id: p1, name: "Diabetes (HbA1c)", date, facilityName: "Mwangaza Diagnostics", source: "facility", createdAt: created },
          { id: p2, name: "Lipid profile", date, facilityName: "Mwangaza Diagnostics", source: "facility", createdAt: created },
        ]);
        results.push({ id: uid(), panelId: p1, analyte: "HbA1c", value: hba1c[i]!, unit: "%", refLow: 4, refHigh: 5.7, date });
        results.push({ id: uid(), panelId: p2, analyte: "LDL cholesterol", value: ldl[i]!, unit: "mmol/L", refHigh: 3.4, date });
        results.push({ id: uid(), panelId: p2, analyte: "HDL cholesterol", value: 1.1 + i * 0.05, unit: "mmol/L", refLow: 1.0, date });
        results.push({ id: uid(), panelId: p2, analyte: "Total cholesterol", value: 6.0 - i * 0.3, unit: "mmol/L", refHigh: 5.2, date });
      }
      const fbc = uid();
      const fbcDate = m(-1);
      await db.labPanels.add({ id: fbc, name: "Full blood count", date: fbcDate, facilityName: "Afya Bora Hospital", source: "facility", createdAt: created });
      results.push(
        { id: uid(), panelId: fbc, analyte: "Haemoglobin", value: 11.6, unit: "g/dL", refLow: 12, refHigh: 17, date: fbcDate },
        { id: uid(), panelId: fbc, analyte: "White cell count", value: 6.2, unit: "x10^9/L", refLow: 4, refHigh: 11, date: fbcDate },
        { id: uid(), panelId: fbc, analyte: "Platelets", value: 254, unit: "x10^9/L", refLow: 150, refHigh: 400, date: fbcDate },
      );
      await db.labResults.bulkAdd(results);

      await db.records.bulkAdd([
        { id: uid(), category: "letter", title: "Diabetes clinic review letter", date: m(-1), facilityName: "Uzima Family Clinic", source: "facility", notes: "HbA1c improving. Continue metformin. Review in 3 months.", createdAt: created, seenAt: created },
        { id: uid(), category: "radiology", title: "Chest X-ray report", date: m(-14), facilityName: "Afya Bora Hospital", source: "facility", notes: "No active lung disease.", createdAt: created, seenAt: created },
        { id: uid(), category: "prescription", title: "Repeat prescription — Metformin, Amlodipine, Atorvastatin", date: m(-2), facilityName: "Uzima Family Clinic", source: "facility", notes: "Valid for 6 months, 5 repeats.", createdAt: created, seenAt: created },
      ]);

      await db.ruleStatus.bulkPut([
        { ruleId: "bp-check", lastDone: m(-3) },
        { ruleId: "htn-review", lastDone: m(-2) },
        { ruleId: "dm-hba1c", lastDone: m(-1) },
        { ruleId: "cervical", lastDone: m(-20) },
        { ruleId: "hiv-test", lastDone: m(-11) },
      ]);
    },
  );
}
