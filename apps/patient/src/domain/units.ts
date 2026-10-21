/**
 * Standard units for lab results, so trends compare like with like (e.g. cholesterol 5.2 mmol/L,
 * never 200.88 mg/dL next to 6 mmol/L). We use the SI units most Kenyan laboratories report.
 *
 * Conversion factors are the standard clinical-chemistry ones. Clinicians should review this table.
 */

type Convert = number | { to: (v: number) => number };

interface UnitRule {
  /** Unit everything is converted to. */
  unit: string;
  /** Other units (normalised, see `normUnit`) → how to convert to `unit`. 1 = same quantity. */
  from: Record<string, Convert>;
  /** Range of believable values in the standard unit, used to guess a missing or unreadable unit. */
  plausible: [number, number];
}

const same = 1;
const COUNT_9 = { "x10^9/l": same, "x10^3/ul": same, "10^3/ul": same, "10^9/l": same, "k/ul": same, "thou/ul": same, "x10^3/mm3": same, "/ul": 0.001, "cells/ul": 0.001, "/mm3": 0.001 };

const RULES: Record<string, UnitRule> = {
  // CBC
  Haemoglobin: { unit: "g/dL", from: { "g/dl": same, "g/l": 0.1, "mmol/l": 1.611 }, plausible: [3, 25] },
  "White cell count": { unit: "x10^9/L", from: COUNT_9, plausible: [0.1, 200] },
  Platelets: { unit: "x10^9/L", from: COUNT_9, plausible: [5, 2000] },
  "Red cell count": { unit: "x10^12/L", from: { "x10^12/l": same, "x10^6/ul": same, "10^6/ul": same, "million/ul": same, "m/ul": same, "x10^6/mm3": same }, plausible: [1, 9] },
  Haematocrit: { unit: "%", from: { "%": same, "l/l": 100 }, plausible: [10, 75] },
  MCV: { unit: "fL", from: { fl: same, um3: same }, plausible: [50, 130] },
  MCH: { unit: "pg", from: { pg: same }, plausible: [15, 45] },
  MCHC: { unit: "g/dL", from: { "g/dl": same, "g/l": 0.1 }, plausible: [20, 45] },
  RDW: { unit: "%", from: { "%": same }, plausible: [8, 30] },
  "Mean platelet volume": { unit: "fL", from: { fl: same }, plausible: [4, 20] },
  // Diabetes
  HbA1c: { unit: "%", from: { "%": same, "mmol/mol": { to: (v) => v / 10.929 + 2.15 } }, plausible: [3, 20] },
  "Fasting glucose": { unit: "mmol/L", from: { "mmol/l": same, "mg/dl": 1 / 18.016 }, plausible: [1, 40] },
  "Random glucose": { unit: "mmol/L", from: { "mmol/l": same, "mg/dl": 1 / 18.016 }, plausible: [1, 40] },
  "Estimated average glucose": { unit: "mmol/L", from: { "mmol/l": same, "mg/dl": 1 / 18.016 }, plausible: [2, 40] },
  // Lipids
  "Total cholesterol": { unit: "mmol/L", from: { "mmol/l": same, "mg/dl": 1 / 38.67 }, plausible: [1, 20] },
  "LDL cholesterol": { unit: "mmol/L", from: { "mmol/l": same, "mg/dl": 1 / 38.67 }, plausible: [0.2, 15] },
  "HDL cholesterol": { unit: "mmol/L", from: { "mmol/l": same, "mg/dl": 1 / 38.67 }, plausible: [0.1, 5] },
  Triglycerides: { unit: "mmol/L", from: { "mmol/l": same, "mg/dl": 1 / 88.57 }, plausible: [0.1, 30] },
  // Kidney / U&Es
  Creatinine: { unit: "µmol/L", from: { "umol/l": same, "mg/dl": 88.42 }, plausible: [10, 2000] },
  Urea: { unit: "mmol/L", from: { "mmol/l": same, "mg/dl": 0.1665 }, plausible: [0.5, 60] },
  "Blood urea nitrogen": { unit: "mmol/L", from: { "mmol/l": same, "mg/dl": 0.357 }, plausible: [0.5, 60] },
  Sodium: { unit: "mmol/L", from: { "mmol/l": same, "meq/l": same }, plausible: [100, 180] },
  Potassium: { unit: "mmol/L", from: { "mmol/l": same, "meq/l": same }, plausible: [1, 10] },
  Chloride: { unit: "mmol/L", from: { "mmol/l": same, "meq/l": same }, plausible: [70, 140] },
  Bicarbonate: { unit: "mmol/L", from: { "mmol/l": same, "meq/l": same }, plausible: [5, 50] },
  eGFR: { unit: "mL/min/1.73m²", from: { "ml/min/1.73m2": same, "ml/min": same, "ml/min/": same }, plausible: [2, 200] },
  "Uric acid": { unit: "µmol/L", from: { "umol/l": same, "mg/dl": 59.48 }, plausible: [50, 1500] },
  Calcium: { unit: "mmol/L", from: { "mmol/l": same, "mg/dl": 0.2495 }, plausible: [1, 5] },
  // Liver
  ALT: { unit: "U/L", from: { "u/l": same, "iu/l": same, "ukat/l": 60 }, plausible: [1, 5000] },
  AST: { unit: "U/L", from: { "u/l": same, "iu/l": same, "ukat/l": 60 }, plausible: [1, 5000] },
  ALP: { unit: "U/L", from: { "u/l": same, "iu/l": same, "ukat/l": 60 }, plausible: [5, 3000] },
  GGT: { unit: "U/L", from: { "u/l": same, "iu/l": same, "ukat/l": 60 }, plausible: [1, 3000] },
  Bilirubin: { unit: "µmol/L", from: { "umol/l": same, "mg/dl": 17.1 }, plausible: [1, 800] },
  Albumin: { unit: "g/L", from: { "g/l": same, "g/dl": 10 }, plausible: [10, 70] },
  "Total protein": { unit: "g/L", from: { "g/l": same, "g/dl": 10 }, plausible: [30, 120] },
  Globulin: { unit: "g/L", from: { "g/l": same, "g/dl": 10 }, plausible: [10, 80] },
  // Thyroid
  TSH: { unit: "mIU/L", from: { "miu/l": same, "uiu/ml": same, "mu/l": same }, plausible: [0.001, 150] },
  "Free T4": { unit: "pmol/L", from: { "pmol/l": same, "ng/dl": 12.87 }, plausible: [2, 100] },
  "Total T4": { unit: "nmol/L", from: { "nmol/l": same, "ug/dl": 12.87 }, plausible: [10, 400] },
  "Total T3": { unit: "nmol/L", from: { "nmol/l": same, "ng/ml": 1.536, "ng/dl": 0.01536 }, plausible: [0.2, 15] },
  // Iron
  "Serum iron": { unit: "µmol/L", from: { "umol/l": same, "ug/dl": 0.1791 }, plausible: [1, 80] },
  "Total iron binding capacity": { unit: "µmol/L", from: { "umol/l": same, "ug/dl": 0.1791 }, plausible: [10, 150] },
  "Transferrin saturation": { unit: "%", from: { "%": same }, plausible: [1, 100] },
  Ferritin: { unit: "µg/L", from: { "ug/l": same, "ng/ml": same }, plausible: [1, 10000] },
  // Vitamins
  "Vitamin D": { unit: "nmol/L", from: { "nmol/l": same, "ng/ml": 2.496 }, plausible: [5, 400] },
  "Vitamin B12": { unit: "pmol/L", from: { "pmol/l": same, "pg/ml": 0.738 }, plausible: [30, 2000] },
  // Other
  CRP: { unit: "mg/L", from: { "mg/l": same, "mg/dl": 10 }, plausible: [0, 500] },
  PSA: { unit: "µg/L", from: { "ug/l": same, "ng/ml": same }, plausible: [0, 1000] },
  "Viral load": { unit: "copies/mL", from: { "copies/ml": same, "cp/ml": same }, plausible: [0, 1e8] },
  "CD4 count": { unit: "cells/µL", from: { "cells/ul": same, "/ul": same, "cells/mm3": same, "/mm3": same }, plausible: [0, 3000] },
};

