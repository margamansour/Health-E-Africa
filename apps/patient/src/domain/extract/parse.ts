import type { Facility, Profile, RecordCategory, Severity } from "@/db/types";
import { ANALYTES, FACILITY_WORDS, FREQUENCIES, OTC_MEDICINES, PRN, VACCINES } from "./dictionary";
import { addMonths, addDays, parseDateKey, toDateKey } from "@/lib/utils";
import { nearlySame } from "./fuzzy";
import { normaliseCondition, type ExtractedCondition } from "./diagnosis";
import { cleanSubstance, isAllergen } from "./allergen";
import { parseAction, type ExtractedAction } from "./actions";

export type { ExtractedAction };

export { normaliseCondition };

// ---------- Types ----------

export interface ExtractedLab {
  analyte: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  panel: string;
}

export type { ExtractedCondition };

export interface ExtractedMedication {
  name: string;
  dose: string;
  frequency: string;
  type: "repeat" | "acute";
  status: "active" | "stopped";
  prescriptionOnly: boolean;
  note?: string;
}

export interface ExtractedAllergy {
  substance: string;
  reaction?: string;
  severity: Severity;
}

export interface ExtractedImmunisation {
  vaccine: string;
  doseNumber: number;
  dateGiven?: string;
  batchNumber?: string;
}

export interface ExtractedFollowUp {
  title: string;
  date: string;
}

export interface Extraction {
  docType: RecordCategory;
  title: string;
  date?: string;
  facilityName?: string;
  facilityId?: string;
  patientName?: string;
  patientDob?: string;
  patientMatch: "match" | "mismatch" | "unknown";
  clinician?: string;
  registration?: string;
  signedText: boolean;
  noKnownAllergies: boolean;
  labs: ExtractedLab[];
  conditions: ExtractedCondition[];
  medications: ExtractedMedication[];
  allergies: ExtractedAllergy[];
  immunisations: ExtractedImmunisation[];
  followUps: ExtractedFollowUp[];
  /** Things to do: book a review, repeat a test, change a medicine, see a specialist. */
  actions: ExtractedAction[];
  notes?: string;
}

export interface ExtractContext {
  facilities: Pick<Facility, "id" | "name">[];
  profile?: Pick<Profile, "fullName" | "dob"> | null;
}

// ---------- Small helpers ----------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function validDate(y: number, m: number, d: number): string | undefined {
  if (y < 100) y += y < 50 ? 2000 : 1900;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return undefined;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1) return undefined;
  return toDateKey(dt);
}

/** Find the first date in a string. Numeric dates are read day-first, as in Kenya. */
export function findDate(s: string): string | undefined {
  let m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return validDate(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m) return validDate(+m[3]!, +m[2]!, +m[1]!);
  m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?[\s/.-]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?[\s/.-]+(\d{4}|\d{2})\b/i);
  if (m) return validDate(+m[3]!, MONTHS.indexOf(m[2]!.toLowerCase()) + 1, +m[1]!);
  m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[\s/.-]+(\d{1,2})(?:st|nd|rd|th)?,?[\s/.-]+(\d{4})\b/i);
  if (m) return validDate(+m[3]!, MONTHS.indexOf(m[1]!.toLowerCase()) + 1, +m[2]!);
  return undefined;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const capitalise = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());

/** Remove bullets and list numbering from the start of a line. */
function stripBullet(s: string) {
  return s.replace(/^\s*(?:[-•*·–>]+|\d{1,2}[.)])\s*/, "").trim();
}

/** Split a line into cells on "|" (column gaps) and clean each one. */
function cells(line: string) {
  const parts = line
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);
  // Re-attach values that sit in their own column after a "Label:" cell.
  const out: string[] = [];
  for (const p of parts) {
    const prev = out[out.length - 1];
    if (prev && (/:\s*$/.test(prev) || /^:/.test(p))) out[out.length - 1] = `${prev} ${p}`;
    else out.push(p);
  }
  return out;
}

// ---------- Sections ----------

