import type { FromDocument, HealthRecord } from "@/db/types";

/**
 * Where an item in the health record came from, and whether it can be trusted as-is.
 * - document: taken from an uploaded document (verified when the document passed every check)
 * - facility: sent by a clinic through the app (verified)
 * - self:     typed in by the patient (not verified)
 * Editing an item that came from a document or clinic removes the verified mark: the
 * source no longer vouches for what is shown.
 */
export type Provenance =
  | { kind: "document"; verified: boolean; record: HealthRecord; edited: boolean }
  | { kind: "facility"; verified: boolean; name: string; record?: HealthRecord; edited: boolean }
  | { kind: "self"; verified: false; edited: false }
  | { kind: "missing"; verified: false; edited: boolean };

export function provenanceOf(item: FromDocument, records: Map<string, HealthRecord>): Provenance {
  const edited = !!item.editedAt;
  if (item.sourceRecordId) {
    const record = records.get(item.sourceRecordId);
    if (!record) return { kind: "missing", verified: false, edited };
    if (record.source === "facility") return { kind: "facility", verified: !edited, name: record.facilityName ?? "", record, edited };
    return { kind: "document", verified: !edited && record.verification?.status === "verified", record, edited };
  }
  if (item.sourceFacility) return { kind: "facility", verified: !edited, name: item.sourceFacility, edited };
  return { kind: "self", verified: false, edited: false };
}

/**
 * Extra fields to save when the patient edits an item. If the item came from a document or clinic
 * and any clinical detail changed, it's marked as edited (personal notes don't count).
 */
export function markEdited<T extends FromDocument>(before: T | undefined, after: Record<string, unknown>): Partial<FromDocument> {
  if (!before || !(before.sourceRecordId || before.sourceFacility) || before.editedAt) return {};
  const norm = (v: unknown) => (v === "" || v == null ? undefined : v);
  const changed = Object.entries(after).some(([k, v]) => k !== "notes" && norm(v) !== norm((before as Record<string, unknown>)[k]));
  return changed ? { editedAt: new Date().toISOString() } : {};
}
