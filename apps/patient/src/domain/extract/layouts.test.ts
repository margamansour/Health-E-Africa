import { describe, expect, it } from "vitest";
import { extractFromText, findDate, parseLabLine } from "./parse";

// Layouts seen on real lab reports. All names and values here are made up.
const ctx = { facilities: [], profile: { fullName: "Amina Wanjiru", dob: "1974-03-12" } };

describe("lab report layouts", () => {
  it("reads a multi-section report with label/colon columns, flags before units and sample-type suffixes", () => {
    const lines = [
      "Name | : Mrs. AMINA WANJIRU | Lab File No. | : P000001",
      "Age / DOB | : 12/03/1974, 52 Y | Registration Date | : 24/01/2024 17:47",
      "Gender | : Female | Reporting Date | : 25/01/2024 04:29",
      "BIOCHEMISTRY",
      "Test | Result | Units | Reference Range | Methodology",
      "DEMOHEALTHPACKAGE",
      "Glomerular Filtration Rate- Estimated | 80 | L | mL/min/ | > 90 | SPECTROPHOTOMETRIC",
      "(eGFR), Serum | 1.73m2",
      "GLYCOSYLATED HEMOGLOBIN | 7.3 | H | % | Normal:4.5 - 5.6",
      "(HBA1C) | Prediabetic:5.7 - 6.4",
      "Diabetic: >6.5",
      "Creatinine, Serum | 1.04 | mg/dl | 0.72 - 1.18 | BIOCHEMICAL",
      "Total Iron Binding Capacity (TIBC), | 191.2 | L | ug/dl | 250 - 450",
      "Iron, Serum | 29.02 | L | µg/dL | 45 - 158",
      "BUN/CREATININE RATIO | 17 | Ratio | 9 - 20",
      "Glucose Fasting, Fluoride Plasma | 148 | H | mg/dl | 70 - 115",
      "Aspartate Aminotransferase / | 11.1 | U/L | <35",
      "Globulin, Serum | 3.9 | g/dl | 1.2 - 5.3",
      "Platelets | 250,000 | /uL | 150,000 - 450,000",
      "MICROSCOPIC EXAMINATION",
      "RBC | 3 | /hpf | 0 - 5",
      "Verified by :Dr. Jane Demo",
    ];
    const e = extractFromText(lines, ctx);
    const by = (n: string) => e.labs.find((l) => l.analyte === n);
    expect(e.docType).toBe("lab");
    expect(e.date).toBe("2024-01-24");
    expect(e.patientMatch).toBe("match");
    expect(by("eGFR")).toMatchObject({ value: 80, refLow: 90 });
    expect(by("HbA1c")).toMatchObject({ value: 7.3, unit: "%", refLow: 4.5, refHigh: 5.6 });
    expect(by("Creatinine")).toMatchObject({ value: 1.04, unit: "mg/dl" });
    expect(by("Total iron binding capacity")).toMatchObject({ value: 191.2, unit: "µg/dl" });
    expect(by("Serum iron")?.value).toBe(29.02);
    expect(by("Bun/creatinine ratio")?.value).toBe(17);
    expect(by("Fasting glucose")?.value).toBe(148);
    expect(by("AST")).toMatchObject({ value: 11.1, unit: "U/L", refHigh: 35 });
    expect(by("Globulin")?.value).toBe(3.9);
    expect(by("Platelets")).toMatchObject({ value: 250000, refLow: 150000, refHigh: 450000 });
    // Urine RBCs are not the blood red cell count.
    expect(by("RBC")?.panel).toBe("Microscopic Examination");
    expect(by("Red cell count")).toBeUndefined();
    expect(e.clinician).toBe("Dr. Jane Demo");
  });

  it("reads results that follow a clinical diagnosis line", () => {
    const e = extractFromText(["Clinical diagnosis: T2DM", "HbA1c 8.2 % 4.0 - 6.0", "Ferritin 12 ng/mL 15 - 150", "Vitamin D 18 ng/mL 30 - 100"], ctx);
    expect(e.labs.map((l) => l.analyte)).toEqual(["HbA1c", "Ferritin", "Vitamin D"]);
  });

  it("ignores lines that aren't results", () => {
    for (const l of ["Age / DOB : 20/12/1958, 65 Y", "License No : 64372628", "Printed on: 25/01/2024 08:29", "Diabetic: >6.5", "Phone +254 4 263 2993"]) {
      expect(parseLabLine(l, { strict: false })).toBeUndefined();
    }
  });

  it("reads dates written with hyphens or month names", () => {
    expect(findDate("24-Jan-2024")).toBe("2024-01-24");
    expect(findDate("24 January 2024")).toBe("2024-01-24");
    expect(findDate("Jan 24, 2024")).toBe("2024-01-24");
  });
});
