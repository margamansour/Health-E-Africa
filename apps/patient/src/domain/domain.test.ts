import { describe, expect, it } from "vitest";
import { findAllergyConflicts } from "./allergy";
import { flagFor, parseResultsText } from "./labs";
import { immunisationState, planReminders, ruleApplies, KENYA_RULES } from "./reminders";
import { shareState } from "./share";
import { distanceKm } from "./geo";
import type { Allergy, Condition, Immunisation, Medication } from "@/db/types";
import { addMonths, ageOn, parseDateKey, toDateKey } from "@/lib/utils";

const allergy = (substance: string, extra: Partial<Allergy> = {}): Allergy => ({
  id: substance,
  substance,
  severity: "severe",
  status: "active",
  createdAt: "",
  ...extra,
});

const condition = (name: string, extra: Partial<Condition> = {}): Condition => ({
  id: name,
  name,
  status: "active",
  chronic: true,
  createdAt: "",
  ...extra,
});

describe("allergy conflicts", () => {
  it("flags a medicine in the same group as the allergy", () => {
    const c = findAllergyConflicts("Amoxicillin 500mg", [allergy("Penicillin")]);
    expect(c).toHaveLength(1);
    expect(c[0]!.level).toBe("direct");
  });

  it("flags cross-reactions as a separate level", () => {
    const c = findAllergyConflicts("Ceftriaxone", [allergy("Penicillin")]);
    expect(c[0]?.level).toBe("cross");
  });

  it("matches sulfa allergy to co-trimoxazole", () => {
    expect(findAllergyConflicts("Co-trimoxazole", [allergy("Sulfa drugs")])).toHaveLength(1);
  });

  it("ignores inactive and archived allergies", () => {
    expect(findAllergyConflicts("Amoxicillin", [allergy("Penicillin", { status: "inactive" })])).toHaveLength(0);
    expect(findAllergyConflicts("Amoxicillin", [allergy("Penicillin", { archivedAt: "x" })])).toHaveLength(0);
  });

  it("does not flag unrelated medicines", () => {
    expect(findAllergyConflicts("Metformin", [allergy("Penicillin"), allergy("Sulfa drugs")])).toHaveLength(0);
  });
});

describe("lab results", () => {
  it("flags values outside the range", () => {
    expect(flagFor({ value: 11, refLow: 12, refHigh: 17 })).toBe("low");
    expect(flagFor({ value: 18, refLow: 12, refHigh: 17 })).toBe("high");
    expect(flagFor({ value: 14, refLow: 12, refHigh: 17 })).toBe("normal");
    expect(flagFor({ value: 14 })).toBe("unknown");
    expect(flagFor({ value: 6, refHigh: 5.7 })).toBe("high");
  });

  it("parses pasted results with ranges, separate low/high and headers", () => {
    const { rows, errors } = parseResultsText(
      "Test,Value,Unit,Low,High\nHaemoglobin, 13.2, g/dL, 12-17\nCreatinine\t92\tµmol/L\t45\t110\nHbA1c;<6.5;%\nnonsense line",
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ analyte: "Haemoglobin", value: 13.2, refLow: 12, refHigh: 17 });
    expect(rows[1]).toMatchObject({ analyte: "Creatinine", value: 92, refLow: 45, refHigh: 110 });
    expect(rows[2]).toMatchObject({ analyte: "HbA1c", value: 6.5 });
    expect(errors).toHaveLength(1);
  });
});