/** Spelling-neutral form of a unit: "gms/dl", "g/dL", "G/DL" → "g/dl"; "µmol/L", "umol/l" → "umol/l". */
export function normUnit(unit: string): string {
  return unit
    .toLowerCase()
    .replace(/[µμ]/g, "u")
    .replace(/\s+/g, "")
    .replace(/³/g, "3")
    .replace(/²/g, "2")
    .replace(/\*/g, "^")
    .replace(/^x?10\^?(\d)/, "x10^$1")
    .replace(/\b(gms?|gm)\b/g, "g")
    .replace(/\/(cumm|cmm|mm\^3)$/, "/mm3")
    .replace(/litre|liter|ltr/g, "l")
    .replace(/micromol/g, "umol")
    .replace(/^iu\//, "iu/")
    .replace(/^mmol\/mol$/, "mmol/mol");
}

export function standardUnit(analyte: string): string | undefined {
  return RULES[analyte]?.unit;
}

/** Round to a sensible number of decimals for display and storage. */
export function tidy(v: number): number {
  const a = Math.abs(v);
  const dp = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

export interface Standardised {
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  /** The value and unit as printed on the report, when they were converted. */
  originalValue?: number;
  originalUnit?: string;
  /** False when the unit couldn't be matched to the standard one (left as reported). */
  standard: boolean;
}

/**
 * Convert one result (and its reference range) to the standard unit for that test.
 * If the unit is missing or unreadable, the value's size decides (e.g. cholesterol 200 must be mg/dL).
 */
export function standardise(analyte: string, value: number, unit: string, refLow?: number, refHigh?: number): Standardised {
  const rule = RULES[analyte];
  if (!rule) return { value, unit, refLow, refHigh, standard: false };
  const key = normUnit(unit);
  let conv: Convert | undefined = rule.from[key];
  let fromUnit = unit;
  if (conv === undefined) {
    // Unit missing or not recognised: pick the unit that makes the value believable, preferring the standard one.
    const options = Object.entries(rule.from).sort(([a], [b]) => (a === normUnit(rule.unit) ? -1 : b === normUnit(rule.unit) ? 1 : 0));
    const hit = options.find(([, c]) => {
      const v = apply(c, value);
      return v >= rule.plausible[0] && v <= rule.plausible[1];
    });
    if (!hit) return { value, unit, refLow, refHigh, standard: false };
    conv = hit[1];
    fromUnit = unit || hit[0];
  }
  const changed = !(conv === 1) || unit !== rule.unit;
  const out: Standardised = {
    value: tidy(apply(conv, value)),
    unit: rule.unit,
    refLow: refLow == null ? undefined : tidy(apply(conv, refLow)),
    refHigh: refHigh == null ? undefined : tidy(apply(conv, refHigh)),
    standard: true,
  };
  if (changed && conv !== 1) {
    out.originalValue = value;
    out.originalUnit = fromUnit;
  }
  return out;
}

function apply(c: Convert, v: number) {
  return typeof c === "number" ? v * c : c.to(v);
}
