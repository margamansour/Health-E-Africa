import { describe, expect, it } from "vitest";
import { normUnit, standardise } from "./units";

describe("unit standardisation", () => {
  it("converts cholesterol mg/dL to mmol/L, with its range", () => {
    const s = standardise("Total cholesterol", 200.88, "mg/dl", undefined, 200);
    expect(s).toMatchObject({ value: 5.19, unit: "mmol/L", refHigh: 5.17, originalValue: 200.88, originalUnit: "mg/dl", standard: true });
  });
  it("leaves results already in the standard unit alone", () => {
    const s = standardise("Total cholesterol", 6, "mmol/L", undefined, 5.2);
    expect(s).toMatchObject({ value: 6, unit: "mmol/L", refHigh: 5.2 });
    expect(s.originalValue).toBeUndefined();
  });
  it("handles the common conversions", () => {
    expect(standardise("Creatinine", 1.04, "mg/dl").value).toBe(92);
    expect(standardise("Fasting glucose", 148, "mg/dl").value).toBe(8.21);
    expect(standardise("Haemoglobin", 10, "gms/dl")).toMatchObject({ value: 10, unit: "g/dL" });
    expect(standardise("Haemoglobin", 114, "g/L").value).toBe(11.4);
    expect(standardise("Albumin", 3.46, "g/dl").value).toBe(34.6);
    expect(standardise("Serum iron", 29.02, "µg/dL").value).toBe(5.2);
    expect(standardise("Triglycerides", 94.78, "mg/dl").value).toBe(1.07);
    expect(standardise("Bilirubin", 0.29, "mg/dl").value).toBe(4.96);
    expect(standardise("TSH", 2.33, "uIU/ml")).toMatchObject({ value: 2.33, unit: "mIU/L" });
    expect(standardise("HbA1c", 53, "mmol/mol").value).toBe(7);
    expect(standardise("White cell count", 6100, "/cumm").value).toBe(6.1);
  });
  it("guesses a missing unit from the size of the value", () => {
    expect(standardise("Total cholesterol", 200, "")).toMatchObject({ value: 5.17, unit: "mmol/L" });
    expect(standardise("Total cholesterol", 5.2, "")).toMatchObject({ value: 5.2, unit: "mmol/L" });
    expect(standardise("Platelets", 345, "")).toMatchObject({ value: 345, unit: "x10^9/L" });
  });
  it("keeps tests it can't convert as reported", () => {
    expect(standardise("Mystery test", 3, "zz")).toMatchObject({ value: 3, unit: "zz", standard: false });
  });
  it("normalises unit spellings", () => {
    expect(normUnit("µmol/L")).toBe("umol/l");
    expect(normUnit("x10³/µL")).toBe("x10^3/ul");
    expect(normUnit("mL/min/1.73m²")).toBe("ml/min/1.73m2");
  });
});
