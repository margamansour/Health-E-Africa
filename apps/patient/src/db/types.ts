// Shared data types. These mirror the planned Postgres tables (docs/ARCHITECTURE.md §6)
// so a server-backed store can replace the on-device one later.

export type ID = string;
export type Sex = "female" | "male";

import type { Verification } from "@/domain/extract/verify";

/** Health records are never hard-deleted (20-year retention); they are archived instead. */
export interface Archivable {
  archivedAt?: string;
}

/** Where an item came from: a scanned document, a clinic sending it through the app, or typed in. */
export interface FromDocument {
  /** The uploaded document (or clinic record) it was taken from. */
  sourceRecordId?: ID;
  /** Sent directly by this clinic through the app, with no document. */
  sourceFacility?: string;
  /** Set when the patient changes an item that came from a document or clinic. */
  editedAt?: string;
}

export interface InsurancePlan {
  provider: string;
  plan: string;
  memberNumber: string;
}

export interface Profile {
  id: "me";
  fullName: string;
  dob: string; // yyyy-mm-dd
  sex: Sex;
  phone: string;
  email?: string;
  county: string;
  town?: string;
  lat?: number;
  lng?: number;
  bloodGroup?: string;
  donorStatus?: "registered" | "not_registered" | "undecided";
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
  insurance: InsurancePlan[];
  nominatedPharmacyId?: ID;
  deliveryAddress?: string;
  createdAt: string;
  status: "active" | "closed";
  closedAt?: string;
}

export interface Condition extends Archivable, FromDocument {
  id: ID;
  name: string;
  status: "active" | "resolved";
  chronic: boolean;
  onsetDate?: string;
  notes?: string;
  createdAt: string;
}

export type Severity = "mild" | "moderate" | "severe";

export interface Allergy extends Archivable, FromDocument {
  id: ID;
  substance: string;
  reaction?: string;
  severity: Severity;
  status: "active" | "inactive";
  createdAt: string;
}

export interface Medication extends Archivable, FromDocument {
  id: ID;
  name: string;
  dose: string;
  frequency: string;
  type: "repeat" | "acute";
  status: "active" | "stopped";
  prescriptionOnly: boolean;
  startDate?: string;
  reviewDate?: string;
  prescriber?: string;
  instructions?: string;
  createdAt: string;
}

export interface Immunisation extends Archivable, FromDocument {
  id: ID;
  vaccine: string;
  doseNumber: number;
  seriesTotal: number;
  dateGiven?: string;
  dueDate?: string;
  batchNumber?: string;
  administeredBy?: string;
  site?: string;
  notes?: string;
  createdAt: string;
}

export type RecordCategory = "letter" | "radiology" | "lab" | "prescription" | "discharge" | "other";

export interface HealthRecord extends Archivable {
  id: ID;
  category: RecordCategory;
  title: string;
  date: string;
  facilityName?: string;
  source: "patient" | "facility";
  notes?: string;
  fileId?: ID;
  fileName?: string;
  fileType?: string;
  createdAt: string;
  seenAt?: string;
  /** Result of scanning the document for authenticity marks (stamp, signature, known clinic…). */
  verification?: Verification;
  /** Text read from the document, kept so records can be searched. */
  scannedText?: string;
}

export interface StoredFile {
  id: ID;
  name: string;
  type: string;
  size: number;
  blob: Blob;
}

export interface LabPanel extends Archivable, FromDocument {
  id: ID;
  name: string;
  date: string;
  facilityName?: string;
  source: "patient" | "facility";
  createdAt: string;
}

export interface LabResult {
  id: ID;
  panelId: ID;
  analyte: string;
  /** Always in the standard unit for this test (see domain/units.ts). */
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  date: string;
  /** As printed on the report, when it had to be converted to the standard unit. */
  originalValue?: number;
  originalUnit?: string;
}

export type FacilityType = "clinic" | "hospital" | "lab" | "pharmacy";

