import { CONDITIONS } from "./dictionary";
import { nearlySame } from "./fuzzy";

export interface ExtractedCondition {
  name: string;
  chronic: boolean;
  status: "active" | "resolved";
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const capitalise = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Not a confirmed diagnosis: a question, something to rule out, a screen, or a negative finding. */
const UNCERTAIN =
  /(\?|\b(query|queried|suspected|suspect|possible|probable|likely|r\/o|rule out|ruled out|to exclude|exclude|differential|ddx|screen(ing)?|for review|to check|investigat\w*|work[- ]?up)\b)/i;
const NEGATED = /^(no|not|nil|none|without|negative for|neg for|denies|absence of|free of|no evidence of|no signs of|no history of)\b/i;
/** About someone else, not the patient. */
const FAMILY = /\b(family history|fhx|fh of|mother|father|sister|brother|sibling|parents?)\b/i;

/**
 * Text that is never a diagnosis even when it sits under a "Diagnosis" or "Assessment" heading:
 * names and sign-offs, contact details, patient details, vital signs, examination findings,
 * plans and instructions.
 */
const NOT_DIAGNOSIS =
  /\b(dr|doctor|mr|mrs|ms|miss|prof|sister|nurse|clinician|consultant|signed|signature|regards|sincerely|yours|stamp|tel|phone|mobile|email|e-mail|fax|p\.?o\.? box|address|road|street|patient|name|age|sex|gender|dob|born|ward|bed|ip no|op no|file no|hospital no|ref|reference|date|time|bp|blood pressure|pulse|heart rate|hr|temp|temperature|resp|rr|spo2|sats|oxygen|weight|height|bmi|waist|exam\w*|on examination|o\/e|chest clear|abdomen|soft|non-tender|alert|oriented|well|stable|improving|improved|controlled|plan|review|follow[- ]?up|continue|start|stop|advised?|counsel\w*|refer\w*|admit\w*|discharg\w*|given|prescribed|repeat|return|come back|appointment|tests?|results?|level|count|normal|elevated|raised|low|high|positive|reactive|seen|thank|please)\b/i;

/** Word endings and words that mark a disease name (e.g. "-itis", "disease", "syndrome"). */
const DIAGNOSTIC_FORM =
  /([a-z]{3,}(itis|osis|iasis|aemia|emia|oma|pathy|plasia|trophy|ectasis)\b)|\b(disease|disorder|syndrome|infection|failure|insufficiency|deficiency|cancer|carcinoma|tumou?r|fracture|ulcer|hernia|stenosis|reflux|palsy|dementia|psychosis|sepsis|abscess|injury|dysfunction|anomaly|cyst|polyp)\b/i;
const NOT_DISEASE_WORDS = /\b(diagnosis|prognosis|haemoglobin|hemoglobin)\b/i;

/**
 * Read one item from a diagnosis/problem list. Returns a condition only for clinical diagnoses:
 * known conditions, or wording that is clearly a disease name. Everything else (findings, plans,
 * names, queries, negatives) is ignored.
 */
export function normaliseCondition(item: string): ExtractedCondition | undefined {
  const text = item
    .replace(/^\s*(?:[-•*·–>]+|\(?\d{1,2}[.)])\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 3) return undefined;
  if (UNCERTAIN.test(text) || FAMILY.test(text)) return undefined;
  // "No diabetes", "HIV negative" — but keep "Type 2 diabetes, not well controlled".
  if (NEGATED.test(text) || /\b(negative|non-reactive|nonreactive|excluded)\b/i.test(text)) return undefined;
  const resolved = /\b(treated|resolved|history of|previous|past|h\/o|healed|cured)\b/i.test(text);
  const lower = ` ${text.toLowerCase()} `;
  for (const def of CONDITIONS) {
    if (def.keywords.some((k) => new RegExp(`[^a-z]${escapeRe(k)}[^a-z]`).test(lower))) {
      return { name: def.name, chronic: def.chronic, status: resolved ? "resolved" : "active" };
    }
  }
  // Close spelling of a one-word condition (e.g. "tonsillitic" read from handwriting).
  const words = text.toLowerCase().match(/[a-z]{6,}/g) ?? [];
  for (const def of CONDITIONS) {
    const kw = def.keywords.find((k) => !k.includes(" ") && k.length >= 6 && words.some((w) => nearlySame(w, k)));
    if (kw) return { name: def.name, chronic: def.chronic, status: resolved ? "resolved" : "active" };
  }
  // Not in the list: keep it only if it reads as a disease name.
  const cleaned = text
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(newly diagnosed|new|known|confirmed|chronic|acute)\b/gi, (w) => (/chronic|acute/i.test(w) ? w : ""))
    .replace(/[,;.]\s*(treated|resolved).*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/[,;.:\s-]+$/, "")
    .trim();
  if (cleaned.length < 4 || cleaned.length > 50 || /\d/.test(cleaned.replace(/\btype [12]\b/i, ""))) return undefined;
  if (cleaned.includes(":") || cleaned.split(" ").length > 5) return undefined;
  if (NOT_DIAGNOSIS.test(cleaned) || NOT_DISEASE_WORDS.test(cleaned)) return undefined;
  if (!DIAGNOSTIC_FORM.test(cleaned)) return undefined;
  return { name: capitalise(cleaned), chronic: false, status: resolved ? "resolved" : "active" };
}

/** True when a saved condition's name is a clinical diagnosis by the rules above. */
export function isClinicalDiagnosis(name: string): boolean {
  return !!normaliseCondition(name);
}
