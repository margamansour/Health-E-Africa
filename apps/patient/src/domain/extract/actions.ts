/**
 * Things a document asks the patient (or their GP) to do: book a review, get a test repeated,
 * start or change a medicine, see a specialist. Each becomes a to-do item for the patient.
 */

export type ActionKind = "medication" | "test" | "referral" | "appointment" | "lifestyle" | "other";

export interface ExtractedAction {
  kind: ActionKind;
  /** The instruction as written in the document. */
  text: string;
  /** Written for the patient's GP / regular doctor (e.g. under "Actions for GP"). */
  forGp: boolean;
  /** When it's due, if the document says (yyyy-mm-dd). */
  due?: string;
}

/** Sign-offs, names, contact details and filler that aren't instructions. */
const NOT_ACTION =
  /^(dr\.?|doctor|mr|mrs|ms|prof)\b|\b(regards|sincerely|yours|signature|signed|stamp|tel|phone|email|e-mail|fax|p\.?o\.? box|page \d|thank you|thanks|cc:|copy to|reg\.? no|registration|kmpdc|licen[cs]e|medical officer|consultant physician|sample document|for demo|fictional|confidential)\b|^(none|nil|n\/a|na|-)$/i;

/** Instructions that don't name a test, medicine or appointment but still start with a "do this" word. */
const IMPERATIVE = /^(please\s+)?(ensure|arrange|book|take|keep|avoid|continue|attend|bring|call|contact|inform|discuss|consider|encourage|advise|educate|counsel|record|measure|weigh|send|obtain|request|organise|organize|complete|collect|return|see)\b/i;

/** Text from stamps, footers and scanning noise: short fragments, mostly capitals, or mostly numbers. */
function looksLikeNoise(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 6) return true;
  const words = text.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  if (words.length && words.reduce((n, w) => n + w.length, 0) / words.length < 3) return true;
  const caps = letters.replace(/[^A-Z]/g, "").length / letters.length;
  return caps > 0.7 && letters.length > 8;
}

/** Kinds of action, checked in order: the first match wins. */
const KINDS: [ActionKind, RegExp][] = [
  ["referral", /\b(refer|referral|referred|specialist|ophthalmolog\w*|cardiolog\w*|surgeon|physio\w*|dietitian|nutritionist|eye screening)\b/i],
  ["medication", /\b(start|started|stop|stopped|increase|increased|reduce|reduced|decrease|decreased|switch|switched|change|changed|titrate|restart|withhold|hold|wean|taper|dose|tablets?|medicines?|medications?|prescri\w+|mg)\b/i],
  ["test", /\b(repeat|recheck|re-check|check|test|tests|bloods?|fbc|cbc|hba1c|u&es?|ues|lfts?|lipids?|tfts?|ultrasound|x-?ray|scan|ecg|echo|urine|urinalysis|bp|blood pressure|monitor\w*|screen\w*|swab|smear|biopsy)\b/i],
  ["appointment", /\b(review|follow[- ]?up|see|seen|appointment|clinic|visit|return|come back|book)\b/i],
  ["lifestyle", /\b(diet|exercise|walk\w*|weight|smok\w*|alcohol|salt|sugar|fluids|rest|sleep)\b/i],
];

const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, twelve: 12 };

/** "in 3 months", "after two weeks", "within 6 weeks" → a date counted from the document date. */
export function dueFromText(text: string, docDate: string | undefined, findDate: (s: string) => string | undefined): string | undefined {
  const m = text.match(/\b(?:in|after|within)\s+(\d+|one|two|three|four|five|six|twelve)\s*(day|week|month|year)s?\b/i);
  if (m) {
    const n = Number.isNaN(Number(m[1])) ? NUM[m[1]!.toLowerCase()]! : Number(m[1]);
    const base = docDate ? new Date(`${docDate}T12:00:00`) : new Date();
    const unit = m[2]!.toLowerCase();
    if (unit === "day") base.setDate(base.getDate() + n);
    else if (unit === "week") base.setDate(base.getDate() + n * 7);
    else base.setMonth(base.getMonth() + (unit === "month" ? n : n * 12));
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
  }
  return findDate(text);
}

/** Read one line of a plan / follow-up / "actions for GP" section as an action, or nothing. */
export function parseAction(
  line: string,
  opts: { forGp: boolean; docDate?: string; findDate: (s: string) => string | undefined },
): ExtractedAction | undefined {
  const text = line
    .replace(/\s*\|\s*/g, " ")
    .replace(/^\s*(?:[-•*·–>]+|\(?\d{1,2}[.)]|\[\s?\])\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 4 || text.split(" ").length < 2 || text.length > 200) return undefined;
  if (NOT_ACTION.test(text) || looksLikeNoise(text)) return undefined;
  const kind = KINDS.find(([, re]) => re.test(text))?.[0] ?? (IMPERATIVE.test(text) ? "other" : undefined);
  // Only instructions count: a line has to name something to do.
  if (!kind) return undefined;
  return { kind, text: text.replace(/[.;,]+$/, ""), forGp: opts.forGp, due: dueFromText(text, opts.docDate, opts.findDate) };
}