type Section = "conditions" | "allergies" | "medications" | "immunisations" | "plan" | "gp" | "notes" | "other";

const SECTION_HEADINGS: [RegExp, Section][] = [
  [/^(diagnos[ie]s|diagnosis|dx|impression|assessment|problem list|problems|past medical history|pmh|active problems|medical history)\b/i, "conditions"],
  [/^(known\s+)?(drug\s+)?allerg(y|ies)\b/i, "allergies"],
  [/^((current|regular|discharge|repeat)\s+)?(medications?|medicines|drugs|treatment|rx|prescription)\b/i, "medications"],
  [/^(immuni[sz]ations?|vaccinations?|vaccines?( given)?)\b/i, "immunisations"],
  [/^(actions?\s+for\s+(the\s+)?(gp|general practitioner|family doctor|referring (doctor|clinician))|gp actions?|gp to\b|requests? (to|for) (the\s+)?gp|recommendations? (to|for) (the\s+)?gp)/i, "gp"],
  [/^(plan|follow[ -]?up|recommendations?|advice|management|actions?|to do|requests?|next steps|instructions)\b/i, "plan"],
  [/^(history of presenting (complaint|illness)|presenting complaint|hpi|social history|family history|examination|on examination|o\/e|observations|vital signs|vitals|investigations|results|procedures?( performed)?|clinical (details|summary|course)|hospital course|course in hospital|reason for (admission|referral|visit))\b/i, "other"],
  [/^(comments?|conclusion|summary|findings|clinical notes?)\b/i, "notes"],
];

interface SectionLine {
  section: Section;
  text: string;
}

/**
 * Tag each line with the section it belongs to. A heading may carry content on the same line,
 * e.g. "Dx: tonsillitis" or "Allergies: penicillin".
 */
function sectionise(lines: string[]): SectionLine[] {
  const out: SectionLine[] = [];
  let current: Section = "other";
  for (const raw of lines) {
    const line = stripBullet(raw.replace(/\s*\|\s*/g, " | ").trim());
    if (!line) continue;
    const plain = line.replace(/\s*\|\s*/g, " ");
    let matched = false;
    for (const [re, section] of SECTION_HEADINGS) {
      const m = plain.match(re);
      if (!m) continue;
      const rest = plain.slice(m[0].length);
      // A heading is short, or followed by ":" and content.
      if (/^\s*:/.test(rest) || rest.trim() === "" || plain.length < 32) {
        matched = true;
        const content = rest.replace(/^\s*:\s*/, "").trim();
        // An inline note like "On examination: chest clear" is skipped without ending the current section.
        if (section === "other" && content) break;
        current = section;
        if (content) out.push({ section, text: content });
      }
      break;
    }
    if (matched) continue;
    // Any other short "Heading:" line starts an unknown section.
    if (/^[A-Za-z][A-Za-z /&()]{2,30}:\s*$/.test(plain)) {
      current = "other";
      continue;
    }
    out.push({ section: current, text: line });
  }
  return out;
}

// ---------- Field extractors ----------

function documentDate(lines: string[]): string | undefined {
  const isDob = (l: string) => /\b(dob|d\.o\.b|date of birth|born|birth)\b/i.test(l);
  const labelled = (re: RegExp) => {
    for (const l of lines)
      for (const part of cells(l)) {
        if (isDob(part)) continue;
        const m = part.match(re);
        const d = m ? findDate(m[1]!) : undefined;
        if (d) return d;
      }
    return undefined;
  };
  return (
    // For results, the date the sample was taken matters most.
    labelled(/\b(?:collect(?:ion|ed)(?: date)?|sample (?:date|taken)|specimen date|date (?:collected|of collection))\s*:\s*(.+)$/i) ??
    labelled(/\b(?:date(?: of (?:report|issue|discharge|visit))?|registration date|reported|report date|date reported|reporting date|discharged)\s*:\s*(.+)$/i) ??
    // Otherwise the first date that isn't a date of birth or admission date.
    lines
      .flatMap((l) => cells(l))
      .filter((c) => !isDob(c) && !/\badmitted\b/i.test(c))
      .map((c) => findDate(c))
      .find(Boolean)
  );
}

