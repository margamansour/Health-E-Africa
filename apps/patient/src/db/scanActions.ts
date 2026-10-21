import { db } from "./db";
import type { HealthRecord, LabResult, RecordCategory } from "./types";
import type { ExtractedAllergy, ExtractedCondition, ExtractedFollowUp, ExtractedImmunisation, ExtractedLab, ExtractedMedication } from "@/domain/extract/parse";
import type { Verification } from "@/domain/extract/verify";
import { addRecord, notify, syncReminders } from "./actions";
import { nowIso, parseDateKey, uid } from "@/lib/utils";
import { standardise } from "@/domain/units";

export interface ScanSelection {
  labs: ExtractedLab[];
  conditions: ExtractedCondition[];
  medications: ExtractedMedication[];
  allergies: ExtractedAllergy[];
  immunisations: ExtractedImmunisation[];
  followUps: ExtractedFollowUp[];
}

const same = (a?: string, b?: string) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/** What the patient already has, so the review screen can mark duplicates and dose changes. */
export async function existingFor() {
  const [conditions, allergies, medications, immunisations, labResults] = await Promise.all([
    db.conditions.filter((x) => !x.archivedAt).toArray(),
    db.allergies.filter((x) => !x.archivedAt).toArray(),
    db.medications.filter((x) => !x.archivedAt).toArray(),
    db.immunisations.filter((x) => !x.archivedAt).toArray(),
    db.labResults.toArray(),
  ]);
  return {
    hasCondition: (c: ExtractedCondition) => conditions.some((x) => same(x.name, c.name)),
    hasAllergy: (a: ExtractedAllergy) => allergies.some((x) => same(x.substance, a.substance)),
    medicationChange: (m: ExtractedMedication): "new" | "same" | "update" => {
      const x = medications.find((y) => same(y.name, m.name) && y.status === "active");
      if (!x) return "new";
      return same(x.dose, m.dose) && (!m.frequency || same(x.frequency, m.frequency)) && m.status === "active" ? "same" : "update";
    },
    currentDose: (m: ExtractedMedication) => medications.find((y) => same(y.name, m.name) && y.status === "active")?.dose,
    hasImmunisation: (i: ExtractedImmunisation) => immunisations.some((x) => same(x.vaccine, i.vaccine) && x.doseNumber === i.doseNumber && x.dateGiven === i.dateGiven),
    hasLab: (l: ExtractedLab, date?: string) => {
      const v = standardise(l.analyte, l.value, l.unit).value;
      return labResults.some((x) => same(x.analyte, l.analyte) && (x.value === v || x.originalValue === l.value) && x.date === date);
    },
  };
}

/** Save the document and add the items the patient kept ticked. Returns how many items were added or updated. */
export async function saveScannedRecord(input: {
  file?: File;
  title: string;
  category: RecordCategory;
  date: string;
  facilityName?: string;
  notes?: string;
  verification?: Verification;
  scannedText?: string;
  selected: ScanSelection;
  /** Re-scanning a record that's already saved: update it instead of adding a new one. */
  existingRecordId?: string;
}): Promise<{ recordId: string; added: number }> {
  const recordId = input.existingRecordId ?? (await addRecord({
    category: input.category,
    title: input.title,
    date: input.date,
    facilityName: input.facilityName,
    notes: input.notes,
    file: input.file,
    verification: input.verification,
    scannedText: input.scannedText,
  }));
  if (input.existingRecordId) {
    await db.records.update(recordId, {
      category: input.category,
      title: input.title,
      date: input.date,
      facilityName: input.facilityName,
      notes: input.notes,
      verification: input.verification,
      scannedText: input.scannedText,
    });
  }
  const ex = await existingFor();
  const created = nowIso();
  const s = input.selected;
  let added = 0;

  await db.transaction("rw", [db.conditions, db.allergies, db.medications, db.immunisations, db.labPanels, db.labResults, db.events], async () => {
    for (const c of s.conditions) {
      if (ex.hasCondition(c)) continue;
      await db.conditions.add({ id: uid(), name: c.name, status: c.status, chronic: c.chronic, onsetDate: c.status === "active" ? input.date : undefined, createdAt: created, sourceRecordId: recordId });
      added++;
    }
    for (const a of s.allergies) {
      if (ex.hasAllergy(a)) continue;
      await db.allergies.add({ id: uid(), substance: a.substance, reaction: a.reaction, severity: a.severity, status: "active", createdAt: created, sourceRecordId: recordId });
      added++;
    }
    for (const m of s.medications) {
      const existing = (await db.medications.toArray()).find((y) => !y.archivedAt && same(y.name, m.name) && y.status === "active");
      if (existing) {
        if (ex.medicationChange(m) === "same") continue;
        await db.medications.update(existing.id, { dose: m.dose, frequency: m.frequency || existing.frequency, status: m.status, sourceRecordId: recordId, sourceFacility: undefined, editedAt: undefined });
      } else {
        await db.medications.add({
          id: uid(),
          name: m.name,
          dose: m.dose,
          frequency: m.frequency,
          type: m.type,
          status: m.status,
          prescriptionOnly: m.prescriptionOnly,
          startDate: input.date,
          instructions: m.note,
          createdAt: created,
          sourceRecordId: recordId,
        });
      }
      added++;
    }
    for (const i of s.immunisations) {
      if (ex.hasImmunisation(i)) continue;
      await db.immunisations.add({
        id: uid(),
        vaccine: i.vaccine,
        doseNumber: i.doseNumber,
        seriesTotal: Math.max(1, i.doseNumber),
        dateGiven: i.dateGiven,
        dueDate: i.dateGiven ? undefined : input.date,
        batchNumber: i.batchNumber,
        administeredBy: input.facilityName,
        createdAt: created,
        sourceRecordId: recordId,
      });
      added++;
    }
    // Lab results go into one panel per test group.
    const labs = s.labs.filter((l) => !ex.hasLab(l, input.date));
    const panels = [...new Set(labs.map((l) => l.panel))];
    for (const name of panels) {
      const panelId = uid();
      await db.labPanels.add({ id: panelId, name, date: input.date, facilityName: input.facilityName, source: "patient", createdAt: created, sourceRecordId: recordId });
      const rows: LabResult[] = labs
        .filter((l) => l.panel === name)
        .map((l) => ({ id: uid(), panelId, analyte: l.analyte, value: l.value, unit: l.unit, refLow: l.refLow, refHigh: l.refHigh, date: input.date }));
      await db.labResults.bulkAdd(rows);
      added += rows.length;
    }
    for (const f of s.followUps) {
      const start = parseDateKey(f.date);
      start.setHours(9, 0, 0, 0);
      await db.events.add({ id: uid(), title: f.title, type: "review", start: start.toISOString(), allDay: true, notes: `From: ${input.title}`, source: "manual", remindMinutesBefore: 24 * 60 });
      added++;
    }
  });

  await notify({
    type: "result",
    title: input.verification?.status === "verified" ? "Verified document added" : "Document added",
    body: added ? `${input.title}: ${added} item(s) added to your record.` : input.title,
    link: "/records",
  });
  void syncReminders();
  return { recordId, added };
}

export function isVerified(r?: Pick<HealthRecord, "verification" | "source">) {
  // Sent directly by a clinic through the app, or scanned and passed every check.
  return !!r && (r.source === "facility" || r.verification?.status === "verified");
}
