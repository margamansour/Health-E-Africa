import type { Condition, EventType, Immunisation, Medication, Profile, RuleStatus } from "@/db/types";
import { addMonths, ageOn, parseDateKey, toDateKey } from "@/lib/utils";

/**
 * Preventive-care rules for Kenya. Rules are data so clinicians can review and change them.
 * Based on Kenyan national screening and immunisation guidance (MOH / KEPI).
 * STATUS: draft — must be reviewed by a clinician before real-world use.
 */
export interface ReminderRule {
  id: string;
  title: string;
  description: string;
  type: EventType;
  intervalMonths: number;
  sex?: "female" | "male";
  ageMin?: number;
  ageMax?: number;
  /** Applies if the user has any of these conditions (keyword match)… */
  conditions?: string[];
  /** …or is at least this age (used with `conditions`). */
  orAgeMin?: number;
  /** Doesn't apply if the user has any of these conditions. */
  excludeConditions?: string[];
  /** One-off: once done it never comes back. */
  oneOff?: boolean;
  /** Skip if a dose of this vaccine is already recorded as given. */
  skipIfVaccine?: string;
}

const DIABETES = ["diabetes", "diabetic", "t2dm", "t1dm"];
const HYPERTENSION = ["hypertension", "high blood pressure", "htn"];
const RESPIRATORY = ["asthma", "copd", "chronic obstructive"];
const HIV = ["hiv"];
const KIDNEY = ["kidney", "ckd", "renal"];
const HEART = ["heart failure", "cardiac", "heart disease", "coronary"];

export const KENYA_RULES: ReminderRule[] = [
  // General screening
  { id: "bp-check", title: "Blood pressure check", description: "Adults should have their blood pressure checked at least once a year.", type: "screening", intervalMonths: 12, ageMin: 18, excludeConditions: HYPERTENSION },
  { id: "diabetes-screen", title: "Diabetes screening (blood sugar)", description: "Blood sugar test every 3 years from age 40, or sooner if you have risk factors.", type: "screening", intervalMonths: 36, ageMin: 40, excludeConditions: DIABETES },
  { id: "hiv-test", title: "HIV test", description: "Know your status — an HIV test is recommended at least once a year.", type: "screening", intervalMonths: 12, ageMin: 15, ageMax: 64, excludeConditions: HIV },
  { id: "cervical", title: "Cervical cancer screening", description: "Women aged 25–49 should be screened (VIA or HPV test) every 3 years.", type: "screening", intervalMonths: 36, sex: "female", ageMin: 25, ageMax: 49 },
  { id: "breast-exam", title: "Clinical breast examination", description: "A yearly breast examination by a health worker from age 25.", type: "screening", intervalMonths: 12, sex: "female", ageMin: 25, ageMax: 74 },
  { id: "mammogram", title: "Mammogram", description: "Breast X-ray every 2 years for women aged 40–74.", type: "screening", intervalMonths: 24, sex: "female", ageMin: 40, ageMax: 74 },
  { id: "prostate", title: "Prostate cancer screening discussion", description: "Men aged 45–69 should discuss a PSA test with a clinician each year.", type: "screening", intervalMonths: 12, sex: "male", ageMin: 45, ageMax: 69 },
  { id: "colorectal", title: "Bowel cancer screening", description: "A stool test every 2 years from age 45 to 75.", type: "screening", intervalMonths: 24, ageMin: 45, ageMax: 75 },
  { id: "eye-check", title: "Eye check", description: "Eye examination every 2 years from age 40 (glaucoma and vision).", type: "screening", intervalMonths: 24, ageMin: 40 },
  { id: "dental", title: "Dental check-up", description: "A dental check-up once a year.", type: "screening", intervalMonths: 12, ageMin: 2 },

  // Vaccines
  { id: "td-booster", title: "Tetanus-diphtheria (Td) booster", description: "Adults need a Td booster every 10 years.", type: "vaccine", intervalMonths: 120, ageMin: 18 },
  { id: "flu", title: "Flu vaccine", description: "Yearly flu vaccine for people aged 65+ or with long-term conditions.", type: "vaccine", intervalMonths: 12, conditions: [...DIABETES, ...RESPIRATORY, ...HEART, ...KIDNEY, ...HIV], orAgeMin: 65 },
  { id: "hpv", title: "HPV vaccine", description: "A single dose of HPV vaccine for girls aged 10–14 protects against cervical cancer.", type: "vaccine", intervalMonths: 0, oneOff: true, sex: "female", ageMin: 10, ageMax: 14, skipIfVaccine: "hpv" },

  // Long-term conditions
  { id: "dm-hba1c", title: "Diabetes: HbA1c test", description: "HbA1c every 6 months shows how well your diabetes is controlled.", type: "review", intervalMonths: 6, conditions: DIABETES },
  { id: "dm-foot", title: "Diabetes: foot check", description: "Yearly foot check to prevent ulcers and complications.", type: "review", intervalMonths: 12, conditions: DIABETES },
  { id: "dm-eye", title: "Diabetes: eye (retina) screening", description: "Yearly retinal screening for diabetic eye disease.", type: "review", intervalMonths: 12, conditions: DIABETES },
  { id: "dm-kidney", title: "Diabetes: kidney function test", description: "Yearly urine and blood test for kidney health.", type: "review", intervalMonths: 12, conditions: DIABETES },
  { id: "htn-review", title: "Hypertension: blood pressure review", description: "Blood pressure review every 3 months.", type: "review", intervalMonths: 3, conditions: HYPERTENSION },
  { id: "htn-bloods", title: "Hypertension: yearly blood tests", description: "Yearly kidney function and cholesterol tests.", type: "review", intervalMonths: 12, conditions: HYPERTENSION },
  { id: "resp-review", title: "Asthma/COPD: yearly review", description: "Yearly review of your inhaler technique and action plan.", type: "review", intervalMonths: 12, conditions: RESPIRATORY },
  { id: "hiv-vl", title: "HIV: viral load test", description: "Viral load test to confirm your treatment is working.", type: "review", intervalMonths: 12, conditions: HIV },
  { id: "ckd-review", title: "Kidney disease: kidney function test", description: "Kidney function test every 6 months.", type: "review", intervalMonths: 6, conditions: KIDNEY },
  { id: "heart-review", title: "Heart condition: review", description: "Review with your clinician every 6 months.", type: "review", intervalMonths: 6, conditions: HEART },
];