function labelValue(lines: string[], label: RegExp, anywhere = false): string | undefined {
  for (const l of lines) {
    for (const part of cells(l)) {
      const m = part.match(new RegExp(`${anywhere ? "\\b" : "^"}(?:${label.source})\\s*:\\s*(.+)$`, "i"));
      if (m) return cutAtNextLabel(m[1]!);
    }
  }
  return undefined;
}

const FIELD_LABELS =
  /\s+(?:lab(?:oratory)?\s*no|sex|gender|age|dob|d\.o\.b|date(?:\s+of\s+birth)?|ward|bed|clinic\s*no|hospital\s*no|ip\s*no|op\s*no|mrn|id(?:\s*no)?|tel|phone|sha(?:\s*no)?|nhif(?:\s*no)?|ref(?:erence)?(?:\s*no)?|requested\s+by|collected|reported|patient\s*no)\.?\s*[:#].*$/i;

/** OCR text has no column breaks, so a value can run into the next "Label:" on the same line. */
function cutAtNextLabel(value: string) {
  let v = value.replace(FIELD_LABELS, "").trim();
  // Still contains another "Word:"? Cut there.
  v = v.replace(/\s+\S+\s*:.*$/, "").trim();
  return v;
}

function matchFacility(text: string, lines: string[], facilities: ExtractContext["facilities"]) {
  const hay = ` ${norm(text)} `;
  let best: { id: string; name: string } | undefined;
  for (const f of facilities) {
    const n = norm(f.name);
    // Names like "Root" or "Dr Mwangi" would match ordinary words or a doctor's name, so a name
    // must say what kind of place it is (clinic, hospital…) or be at least three words long.
    const specific = n.includes(" ") && (FACILITY_WORDS.test(f.name) || n.split(" ").length >= 3);
    if (specific && hay.includes(` ${n} `) && (!best || n.length > norm(best.name).length)) best = f;
  }
  if (best) return { facilityId: best.id, facilityName: best.name };
  const guess = lines
    .slice(0, 8)
    .map((l) => cells(l)[0] ?? "")
    .find((l) => FACILITY_WORDS.test(l) && l.length < 60 && !/:/.test(l));
  return { facilityId: undefined, facilityName: guess ? guess.trim() : undefined };
}

function patientMatch(name: string | undefined, dob: string | undefined, profile: ExtractContext["profile"]): Extraction["patientMatch"] {
  if (!profile) return "unknown";
  if (dob && profile.dob && dob !== profile.dob) return "mismatch";
  if (!name) return dob && dob === profile.dob ? "match" : "unknown";
  const want = norm(profile.fullName).split(" ").filter((t) => t.length > 1);
  const got = norm(name).split(" ").filter(Boolean);
  // Allow a misread letter in longer names (OCR of photos and handwriting).
  const overlap = want.filter((t) => got.some((g) => nearlySame(g, t))).length;
  if (overlap >= Math.min(2, want.length)) return "match";
  return overlap === 0 && got.length >= 2 ? "mismatch" : "unknown";
}

// ---------- Labs ----------

const ALIASES = ANALYTES.flatMap((a) => a.aliases.map((alias) => ({ alias, def: a }))).sort((x, y) => y.alias.length - x.alias.length);

/** Turn "250,000" or "13,5" or "<5" into a number. */
function toNumber(raw: string): number {
  const t = raw.replace(/[<>≤≥\s*]/g, "");
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return Number(t.replace(/,/g, ""));
  return Number(t.replace(",", "."));
}

function parseRange(s: string): { refLow?: number; refHigh?: number } {
  const t = s.replace(/(\d),(\d{3})\b/g, "$1$2");
  let m = t.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(-?\d+(?:\.\d+)?)/);
  if (m) return { refLow: +m[1]!, refHigh: +m[2]! };
  m = t.match(/(?:<|≤|less than|up to|below)\s*=?\s*(\d+(?:\.\d+)?)/i);
  if (m) return { refHigh: +m[1]! };
  m = t.match(/(?:>|≥|more than|above|greater than)\s*=?\s*(\d+(?:\.\d+)?)/i);
  if (m) return { refLow: +m[1]! };
  return {};
}

