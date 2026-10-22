import { describe, expect, it } from "vitest";
import { assess, bmi, bmiCategory, bpCategory, parseVitals } from "./vitals";
import { extractFromText } from "./extract/parse";

describe("vitals", () => {
  it("reads measurements written in letters", () => {
    expect(parseVitals("On examination: BP 138/86 mmHg, pulse 78, weight 82.5 kg, height 1.65 m, temp 37.2, SpO2 97%")).toEqual([
      { kind: "bp", value: 138, value2: 86 },
      { kind: "pulse", value: 78 },
      { kind: "weight", value: 82.5 },
      { kind: "height", value: 165 },
      { kind: "temperature", value: 37.2 },
      { kind: "spo2", value: 97 },
    ]);
    expect(parseVitals("Blood pressure: 152/96")[0]).toEqual({ kind: "bp", value: 152, value2: 96 });
  });
  it("ignores numbers that aren't believable", () => {
    expect(parseVitals("BP 1380/86")).toEqual([]);
    expect(parseVitals("Weight loss over 3 months")).toEqual([]);
    expect(parseVitals("Type 2 diabetes, HbA1c 7.3")).toEqual([]);
  });
  it("classifies readings", () => {
    expect(bpCategory(152, 96).label).toBe("High");
    expect(bpCategory(132, 82).label).toBe("High-normal");
    expect(bpCategory(118, 76).label).toBe("Normal");
    expect(bpCategory(185, 100).tone).toBe("high");
    expect(bmi(80, 165)).toBe(29.4);
    expect(bmiCategory(29.4).label).toBe("Overweight");
    expect(assess("spo2", 90)?.tone).toBe("high");
    expect(assess("waist", 94, undefined, "female")?.label).toBe("High risk");
  });
  it("documents carry their vitals into the extraction", () => {
    const e = extractFromText(["Uzima Family Clinic", "Date: 15/10/2026", "On examination: BP 138/86, pulse 78", "Diagnoses:", "Hypertension"], { facilities: [], profile: null });
    expect(e.vitals.map((v) => v.kind)).toEqual(["bp", "pulse"]);
    expect(e.conditions.map((c) => c.name)).toEqual(["Hypertension"]);
  });
});
