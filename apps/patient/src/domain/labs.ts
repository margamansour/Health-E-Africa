import type { LabResult } from "@/db/types";

export type Flag = "low" | "high" | "normal" | "unknown";

export function flagFor(r: Pick<LabResult, "value" | "refLow" | "refHigh">): Flag {
  if (r.refLow == null && r.refHigh == null) return "unknown";
  if (r.refLow != null && r.value < r.refLow) return "low";
  if (r.refHigh != null && r.value > r.refHigh) return "high";
  return "normal";
}

export interface AnalyteTemplate {
  analyte: string;
  unit: string;
  refLow?: number;
  refHigh?: number;
}

/** Common panels with typical adult reference ranges (labs vary — the lab's own range wins). */
export const PANEL_TEMPLATES: Record<string, AnalyteTemplate[]> = {
  "Full blood count": [
    { analyte: "Haemoglobin", unit: "g/dL", refLow: 12, refHigh: 17 },
    { analyte: "White cell count", unit: "x10^9/L", refLow: 4, refHigh: 11 },
    { analyte: "Platelets", unit: "x10^9/L", refLow: 150, refHigh: 400 },
    { analyte: "MCV", unit: "fL", refLow: 80, refHigh: 100 },
  ],
  "Diabetes (HbA1c)": [{ analyte: "HbA1c", unit: "%", refLow: 4, refHigh: 5.7 }],
  "Fasting blood sugar": [{ analyte: "Fasting glucose", unit: "mmol/L", refLow: 3.9, refHigh: 5.6 }],
  "Lipid profile": [
    { analyte: "Total cholesterol", unit: "mmol/L", refHigh: 5.2 },
    { analyte: "LDL cholesterol", unit: "mmol/L", refHigh: 3.4 },
    { analyte: "HDL cholesterol", unit: "mmol/L", refLow: 1.0 },
    { analyte: "Triglycerides", unit: "mmol/L", refHigh: 1.7 },
  ],
  "Kidney function (U&E)": [
    { analyte: "Creatinine", unit: "µmol/L", refLow: 45, refHigh: 110 },
    { analyte: "Urea", unit: "mmol/L", refLow: 2.5, refHigh: 7.8 },
    { analyte: "Sodium", unit: "mmol/L", refLow: 135, refHigh: 145 },
    { analyte: "Potassium", unit: "mmol/L", refLow: 3.5, refHigh: 5.1 },
    { analyte: "eGFR", unit: "mL/min/1.73m²", refLow: 60 },
  ],
  "Liver function": [
    { analyte: "ALT", unit: "U/L", refHigh: 40 },
    { analyte: "AST", unit: "U/L", refHigh: 40 },
    { analyte: "ALP", unit: "U/L", refLow: 40, refHigh: 130 },
    { analyte: "Bilirubin", unit: "µmol/L", refHigh: 21 },
    { analyte: "Albumin", unit: "g/L", refLow: 35, refHigh: 50 },
  ],
  "Thyroid function": [
    { analyte: "TSH", unit: "mIU/L", refLow: 0.4, refHigh: 4.0 },
    { analyte: "Free T4", unit: "pmol/L", refLow: 12, refHigh: 22 },
  ],
  "HIV viral load": [{ analyte: "Viral load", unit: "copies/mL", refHigh: 50 }],
};

export interface ParsedRow {
  analyte: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: string[];
}

/**
 * Parse pasted results. One per line, comma/tab/semicolon separated:
 *   Analyte, value, unit, low, high
 * Also accepts a range in one column: "Haemoglobin, 13.2, g/dL, 12-17".
 * A header line is skipped.
 */
export function parseResultsText(text: string): ParseResult {
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const cols = line.split(/\t|;|,/).map((c) => c.trim());
    if (i === 0 && /analyte|test|name/i.test(cols[0] ?? "") && isNaN(Number(cols[1]))) return;
    const [analyte, rawValue, unit = "", c4, c5] = cols;
    const value = Number((rawValue ?? "").replace(/[<>]/g, ""));
    if (!analyte || !rawValue || Number.isNaN(value)) {
      errors.push(`Line ${i + 1}: couldn't read "${line}"`);
      return;
    }
    let refLow: number | undefined;
    let refHigh: number | undefined;
    const range = c4?.match(/^\s*(-?[\d.]+)\s*[-–]\s*(-?[\d.]+)\s*$/);
    if (range) {
      refLow = Number(range[1]);
      refHigh = Number(range[2]);
    } else {
      if (c4 && !Number.isNaN(Number(c4))) refLow = Number(c4);
      if (c5 && !Number.isNaN(Number(c5))) refHigh = Number(c5);
    }
    rows.push({ analyte, value, unit, refLow, refHigh });
  });
  return { rows, errors };
}
