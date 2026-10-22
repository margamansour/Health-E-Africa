import Dexie, { type EntityTable } from "dexie";
import { standardise } from "@/domain/units";
import { isClinicalDiagnosis } from "@/domain/extract/diagnosis";
import type {
  Allergy,
  Appointment,
  AppNotification,
  AuditEntry,
  CalendarEvent,
  Condition,
  Consent,
  Facility,
  HealthRecord,
  Immunisation,
  LabPanel,
  LabResult,
  Medication,
  MedRequest,
  Profile,
  RuleStatus,
  Setting,
  ShareAccess,
  StoredFile,
  SummaryShare,
} from "./types";

/**
 * On-device store (IndexedDB) used while the app runs in demo mode.
 * It will be replaced by the Kenya-hosted Supabase backend.
 */
export class HealthDB extends Dexie {
  profile!: EntityTable<Profile, "id">;
  conditions!: EntityTable<Condition, "id">;
  allergies!: EntityTable<Allergy, "id">;
  medications!: EntityTable<Medication, "id">;
  immunisations!: EntityTable<Immunisation, "id">;
  records!: EntityTable<HealthRecord, "id">;
  files!: EntityTable<StoredFile, "id">;
  labPanels!: EntityTable<LabPanel, "id">;
  labResults!: EntityTable<LabResult, "id">;
  facilities!: EntityTable<Facility, "id">;
  appointments!: EntityTable<Appointment, "id">;
  medRequests!: EntityTable<MedRequest, "id">;
  shares!: EntityTable<SummaryShare, "id">;
  shareAccess!: EntityTable<ShareAccess, "id">;
  events!: EntityTable<CalendarEvent, "id">;
  notifications!: EntityTable<AppNotification, "id">;
  consents!: EntityTable<Consent, "id">;
  audit!: EntityTable<AuditEntry, "id">;
  ruleStatus!: EntityTable<RuleStatus, "ruleId">;
  settings!: EntityTable<Setting, "key">;

  constructor(name = "health-e-africa") {
    super(name);
    this.version(1).stores({
      profile: "id",
      conditions: "id, status, createdAt",
      allergies: "id, status, createdAt",
      medications: "id, status, type, createdAt",
      immunisations: "id, vaccine, createdAt",
      records: "id, category, date, source, createdAt",
      files: "id",
      labPanels: "id, date",
      labResults: "id, panelId, analyte, date",
      facilities: "id, type, county",
      appointments: "id, facilityId, status, createdAt",
      medRequests: "id, pharmacyId, status, createdAt",
      shares: "id, &token, createdAt",
      shareAccess: "id, shareId, at",
      events: "id, start, type, source, ruleId, appointmentId",
      notifications: "id, key, createdAt, readAt",
      consents: "id, purpose, grantedAt",
      audit: "++id, at, entity",
      ruleStatus: "ruleId",
      settings: "key",
    });
    // v2: convert every saved lab result to the standard unit for its test.
    this.version(2).upgrade((tx) =>
      tx
        .table("labResults")
        .toCollection()
        .modify((r: LabResult) => {
          if (r.originalUnit) return;
          Object.assign(r, toStandard(r));
        }),
    );
    // v3: conditions read from documents that aren't clinical diagnoses (findings, plans, names,
    // queries) are archived. Kept for the record, never deleted; ones the patient edited are left alone.
    this.version(3).upgrade((tx) =>
      tx
        .table("conditions")
        .toCollection()
        .modify((c: Condition) => {
          if (c.sourceRecordId && !c.editedAt && !c.archivedAt && !isClinicalDiagnosis(c.name)) c.archivedAt = new Date().toISOString();
        }),
    );
  }
}

/** The standard-unit form of a result (keeps the reported value when it was converted). */
function toStandard(r: LabResult): Partial<LabResult> {
  const s = standardise(r.analyte, r.value, r.unit, r.refLow, r.refHigh);
  return { value: s.value, unit: s.unit, refLow: s.refLow, refHigh: s.refHigh, originalValue: s.originalValue, originalUnit: s.originalUnit };
}

export const db = new HealthDB();

// Every result saved by any route (scan, typed in, sent by a clinic) is stored in the standard unit.
db.labResults.hook("creating", (_key, obj) => {
  if (!obj.originalUnit) Object.assign(obj, toStandard(obj));
});

// Tables holding health data: every write to these is recorded in the audit log.
const AUDITED = [
  "profile",
  "conditions",
  "allergies",
  "medications",
  "immunisations",
  "records",
  "labPanels",
  "labResults",
  "appointments",
  "medRequests",
  "shares",
  "consents",
] as const;

export const ACTOR = "patient";

for (const name of AUDITED) {
  const table = db.table(name);
  table.hook("creating", (primKey, obj) => {
    const id = (primKey ?? (obj as { id?: string }).id) as string | undefined;
    queueAudit({ action: "create", entity: name, entityId: id });
  });
  table.hook("updating", (mods, primKey) => {
    const action = "archivedAt" in (mods as object) ? "archive" : "update";
    queueAudit({ action, entity: name, entityId: String(primKey), detail: Object.keys(mods as object).join(", ") });
  });
  table.hook("deleting", (primKey) => {
    queueAudit({ action: "delete", entity: name, entityId: String(primKey) });
  });
}

// Hooks run inside the caller's transaction, which may not include the audit table,
// so audit writes are queued and flushed afterwards.
function queueAudit(entry: Omit<AuditEntry, "at" | "actor">) {
  const full: AuditEntry = { ...entry, at: new Date().toISOString(), actor: ACTOR };
  setTimeout(() => {
    db.audit.add(full).catch(() => {});
  }, 0);
}

export function logAudit(entry: Omit<AuditEntry, "at" | "actor"> & { actor?: string }) {
  return db.audit.add({ actor: ACTOR, ...entry, at: new Date().toISOString() });
}
