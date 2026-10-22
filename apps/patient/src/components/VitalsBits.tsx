import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "@/db/db";
import type { VitalSign } from "@/db/types";
import { active } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { bmi, type Assessment, type VitalKind } from "@/domain/vitals";

const TONE: Record<Assessment["tone"], string> = {
  good: "bg-mint text-emerald-900",
  watch: "bg-butter text-ink",
  high: "bg-coral text-red-950",
  low: "bg-sky text-ink",
};

/** Latest reading of each kind, and BMI from the latest weight and height. */
export function useLatestVitals() {
  const rows = active(useLiveQuery(() => db.vitals.orderBy("date").toArray(), []));
  return useMemo(() => {
    const latest: Partial<Record<VitalKind, VitalSign>> = {};
    for (const r of rows) {
      const cur = latest[r.kind];
      if (!cur || r.date > cur.date || (r.date === cur.date && r.createdAt > cur.createdAt)) latest[r.kind] = r;
    }
    const w = latest.weight;
    const h = latest.height;
    const bmiValue = w && h ? bmi(w.value, h.value) : undefined;
    return { rows, latest, bmi: bmiValue };
  }, [rows]);
}

export function AssessmentBadge({ a, className }: { a?: Assessment; className?: string }) {
  const { t } = useTranslation();
  if (!a) return null;
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", TONE[a.tone], className)}>{t(a.label)}</span>;
}

