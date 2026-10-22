import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ShieldCheck, Copy } from "lucide-react";
import { db } from "@/db/db";
import type { Allergy, Medication } from "@/db/types";
import { findAllergyConflicts, type AllergyConflict } from "@/domain/allergy";
import { conditionWarnings, findInteractions, type ConditionWarning, type Interaction } from "@/domain/interactions";
import { active, useProfile } from "@/lib/hooks";
import { ageOn } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface SafetyIssue {
  severity: "major" | "moderate";
  /** Short headline, e.g. "Warfarin + Ibuprofen" or "Amoxicillin: allergy to Penicillin". */
  title: string;
  effect: string;
  advice: string;
  kind: "allergy" | "interaction" | "duplicate" | "condition";
  meds: string[];
}

export const allergyIssue = (med: string, c: AllergyConflict): SafetyIssue => ({
  severity: c.level === "direct" ? "major" : "moderate",
  title: `${med} · ${c.allergy.substance} allergy`,
  effect: c.level === "direct" ? `${med} may contain, or be related to, ${c.allergy.substance}.` : `${med} can cross-react with ${c.allergy.substance}.`,
  advice: "Don't take it until a pharmacist or doctor has checked.",
  kind: "allergy",
  meds: [med],
});

export const interactionIssue = (i: Interaction): SafetyIssue => ({
  severity: i.severity,
  title: `${i.meds[0]} + ${i.meds[1]}`,
  effect: i.effect,
  advice: i.advice,
  kind: i.kind,
  meds: [...i.meds],
});

export const conditionIssue = (w: ConditionWarning): SafetyIssue => ({
  severity: w.severity,
  title: `${w.med} · ${w.condition}`,
  effect: w.effect,
  advice: w.advice,
  kind: "condition",
  meds: [w.med],
});

/**
 * Checks for a set of medicine names against each other, the patient's allergies and conditions
 * (and age), most serious first. `onlyInvolving` limits it to issues about those medicines.
 */
export function checkMedicines(
  names: string[],
  allergies: Allergy[],
  opts: { onlyInvolving?: string[]; conditions?: string[]; age?: number } = {},
): SafetyIssue[] {
  const involve = opts.onlyInvolving;
  const own = names.filter((n) => !involve || involve.includes(n));
  const allergyIssues = own.flatMap((n) => findAllergyConflicts(n, allergies).map((c) => allergyIssue(n, c)));
  const conditionIssues = own.flatMap((n) => conditionWarnings(n, opts.conditions ?? [], opts.age).map(conditionIssue));
  const pairs = findInteractions(names)
    .filter((i) => !involve || i.meds.some((m) => involve.includes(m)))
    .map(interactionIssue);
  return [...allergyIssues, ...conditionIssues, ...pairs].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "major" ? -1 : 1));
}

const medLabel = (m: Pick<Medication, "name" | "dose">) => m.name;

/** The patient's current medicines checked against each other, their allergies, conditions and age. */
export function useMedicineSafety() {
  const meds = active(useLiveQuery(() => db.medications.toArray(), [])).filter((m) => m.status === "active");
  const allergies = active(useLiveQuery(() => db.allergies.toArray(), [])).filter((a) => a.status === "active");
  const conditionRows = active(useLiveQuery(() => db.conditions.toArray(), [])).filter((c) => c.status === "active");
  const profile = useProfile();
  const age = profile?.dob ? ageOn(profile.dob) : undefined;
  const conditions = useMemo(() => conditionRows.map((c) => c.name), [conditionRows]);
  const issues = useMemo(() => checkMedicines(meds.map(medLabel), allergies, { conditions, age }), [meds, allergies, conditions, age]);
  return { meds, allergies, conditions, age, issues, issuesFor: (name: string) => issues.filter((i) => i.meds.includes(name)) };
}

/** A list of safety issues: red for serious, amber for moderate. */
export function SafetyList({ issues, compact }: { issues: SafetyIssue[]; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <ul className="space-y-2">
      {issues.map((i, n) => (
        <li key={n} className={cn("rounded-2xl p-3", i.severity === "major" ? "bg-coral/40" : "bg-butter/60")}>
          <p className="flex items-start gap-1.5 text-sm font-bold">
            {i.kind === "duplicate" ? <Copy className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", i.severity === "major" && "text-red-700")} />}
            <span>
              {i.title}
              <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase", i.severity === "major" ? "bg-red-700 text-white" : "bg-white/70")}>
                {i.kind === "allergy" ? t("Allergy") : i.kind === "duplicate" ? t("Same type") : i.kind === "condition" ? t("Condition") : i.severity === "major" ? t("Serious") : t("Moderate")}
              </span>
            </span>
          </p>
          <p className="mt-1 text-sm">{t(i.effect)}</p>
          {!compact && <p className="mt-1 text-xs text-ink/70">{t(i.advice)}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Summary card for the Prescriptions page. */
export function MedicineSafetyCard() {
  const { t } = useTranslation();
  const { meds, allergies, conditions, issues } = useMedicineSafety();
  if (!meds.length) return null;
  return (
    <div className={cn("space-y-2 rounded-[24px] p-4", issues.length ? "bg-white ring-2 ring-coral" : "bg-mint")}>
      <p className="flex items-center gap-2 text-base font-extrabold">
        {issues.length ? <AlertTriangle className="h-5 w-5 text-red-700" /> : <ShieldCheck className="h-5 w-5 text-emerald-800" />}
        {issues.length ? t("{{count}} medicine safety alert(s)", { count: issues.length }) : t("No interactions found")}
      </p>
      <p className="text-xs text-ink/65">
        {t("Your {{meds}} current medicine(s) checked against each other, your {{allergies}} allerg(ies) and {{conditions}} condition(s).", { meds: meds.length, allergies: allergies.length, conditions: conditions.length })}
      </p>
      {issues.length > 0 && <SafetyList issues={issues} />}
      <p className="text-[11px] text-ink/50">{t("Checks the most common and serious interactions only. Your pharmacist checks every request, and tell them about any herbal or over-the-counter medicines you take.")}</p>
    </div>
  );
}