export interface Facility {
  id: ID;
  name: string;
  type: FacilityType;
  services: string[];
  /** Insurers known to be accepted. Empty when not known (most official listings). */
  insurers: string[];
  county: string;
  town: string;
  address?: string;
  lat: number;
  lng: number;
  phone?: string;
  email?: string;
  hours?: string;
  rating?: number;
  reviews?: number;
  licenceBody?: string;
  licenceNumber?: string;
  licenceExpires?: string;
  licenceVerifiedAt?: string;
  delivers?: boolean;
  /** "kmhfl": the Ministry of Health's Kenya Master Health Facility List. "demo": fictional sample listing. */
  source: "kmhfl" | "demo";
  /** Official KMHFL facility code. */
  code?: number;
  /** KMHFL facility type, e.g. "Dispensary", "Basic Health Centre", "Primary care hospitals". */
  facilityType?: string;
  /** KEPH level 1–6 (2 dispensary/clinic, 3 health centre, 4 county hospital, 5–6 referral). */
  level?: number;
  owner?: string;
  subCounty?: string;
  ward?: string;
  /** 1: placed at the ward's centre, 2: at the county's centre (no GPS point listed). */
  approxLocation?: 0 | 1 | 2;
  beds?: number;
}

export type AppointmentStatus = "pending" | "proposed" | "confirmed" | "declined" | "cancelled" | "completed";

export interface StatusChange<S extends string> {
  status: S;
  at: string;
  note?: string;
}

export interface Appointment {
  id: ID;
  facilityId: ID;
  service?: string;
  preferredDate: string;
  preferredTime: string;
  confirmedStart?: string; // ISO
  reason: string;
  status: AppointmentStatus;
  shareId?: ID;
  eventId?: ID;
  history: StatusChange<AppointmentStatus>[];
  createdAt: string;
}

export type MedRequestStatus =
  | "submitted"
  | "awaiting_prescriber"
  | "approved"
  | "dispensed"
  | "out_for_delivery"
  | "delivered"
  | "rejected"
  | "cancelled";

export interface MedRequest {
  id: ID;
  pharmacyId: ID;
  type: "repeat" | "acute";
  items: { medicationId?: ID; name: string; dose?: string }[];
  acuteDetails?: string;
  /** Allergy and interaction alerts shown to the patient, passed on for the pharmacist to check. */
  safetyNotes?: string[];
  prescriptionRecordId?: ID;
  deliveryAddress: string;
  delivery: "delivery" | "collect";
  status: MedRequestStatus;
  history: StatusChange<MedRequestStatus>[];
  createdAt: string;
}

export type ShareSection =
  | "identity"
  | "emergency"
  | "conditions"
  | "allergies"
  | "medications"
  | "labs"
  | "immunisations"
  | "records";

export interface SummaryShare {
  id: ID;
  token: string;
  summaryType: "full" | "emergency" | "medications" | "custom";
  sections: ShareSection[];
  recordIds: ID[];
  facilityId?: ID;
  recipientLabel: string;
  purpose: string;
  consentId: ID;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface ShareAccess {
  id: ID;
  shareId: ID;
  at: string;
  viewer: string;
}

export type EventType = "appointment" | "medication" | "screening" | "vaccine" | "review" | "other";

export interface CalendarEvent {
  id: ID;
  title: string;
  type: EventType;
  start: string; // ISO
  allDay: boolean;
  notes?: string;
  source: "manual" | "appointment" | "reminder";
  ruleId?: string;
  appointmentId?: ID;
  remindMinutesBefore?: number;
  doneAt?: string;
}

export interface AppNotification {
  id: ID;
  key?: string; // de-duplication key
  type: "appointment" | "result" | "prescription" | "reminder" | "share" | "system";
  title: string;
  body: string;
  link?: string;
  createdAt: string;
  readAt?: string;
}

export interface Consent {
  id: ID;
  purpose: "account" | "share" | "reminders" | "notifications";
  policyVersion: string;
  language: string;
  wording: string;
  scope?: string;
  grantedAt: string;
  expiresAt?: string;
  withdrawnAt?: string;
}

export interface AuditEntry {
  id?: number;
  at: string;
  actor: string;
  action: "create" | "update" | "archive" | "delete" | "view" | "share" | "revoke" | "export" | "login" | "logout";
  entity: string;
  entityId?: string;
  detail?: string;
}

export interface RuleStatus {
  ruleId: string;
  lastDone?: string;
  dismissed?: boolean;
}

export interface Setting {
  key: string;
  value: unknown;
}

/** Something the patient needs to do, usually taken from an uploaded document (a plan, actions for GP, a medicine change). */
export interface Task extends Archivable {
  id: ID;
  kind: "medication" | "test" | "referral" | "appointment" | "lifestyle" | "other";
  /** The instruction, as written in the document where possible. */
  title: string;
  /** For the patient's GP or regular doctor: the patient takes it to them. */
  forGp: boolean;
  dueDate?: string;
  /** The document it came from. */
  sourceRecordId?: ID;
  createdAt: string;
  doneAt?: string;
}
