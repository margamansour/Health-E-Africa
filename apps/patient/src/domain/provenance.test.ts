import { describe, expect, it } from "vitest";
import type { HealthRecord } from "@/db/types";
import { markEdited, provenanceOf } from "./provenance";

const rec = (id: string, extra: Partial<HealthRecord>): HealthRecord => ({ id, category: "letter", title: "Letter", date: "2026-01-01", source: "patient", createdAt: "", ...extra });
const records = new Map([
  ["ok", rec("ok", { verification: { status: "verified" } as HealthRecord["verification"] })],
  ["bad", rec("bad", { verification: { status: "unverified" } as HealthRecord["verification"] })],
  ["clinic", rec("clinic", { source: "facility", facilityName: "Uzima Family Clinic" })],
]);

describe("provenance", () => {
  it("labels each source", () => {
    expect(provenanceOf({ sourceRecordId: "ok" }, records)).toMatchObject({ kind: "document", verified: true });
    expect(provenanceOf({ sourceRecordId: "bad" }, records)).toMatchObject({ kind: "document", verified: false });
    expect(provenanceOf({ sourceRecordId: "clinic" }, records)).toMatchObject({ kind: "facility", verified: true, name: "Uzima Family Clinic" });
    expect(provenanceOf({ sourceFacility: "Afya Bora Hospital" }, records)).toMatchObject({ kind: "facility", verified: true });
    expect(provenanceOf({}, records)).toMatchObject({ kind: "self", verified: false });
    expect(provenanceOf({ sourceRecordId: "gone" }, records)).toMatchObject({ kind: "missing", verified: false });
  });

  it("an edited item is no longer verified", () => {
    expect(provenanceOf({ sourceRecordId: "ok", editedAt: "x" }, records)).toMatchObject({ kind: "document", verified: false, edited: true });
    expect(provenanceOf({ sourceFacility: "Afya", editedAt: "x" }, records)).toMatchObject({ verified: false, edited: true });
  });

  it("only clinical changes mark an item as edited", () => {
    const med = { name: "Metformin", dose: "500 mg", notes: undefined as string | undefined, sourceRecordId: "ok" };
    expect(markEdited(med, { name: "Metformin", dose: "500 mg", notes: "with food" })).toEqual({});
    expect(markEdited(med, { name: "Metformin", dose: "1 g" })).toHaveProperty("editedAt");
    const typedIn: { name: string; sourceRecordId?: string } = { name: "x" };
    expect(markEdited(typedIn, { name: "y" })).toEqual({});
  });
});