const VALUE_TOKEN = /^[<>≤≥]?\d{1,3}(?:,\d{3})+(?:\.\d+)?\*?$|^[<>≤≥]?\d+(?:[.,]\d+)?\*?$/;
const FLAG_TOKEN = /^(h|l|hh|ll|high|low|a|n|\*+|↑|↓|abn|abnormal|normal)$/i;
const UNIT_TOKEN = /^(?:x\s?10\S*|[a-zµμ%][a-zµμ%/^.\d³²·-]*|\/[a-zµμ][a-zµμ/^.\d³²-]*)$/i;
/** Words that start a line but are never test names. */
const NOT_A_TEST = /^(date|age|sex|lab|no|tel|phone|page|time|patient|name|sample|specimen|ref|dob|id|bp|blood pressure|weight|height|temp|pulse|collected|received|reported|printed|ward|bed|doctor|dr|clinic|invoice|amount|total amount|receipt)\b/i;

export interface LabParseOptions {
  /** Require a reference range (used outside lab reports, so prose isn't misread). */
  strict: boolean;
  /** Panel name to use for tests that aren't in the dictionary (the current section heading). */
  panel?: string;
}

/**
 * Read one table row of a lab report. Handles the common layouts:
 *   "Haemoglobin (Hb) | 13.5 | g/dL | 12.0 - 16.0"
 *   "HAEMOGLOBIN | 10.2 | L | g/dL | 11.5 - 15.5"   (flag before unit)
 *   "S. Creatinine 88 umol/L 62-106"
 *   "Platelets 250,000 /uL 150,000 - 450,000"
 * Tests not in the dictionary are kept when they have a value and a reference range.
 */
