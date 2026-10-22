/**
 * Vital signs and body measurements: blood pressure, pulse, weight, height (for BMI),
 * temperature, oxygen level and waist. Ranges are for adults; they're guides, not diagnoses.
 */

export type VitalKind = "bp" | "pulse" | "weight" | "height" | "temperature" | "spo2" | "waist";

export interface VitalDef {
  kind: VitalKind;
  label: string;
  unit: string;
  /** Believable values, to catch typing and reading mistakes. */
  plausible: [number, number];
  /** For blood pressure: the second number (diastolic). */
  plausible2?: [number, number];
  step: number;
}

export const VITALS: Record<VitalKind, VitalDef> = {
  bp: { kind: "bp", label: "Blood pressure", unit: "mmHg", plausible: [60, 260], plausible2: [30, 160], step: 1 },
  pulse: { kind: "pulse", label: "Pulse", unit: "bpm", plausible: [25, 220], step: 1 },
  weight: { kind: "weight", label: "Weight", unit: "kg", plausible: [2, 350], step: 0.1 },
  height: { kind: "height", label: "Height", unit: "cm", plausible: [40, 230], step: 0.5 },
  temperature: { kind: "temperature", label: "Temperature", unit: "°C", plausible: [32, 43], step: 0.1 },
  spo2: { kind: "spo2", label: "Oxygen level (SpO₂)", unit: "%", plausible: [50, 100], step: 1 },
  waist: { kind: "waist", label: "Waist", unit: "cm", plausible: [40, 200], step: 0.5 },
};

export const VITAL_ORDER: VitalKind[] = ["bp", "pulse", "weight", "height", "temperature", "spo2", "waist"];

export type Tone = "good" | "watch" | "high" | "low";

export interface Assessment {
  label: string;
  tone: Tone;
}

/** Blood pressure category (adult, clinic reading). Based on Kenya's hypertension guidelines. */
export function bpCategory(sys: number, dia: number): Assessment {
  if (sys >= 180 || dia >= 120) return { label: "Very high: seek care today", tone: "high" };
  if (sys >= 140 || dia >= 90) return { label: "High", tone: "high" };
  if (sys >= 130 || dia >= 85) return { label: "High-normal", tone: "watch" };
  if (sys < 90 || dia < 60) return { label: "Low", tone: "low" };
  return { label: "Normal", tone: "good" };
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(v: number): Assessment {
  if (v < 18.5) return { label: "Underweight", tone: "low" };
  if (v < 25) return { label: "Healthy weight", tone: "good" };
  if (v < 30) return { label: "Overweight", tone: "watch" };
  return { label: "Obese", tone: "high" };
}

/** How a single reading compares with the usual adult range. */
export function assess(kind: VitalKind, value: number, value2?: number, sex?: "female" | "male"): Assessment | undefined {
  switch (kind) {
    case "bp":
      return value2 != null ? bpCategory(value, value2) : undefined;
    case "pulse":
      return value > 100 ? { label: "Fast", tone: "high" } : value < 50 ? { label: "Slow", tone: "low" } : { label: "Normal", tone: "good" };
    case "temperature":
      return value >= 38 ? { label: "Fever", tone: "high" } : value < 35.5 ? { label: "Low", tone: "low" } : { label: "Normal", tone: "good" };
    case "spo2":
      return value < 92 ? { label: "Low: seek care", tone: "high" } : value < 95 ? { label: "Slightly low", tone: "watch" } : { label: "Normal", tone: "good" };
    case "waist": {
      // Waist size linked to higher risk of diabetes and heart disease.
      const limit = sex === "male" ? 102 : 88;
      const watch = sex === "male" ? 94 : 80;
      return value >= limit ? { label: "High risk", tone: "high" } : value >= watch ? { label: "Raised", tone: "watch" } : { label: "Healthy", tone: "good" };
    }
    default:
      return undefined;
  }
}

export function formatVital(kind: VitalKind, value: number, value2?: number): string {
  if (kind === "bp" && value2 != null) return `${Math.round(value)}/${Math.round(value2)}`;
  return String(Math.round(value * 10) / 10);
}

export function isPlausible(kind: VitalKind, value: number, value2?: number): boolean {
  const d = VITALS[kind];
  if (value < d.plausible[0] || value > d.plausible[1]) return false;
  if (kind === "bp") return value2 != null && value2 >= d.plausible2![0] && value2 <= d.plausible2![1] && value > value2;
  return true;
}

export interface ExtractedVital {
  kind: VitalKind;
  value: number;
  value2?: number;
}

/** Read vital signs written in a document line, e.g. "BP 138/86 mmHg, pulse 78, weight 82 kg". */
export function parseVitals(line: string): ExtractedVital[] {
  const out: ExtractedVital[] = [];
  const text = line.replace(/\s+/g, " ");
  const num = "(\\d{1,3}(?:[.,]\\d{1,2})?)";
  const push = (v: ExtractedVital) => {
    if (isPlausible(v.kind, v.value, v.value2) && !out.some((x) => x.kind === v.kind)) out.push(v);
  };
  const bp = text.match(/\b(?:bp|b\/p|blood pressure)\b[^0-9]{0,12}(\d{2,3})\s*\/\s*(\d{2,3})/i);
  if (bp) push({ kind: "bp", value: Number(bp[1]), value2: Number(bp[2]) });
  const rules: [VitalKind, RegExp][] = [
    ["pulse", new RegExp(`\\b(?:pulse|pr|hr|heart rate)\\b[^0-9]{0,8}${num}`, "i")],
    ["weight", new RegExp(`\\b(?:weight|wt)\\b[^0-9]{0,8}${num}\\s*(?:kg|kgs)?`, "i")],
    ["height", new RegExp(`\\b(?:height|ht)\\b[^0-9]{0,8}${num}\\s*(cm|m)?\\b`, "i")],
    ["temperature", new RegExp(`\\b(?:temp|temperature|t)\\b[^0-9]{0,8}${num}\\s*(?:°|deg)?\\s*c?\\b`, "i")],
    ["spo2", new RegExp(`\\b(?:spo2|sp02|o2 sat\\w*|oxygen saturation|sats?)\\b[^0-9]{0,8}${num}\\s*%?`, "i")],
    ["waist", new RegExp(`\\b(?:waist(?: circumference)?)\\b[^0-9]{0,8}${num}\\s*cm`, "i")],
  ];
  for (const [kind, re] of rules) {
    const m = text.match(re);
    if (!m) continue;
    let value = Number(m[1]!.replace(",", "."));
    // Height written in metres (1.65 m) → centimetres.
    if (kind === "height" && (m[2]?.toLowerCase() === "m" || value < 3)) value = Math.round(value * 100);
    push({ kind, value });
  }
  return out;
}