export interface PlanContext {
  profile: Pick<Profile, "dob" | "sex">;
  conditions: Condition[];
  medications: Medication[];
  immunisations: Immunisation[];
  ruleStatus: RuleStatus[];
  today: Date;
}

export interface PlannedReminder {
  key: string;
  ruleId?: string;
  title: string;
  description: string;
  type: EventType;
  /** yyyy-mm-dd, or undefined when never recorded (due now, date unknown). */
  dueDate?: string;
  state: "due" | "upcoming";
  link: string;
}

function hasAny(conditions: Condition[], keywords: string[]) {
  return conditions.some(
    (c) => c.status === "active" && !c.archivedAt && keywords.some((k) => c.name.toLowerCase().includes(k)),
  );
}

export function ruleApplies(rule: ReminderRule, ctx: Pick<PlanContext, "profile" | "conditions" | "immunisations" | "today">): boolean {
  const age = ageOn(ctx.profile.dob, ctx.today);
  if (rule.sex && rule.sex !== ctx.profile.sex) return false;
  if (rule.excludeConditions && hasAny(ctx.conditions, rule.excludeConditions)) return false;
  if (rule.skipIfVaccine) {
    const v = rule.skipIfVaccine.toLowerCase();
    if (ctx.immunisations.some((i) => !i.archivedAt && i.dateGiven && i.vaccine.toLowerCase().includes(v))) return false;
  }
  if (rule.conditions) {
    const byCondition = hasAny(ctx.conditions, rule.conditions);
    const byAge = rule.orAgeMin != null && age >= rule.orAgeMin;
    if (!byCondition && !byAge) return false;
  }
  if (rule.ageMin != null && age < rule.ageMin) return false;
  if (rule.ageMax != null && age > rule.ageMax) return false;
  return true;
}


export function planReminders(ctx: PlanContext): PlannedReminder[] {
  const todayKey = toDateKey(ctx.today);
  const out: PlannedReminder[] = [];

  for (const rule of KENYA_RULES) {
    if (!ruleApplies(rule, ctx)) continue;
    const status = ctx.ruleStatus.find((s) => s.ruleId === rule.id);
    if (status?.dismissed) continue;
    if (rule.oneOff && status?.lastDone) continue;
    let dueDate: string | undefined;
    if (status?.lastDone) dueDate = toDateKey(addMonths(parseDateKey(status.lastDone), rule.intervalMonths));
    out.push({
      key: `rule:${rule.id}`,
      ruleId: rule.id,
      title: rule.title,
      description: rule.description,
      type: rule.type,
      dueDate,
      state: !dueDate || dueDate <= todayKey ? "due" : "upcoming",
      link: "/calendar?tab=checks",
    });
  }

  for (const m of ctx.medications) {
    if (m.archivedAt || m.status !== "active" || !m.reviewDate) continue;
    out.push({
      key: `medreview:${m.id}`,
      title: `Medication review: ${m.name}`,
      description: "Your prescriber should review this medicine to check it is still right for you.",
      type: "review",
      dueDate: m.reviewDate,
      state: m.reviewDate <= todayKey ? "due" : "upcoming",
      link: "/prescriptions",
    });
  }

  for (const i of ctx.immunisations) {
    if (i.archivedAt || i.dateGiven || !i.dueDate) continue;
    out.push({
      key: `vaccine:${i.id}`,
      title: `${i.vaccine} — dose ${i.doseNumber}`,
      description: "A vaccine dose is due.",
      type: "vaccine",
      dueDate: i.dueDate,
      state: i.dueDate <= todayKey ? "due" : "upcoming",
      link: "/immunisations",
    });
  }

  return out.sort((a, b) => (a.dueDate ?? "0000").localeCompare(b.dueDate ?? "0000"));
}

export type ImmunisationState = "given" | "overdue" | "due" | "scheduled" | "unknown";

export function immunisationState(i: Immunisation, todayKey: string): ImmunisationState {
  if (i.dateGiven) return "given";
  if (!i.dueDate) return "unknown";
  if (i.dueDate < todayKey) return "overdue";
  const soon = toDateKey(addMonths(parseDateKey(todayKey), 1));
  return i.dueDate <= soon ? "due" : "scheduled";
}