export function parseLabLine(line: string, opts: LabParseOptions): ExtractedLab | undefined {
  const tokens = line.replace(/\|/g, " | ").split(/\s+/).filter((t) => t && t !== "|");
  const vi = tokens.findIndex((t, i) => i > 0 && VALUE_TOKEN.test(t));
  if (vi < 1) return undefined;
  const nameRaw = tokens
    .slice(0, vi)
    .join(" ")
    .replace(/^[^a-z0-9(]+/i, "")
    .replace(/\s+([,/])/g, "$1")
    .replace(/[\s:,/\-–]+$/, "")
    .trim();
  if (nameRaw.length < 2 || nameRaw.length > 48 || NOT_A_TEST.test(nameRaw) || !/[a-z]/i.test(nameRaw)) return undefined;
  if (nameRaw.split(" ").length > 6) return undefined;
  const value = toNumber(tokens[vi]!);
  if (Number.isNaN(value)) return undefined;

  const rest = tokens.slice(vi + 1);
  let unit = "";
  for (const t of rest.slice(0, 3)) {
    if (FLAG_TOKEN.test(t)) continue;
    if (VALUE_TOKEN.test(t) || /^[<>≤≥(\[-]/.test(t)) break;
    if (UNIT_TOKEN.test(t) && t.length <= 16) unit = t;
    break;
  }
  const range = parseRange(rest.join(" "));
  const hasRange = range.refLow != null || range.refHigh != null;

  // Known test? Look for an alias anywhere in the name, including "(Hb)"-style abbreviations.
  const lowerName = ` ${nameRaw.toLowerCase().replace(/[().,:\[\]]/g, " ").replace(/\s+/g, " ")} `;
  // Ratios and derived values ("BUN/Creatinine ratio") are tests in their own right, not the test they mention.
  const derived = /\bratio\b|\bindex\b/.test(lowerName);
  // Urine and stool tests share names with blood tests (RBC, glucose, protein): keep them separate.
  const nonBlood = /urin|microscop|physical exam|chemical exam|stool|faec/i.test(opts.panel ?? "");
  const hit = derived || nonBlood ? undefined : ALIASES.find(({ alias }) => new RegExp(`[^a-z0-9]${escapeRe(alias)}[^a-z0-9]`).test(lowerName));
  if (opts.strict && !hasRange) return undefined;
  if (!hit && !hasRange) return undefined;

  const cleaned = nameRaw
    .replace(/\s*\([^)]*\)\s*/g, " ")
    // Sample type after the name: "Globulin, Serum", "Absolute basophil count, EDTA Blood"
    .replace(/,\s*(serum|plasma|fluoride plasma|edta( whole)? blood|whole blood|blood|urine|random urine)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const analyte = hit
    ? hit.def.name
    : /^ph$/i.test(cleaned)
      ? "pH"
      : cleaned === cleaned.toUpperCase() && cleaned.length > 5
        ? capitalise(titleCase(cleaned).toLowerCase())
        : capitalise(cleaned);
  return {
    analyte,
    value,
    unit: unit.replace(/^u(?=mol|g\b|g\/)/i, "µ"),
    ...range,
    panel: hit ? hit.def.panel : opts.panel ?? "Other tests",
  };
}

/** Lines like "HAEMATOLOGY" or "Lipid Profile" that name the panel of the rows below. */
function panelHeading(line: string): string | undefined {
  const plain = line.replace(/\s*\|\s*/g, " ").replace(/:$/, "").trim();
  if (plain.length < 4 || plain.length > 40 || /\d/.test(plain)) return undefined;
  if (/\b(test|result|unit|range|flag|reference|patient|name|date|report)\b/i.test(plain)) return undefined;
  // Capitals alone isn't enough: package names like "HEALTHSECUREPACKAGE" aren't panels.
  const isCaps = plain === plain.toUpperCase() && /[A-Z]{4,}/.test(plain) && plain.includes(" ") && plain.length <= 28;
  // Method labels sit where headings do ("FLOWCYTOMETRY BY LASER", "SPECTROPHOTOMETRIC").
  if (/flowcytometr|spectrophotometr|colorimetr|nephelometr|hexokinase|hplc|biochemical|immunoassay|clia|eclia|\bby\b|method/i.test(plain)) return undefined;
  const isPanel = /(haematology|hematology|biochemistry|chemistry|profile|function|count|panel|serology|immunology|hormones?|electrolytes|urinalysis|lipids?|thyroid|vitamins?|iron studies|diabetes|tests)$/i.test(plain);
  return isCaps || isPanel ? titleCase(plain) : undefined;
}

// ---------- Conditions ----------

// ---------- Medicines ----------

const MED_LINE =
  /^(?:(start|started|continue|continued|commence|add|added|increase|increased|reduce|reduced|stop|stopped|discontinue|discontinued)\s+)?([A-Za-z][A-Za-z\-/ ]*?[A-Za-z])\s+(\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?)?\s?(?:mg|g|mcg|µg|ug|ml|iu|units?|%))(?![a-z])\s*(.*)$/i;

export function parseMedication(line: string): ExtractedMedication | undefined {
  const text = stripBullet(line.replace(/^\s*rx\s*:?\s*/i, "")).replace(/\s*\|\s*/g, " ");
  const m = text.match(MED_LINE);
  if (!m) return undefined;
  const verb = (m[1] ?? "").toLowerCase();
  const name = m[2]!.trim();
  if (name.split(" ").length > 4 || /^(dose|take|give|of)$/i.test(name)) return undefined;
  const dose = m[3]!.replace(/\s+/g, " ").replace(/(\d)(mg|g|mcg|ml)/i, "$1 $2");
  const rest = m[4] ?? "";
  const freq = FREQUENCIES.find(([re]) => re.test(rest))?.[1] ?? "";
  const prn = PRN.test(rest);
  const frequency = [freq, prn ? (freq ? "when needed" : "When needed") : ""].filter(Boolean).join(", ");
  const acute = /\b(x\s?\d+\s*(day|d)s?|for\s+\d+\s*days?|\d+\s*days?\s+course|stat)\b/i.test(rest);
  const stopped = /^(stop|stopped|discontinue|discontinued)$/.test(verb) || /\b(stopped|discontinued)\b/i.test(rest);
  const note = rest.match(/\(([^)]+)\)/)?.[1];
  const lowerName = name.toLowerCase();
  return {
    name: titleCase(name).replace(/-([a-z])/g, (_, c: string) => `-${c}`),
    dose,
    frequency,
    type: acute ? "acute" : "repeat",
    status: stopped ? "stopped" : "active",
    prescriptionOnly: !OTC_MEDICINES.some((o) => lowerName.includes(o)),
    note,
  };
}

// ---------- Allergies ----------

function parseAllergy(item: string): ExtractedAllergy | undefined {
  const text = item.trim();
  if (!text || /\b(nkda|no known|none|nil)\b/i.test(text)) return undefined;
  const paren = text.match(/^(.+?)\s*\((.+)\)\s*$/);
  const dash = text.match(/^(.+?)\s+[-–:]\s+(.+)$/);
  const substance = cleanSubstance(paren?.[1] ?? dash?.[1] ?? text);
  const reaction = (paren?.[2] ?? dash?.[2])?.trim();
  // Only real substances (medicines, foods, stings…), never headings or notes like "Actions for GP".
  if (!isAllergen(substance)) return undefined;
  const all = `${substance} ${reaction ?? ""}`;
  const severity: Severity = /anaphyla|severe|swelling of (the )?(face|throat|tongue)/i.test(all) ? "severe" : /\bmild\b/i.test(all) ? "mild" : "moderate";
  return { substance: capitalise(substance), reaction: reaction ? capitalise(reaction) : undefined, severity };
}

// ---------- Immunisations ----------

function parseImmunisation(line: string, docDate?: string): ExtractedImmunisation | undefined {
  const lower = line.toLowerCase();
  const def = VACCINES.find((v) => v.keywords.some((k) => lower.includes(k)));
  if (!def) return undefined;
  const dose = Number(lower.match(/dose\s*(\d)/)?.[1] ?? lower.match(/(\d)(?:st|nd|rd|th)\s+dose/)?.[1] ?? 1);
  const batch = line.match(/batch(?:\s*(?:no\.?|number))?\s*:?\s*([A-Z0-9-]{3,})/i)?.[1];
  const given = /\b(given|administered|received)\b/i.test(line);
  const date = findDate(line) ?? (given ? docDate : undefined);
  return { vaccine: def.name, doseNumber: dose, dateGiven: given || date ? date : undefined, batchNumber: batch };
}

// ---------- Follow-ups ----------

function parseFollowUp(line: string, docDate?: string): ExtractedFollowUp | undefined {
  const text = line.replace(/\s*\|\s*/g, " ").trim();
  const m = text.match(/^(.*?)\b(?:in|after|within)\s+(\d+|one|two|three|four|six)\s*(day|week|month|year)s?\b/i);
  if (!m || !/(review|follow|repeat|recheck|check|return|come back|see|visit|appointment|no better)/i.test(m[1]!)) {
    const explicit = text.match(/^(?:next (?:appointment|review|visit)|follow[ -]?up|review)\s*(?:on|:)?\s*(.+)$/i);
    const d = explicit ? findDate(explicit[1]!) : undefined;
    return d ? { title: "Follow-up appointment", date: d } : undefined;
  }
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, six: 6 };
  const n = Number.isNaN(Number(m[2])) ? words[m[2]!.toLowerCase()]! : Number(m[2]);
  const unit = m[3]!.toLowerCase();
  const base = docDate ? parseDateKey(docDate) : new Date();
  const date = unit === "day" ? addDays(base, n) : unit === "week" ? addDays(base, n * 7) : unit === "month" ? addMonths(base, n) : addMonths(base, n * 12);
  let title = m[1]!.replace(/[,.;:-]+\s*$/, "").trim();
  title = /^(review|follow[ -]?up)$/i.test(title) || !title ? "Review appointment" : capitalise(title.replace(/\s+if$/i, " if needed"));
  return { title, date: toDateKey(date) };
}