describe("reminder rules", () => {
  const today = new Date(2026, 9, 17);
  const dobFor = (age: number) => toDateKey(new Date(today.getFullYear() - age, 0, 1));

  const plan = (age: number, sex: "female" | "male", conditions: Condition[] = [], extra: { immunisations?: Immunisation[]; medications?: Medication[] } = {}) =>
    planReminders({
      profile: { dob: dobFor(age), sex },
      conditions,
      medications: extra.medications ?? [],
      immunisations: extra.immunisations ?? [],
      ruleStatus: [],
      today,
    });
  const ids = (p: ReturnType<typeof plan>) => p.map((x) => x.ruleId).filter(Boolean);

  it("gives cervical screening to women 25–49 only", () => {
    expect(ids(plan(30, "female"))).toContain("cervical");
    expect(ids(plan(30, "male"))).not.toContain("cervical");
    expect(ids(plan(55, "female"))).not.toContain("cervical");
  });

  it("gives prostate screening discussion to men 45–69", () => {
    expect(ids(plan(50, "male"))).toContain("prostate");
    expect(ids(plan(40, "male"))).not.toContain("prostate");
  });

  it("adds condition reviews and removes screening for conditions already diagnosed", () => {
    const p = ids(plan(52, "female", [condition("Type 2 diabetes"), condition("Hypertension")]));
    expect(p).toEqual(expect.arrayContaining(["dm-hba1c", "dm-foot", "htn-review", "flu"]));
    expect(p).not.toContain("diabetes-screen");
    expect(p).not.toContain("bp-check");
  });

  it("ignores resolved conditions", () => {
    expect(ids(plan(30, "female", [condition("Diabetes", { status: "resolved" })]))).not.toContain("dm-hba1c");
  });

  it("gives flu vaccine by age 65 or long-term condition", () => {
    expect(ids(plan(66, "male"))).toContain("flu");
    expect(ids(plan(30, "male"))).not.toContain("flu");
    expect(ids(plan(30, "male", [condition("Asthma")]))).toContain("flu");
  });

  it("skips HPV once a dose is recorded", () => {
    const hpvRule = KENYA_RULES.find((r) => r.id === "hpv")!;
    const given: Immunisation = { id: "1", vaccine: "HPV", doseNumber: 1, seriesTotal: 1, dateGiven: "2026-01-01", createdAt: "" };
    expect(ruleApplies(hpvRule, { profile: { dob: dobFor(12), sex: "female" }, conditions: [], immunisations: [], today })).toBe(true);
    expect(ruleApplies(hpvRule, { profile: { dob: dobFor(12), sex: "female" }, conditions: [], immunisations: [given], today })).toBe(false);
  });

  it("schedules the next due date from when it was last done", () => {
    const p = planReminders({
      profile: { dob: dobFor(52), sex: "female" },
      conditions: [condition("Type 2 diabetes")],
      medications: [],
      immunisations: [],
      ruleStatus: [{ ruleId: "dm-hba1c", lastDone: "2026-09-01" }],
      today,
    });
    const hba1c = p.find((x) => x.ruleId === "dm-hba1c")!;
    expect(hba1c.dueDate).toBe("2027-03-01");
    expect(hba1c.state).toBe("upcoming");
  });

  it("hides dismissed rules", () => {
    const p = planReminders({ profile: { dob: dobFor(30), sex: "female" }, conditions: [], medications: [], immunisations: [], ruleStatus: [{ ruleId: "cervical", dismissed: true }], today });
    expect(p.map((x) => x.ruleId)).not.toContain("cervical");
  });

  it("includes medication reviews and due vaccines", () => {
    const med: Medication = { id: "m", name: "Metformin", dose: "500 mg", frequency: "", type: "repeat", status: "active", prescriptionOnly: true, reviewDate: "2026-10-01", createdAt: "" };
    const vac: Immunisation = { id: "v", vaccine: "Hepatitis B", doseNumber: 2, seriesTotal: 3, dueDate: "2026-11-01", createdAt: "" };
    const p = plan(40, "male", [], { medications: [med], immunisations: [vac] });
    expect(p.find((x) => x.key === "medreview:m")?.state).toBe("due");
    expect(p.find((x) => x.key === "vaccine:v")?.state).toBe("upcoming");
  });
});

describe("immunisation state", () => {
  const base: Immunisation = { id: "1", vaccine: "X", doseNumber: 1, seriesTotal: 1, createdAt: "" };
  it("classifies given, overdue, due soon and scheduled", () => {
    expect(immunisationState({ ...base, dateGiven: "2026-01-01" }, "2026-10-17")).toBe("given");
    expect(immunisationState({ ...base, dueDate: "2026-10-01" }, "2026-10-17")).toBe("overdue");
    expect(immunisationState({ ...base, dueDate: "2026-11-01" }, "2026-10-17")).toBe("due");
    expect(immunisationState({ ...base, dueDate: "2027-03-01" }, "2026-10-17")).toBe("scheduled");
  });
});

describe("helpers", () => {
  it("computes age correctly around birthdays", () => {
    expect(ageOn("2000-10-18", new Date(2026, 9, 17))).toBe(25);
    expect(ageOn("2000-10-17", new Date(2026, 9, 17))).toBe(26);
  });

  it("adds months without overflowing short months", () => {
    expect(toDateKey(addMonths(parseDateKey("2026-01-31"), 1))).toBe("2026-02-28");
  });

  it("knows share states", () => {
    const now = new Date("2026-10-17T12:00:00Z");
    expect(shareState({ expiresAt: "2026-10-18T00:00:00Z" }, now)).toBe("active");
    expect(shareState({ expiresAt: "2026-10-16T00:00:00Z" }, now)).toBe("expired");
    expect(shareState({ expiresAt: "2026-10-18T00:00:00Z", revokedAt: "2026-10-17T00:00:00Z" }, now)).toBe("revoked");
  });

  it("measures distance between Nairobi and Mombasa (~440 km)", () => {
    const km = distanceKm({ lat: -1.2921, lng: 36.8219 }, { lat: -4.0435, lng: 39.6682 });
    expect(km).toBeGreaterThan(420);
    expect(km).toBeLessThan(460);
  });
});

describe("lab groups", async () => {
  const { labGroupFor } = await import("./labs");
  it("puts tests under the headings clinicians use", () => {
    expect(labGroupFor("Haemoglobin", "Full blood count")).toBe("cbc");
    expect(labGroupFor("Neutrophils", "Differential Count (Dc)")).toBe("cbc");
    expect(labGroupFor("Creatinine", "Biochemistry")).toBe("ue");
    expect(labGroupFor("Bun/creatinine ratio", "Biochemistry")).toBe("ue");
    expect(labGroupFor("ALT", "Biochemistry")).toBe("lft");
    expect(labGroupFor("Globulin", "Biochemistry")).toBe("lft");
    expect(labGroupFor("Cholesterol/HDL ratio", "Lipid Profile I")).toBe("lipids");
    expect(labGroupFor("TSH", "Other tests")).toBe("tft");
    expect(labGroupFor("Estimated average glucose", "Diabetes (HbA1c)")).toBe("diabetes");
    expect(labGroupFor("RBC", "Microscopic Examination")).toBe("urine");
    expect(labGroupFor("CRP", "Other tests")).toBe("other");
    expect(labGroupFor("Transferrin saturation", "Iron studies")).toBe("iron");
  });
});