// ---------- Document type ----------

function classify(text: string, labCount: number, medCount: number): RecordCategory {
  const t = text.toLowerCase();
  if (/discharge summary|discharged on|date of discharge/.test(t)) return "discharge";
  if (labCount >= 3 || /laboratory report|lab no|reference range|haematology|biochemistry/.test(t)) return "lab";
  if (/x-?ray|ultrasound|ct scan|\bmri\b|radiolog|sonograph/.test(t)) return "radiology";
  if (/dear |yours (sincerely|faithfully)|referral|clinic (review )?letter/.test(t)) return "letter";
  if (/\brx\b|prescription|dispense/.test(t) || medCount > 0) return "prescription";
  return "other";
}

const TYPE_TITLES: Record<RecordCategory, string> = {
  lab: "Lab report",
  letter: "Clinic letter",
  radiology: "Radiology report",
  prescription: "Prescription",
  discharge: "Discharge summary",
  other: "Medical document",
};

// ---------- Main ----------

export function extractFromText(input: string | string[], ctx: ExtractContext): Extraction {
  const lines = (Array.isArray(input) ? input : input.split(/\r?\n/)).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const text = lines.join("\n");
  const date = documentDate(lines);
  const facility = matchFacility(text, lines, ctx.facilities);
  const patientName = labelValue(lines, /patient(?:'s)?\s*name|name of patient|patient|name/);
  const dobRaw = labelValue(lines, /dob|d\.o\.b\.?|date of birth/, true);
  const patientDob = dobRaw ? findDate(dobRaw) : undefined;

  const sectioned = sectionise(lines);
  // Is this a lab report? Either it says so, or several rows already read as results with ranges.
  const rowsWithRanges = lines.filter((l) => parseLabLine(l, { strict: true })).length;
  const looksLikeLab = rowsWithRanges >= 3 || /laborator|lab\s*no\b|reference|ref\.?\s*(range|interval)|normal (range|values)|haematology|hematology|biochemistry|specimen/i.test(text);

  const labs: ExtractedLab[] = [];
  const conditions: ExtractedCondition[] = [];
  const medications: ExtractedMedication[] = [];
  const allergies: ExtractedAllergy[] = [];
  const immunisations: ExtractedImmunisation[] = [];
  const followUps: ExtractedFollowUp[] = [];
  const actions: ExtractedAction[] = [];
  const addAction = (a: ExtractedAction | undefined) => {
    if (a && !actions.some((x) => x.text.toLowerCase() === a.text.toLowerCase())) actions.push(a);
  };
  const notes: string[] = [];
  let noKnownAllergies = false;

  let panel: string | undefined;
  for (const { section, text: line } of sectioned) {
    const plain = line.replace(/\s*\|\s*/g, " ");

    // Result rows can appear under any heading (e.g. after "Clinical diagnosis:"), so try them first.
    const heading = looksLikeLab ? panelHeading(line) : undefined;
    if (heading) {
      panel = heading;
      continue;
    }
    const lab = parseLabLine(line, { strict: !looksLikeLab, panel });
    if (lab) {
      if (!labs.some((l) => l.analyte === lab.analyte)) labs.push(lab);
      continue;
    }

    switch (section) {
      case "conditions":
        for (const part of plain.split(/;|,(?![^(]*\))(?=\s*[A-Z])/)) {
          const c = normaliseCondition(part);
          if (c && !conditions.some((x) => x.name === c.name)) conditions.push(c);
        }
        break;
      case "allergies":
        if (/\b(nkda|no known (drug )?allerg)/i.test(plain)) noKnownAllergies = true;
        for (const part of plain.split(/;|,(?![^(]*\))/)) {
          const a = parseAllergy(part);
          if (a && !allergies.some((x) => x.substance.toLowerCase() === a.substance.toLowerCase())) allergies.push(a);
        }
        break;
      case "medications":
      case "plan":
      case "gp": {
        // Every instruction in a plan becomes a to-do for the patient (or to take to their GP).
        if (section !== "medications") addAction(parseAction(plain, { forGp: section === "gp", docDate: date, findDate }));
        const med = parseMedication(plain);
        if (med) {
          if (!medications.some((x) => x.name.toLowerCase() === med.name.toLowerCase())) medications.push(med);
          // A medicine list that notes a change ("dose increased", "new", "stopped") is also something to act on.
          if (section === "medications" && /\b(new|start\w*|stop\w*|increas\w*|reduc\w*|decreas\w*|chang\w*|switch\w*)\b/i.test(plain))
            addAction({ kind: "medication", text: plain.replace(/^[-•*·–>\s]+/, "").trim(), forGp: false });
          break;
        }
        const f = parseFollowUp(plain, date);
        if (f) followUps.push(f);
        const imm = section === "medications" ? parseImmunisation(plain, date) : undefined;
        if (imm) immunisations.push(imm);
        break;
      }
      case "immunisations": {
        const imm = parseImmunisation(plain, date);
        if (imm) immunisations.push(imm);
        break;
      }
      case "notes":
        notes.push(plain);
        break;
      default: {
        // Outside a known section: handwritten notes often use "Rx" inline, and any line can hold a follow-up.
        const med = /^\s*rx\b/i.test(plain) ? parseMedication(plain) : undefined;
        if (med) {
          medications.push(med);
          break;
        }
        const f = parseFollowUp(plain, date);
        if (f) followUps.push(f);
      }
    }
  }

  // Follow-ups often span two lines ("Review if" / "no better in 3 days").
  for (let i = 0; i < sectioned.length - 1 && followUps.length === 0; i++) {
    const joined = `${sectioned[i]!.text} ${sectioned[i + 1]!.text}`.replace(/\s*\|\s*/g, " ");
    const f = parseFollowUp(joined.replace(/^.*?\.\s+(?=\w)/, ""), date);
    if (f) followUps.push(f);
  }

  const signedText = /\b(signature|signed|verified by|electronically signed|digitally signed|authori[sz]ed by)\b/i.test(text);
  // The person who signed or verified the document, rather than the requesting doctor.
  const signer = labelValue(lines, /verified by|reported by|signed by|authori[sz]ed by|checked by/)?.split(",")[0];
  const doctors = [...text.matchAll(/\b(Dr\.?\s+[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3})/g)]
    .map((m) => m[1]!)
    .filter((d) => !lines.some((l) => /requested by|referred by|ordered by/i.test(l) && l.includes(d)));
  const clinician = signer ?? doctors[doctors.length - 1];
  const regs = [...text.matchAll(/\b(KMPDC|KMLTTB|PPB|NCK|COC)\b[^\n|]{0,24}?\b(?:reg(?:istration)?\.?\s*(?:no\.?|number)?\s*:?\s*)([A-Z]{0,3}[/-]?\d{3,}|[A-Z]\d{3,})/gi)];
  const registration = regs[0] ? `${regs[0][1]!.toUpperCase()} ${regs[0][2]}` : undefined;

  const docType = classify(text, labs.length, medications.length);
  const titleBase = TYPE_TITLES[docType];

  return {
    docType,
    title: facility.facilityName ? `${titleBase} — ${facility.facilityName}` : titleBase,
    date,
    ...facility,
    patientName,
    patientDob,
    patientMatch: patientMatch(patientName, patientDob, ctx.profile),
    clinician: clinician?.trim(),
    registration,
    signedText,
    noKnownAllergies,
    labs,
    conditions,
    medications,
    allergies,
    immunisations,
    followUps: followUps.filter((f, i, arr) => arr.findIndex((x) => x.title === f.title) === i),
    actions,
    notes: notes.length ? notes.join(" ") : undefined,
  };
}

export function extractionCount(e: Extraction) {
  return e.labs.length + e.conditions.length + e.medications.length + e.allergies.length + e.immunisations.length + e.followUps.length + e.actions.length;
}
