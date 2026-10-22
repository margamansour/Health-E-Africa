import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HeartPulse, Plus } from "lucide-react";
import { db } from "@/db/db";
import { Button, Card, EmptyState, Field, Input, Notice, Sheet, Textarea } from "@/components/ui";
import { Page, PageHeader } from "@/components/layout";
import { SourceLabel, SourceSheet, type SourceTarget } from "@/components/SourceDocumentSheet";
import { useFormat, useProfile, useProvenance } from "@/lib/hooks";
import { cn, nowIso, today, uid } from "@/lib/utils";
import { assess, bmiCategory, formatVital, isPlausible, VITAL_ORDER, VITALS, type Assessment, type VitalKind } from "@/domain/vitals";
import { AssessmentBadge, useLatestVitals } from "@/components/VitalsBits";

export function VitalsPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const profile = useProfile();
  const [params, setParams] = useSearchParams();
  const { rows, latest, bmi: bmiValue } = useLatestVitals();
  const provenance = useProvenance();
  const [kind, setKind] = useState<VitalKind>("bp");
  const [trace, setTrace] = useState<SourceTarget | null>(null);
  const adding = params.get("add") === "1";

  const series = rows.filter((r) => r.kind === kind).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const def = VITALS[kind];
  const data = series.map((r) => ({ date: fmt.date(r.date, { day: "numeric", month: "short", year: "2-digit" }), value: r.value, value2: r.value2 }));

  const cards: { kind: VitalKind | "bmi"; label: string; value?: string; unit: string; a?: Assessment; date?: string }[] = [
    ...(["bp", "pulse"] as VitalKind[]).map((k) => cardFor(k)),
    { kind: "bmi", label: "BMI", value: bmiValue != null ? String(bmiValue) : undefined, unit: "kg/m²", a: bmiValue != null ? bmiCategory(bmiValue) : undefined, date: latest.weight?.date },
    ...(["weight", "height", "temperature", "spo2", "waist"] as VitalKind[]).map((k) => cardFor(k)),
  ];
  function cardFor(k: VitalKind) {
    const r = latest[k];
    return { kind: k, label: VITALS[k].label, value: r ? formatVital(k, r.value, r.value2) : undefined, unit: VITALS[k].unit, a: r ? assess(k, r.value, r.value2, profile?.sex) : undefined, date: r?.date };
  }

  return (
    <>
      <PageHeader
        title={t("Vitals")}
        back
        action={
          <Button size="sm" onClick={() => setParams({ add: "1" })}>
            <Plus className="h-4 w-4" />
            {t("Add")}
          </Button>
        }
      />
      <Page>
        {rows.length === 0 ? (
          <EmptyState
            icon={<HeartPulse className="h-6 w-6" />}
            title={t("No readings yet")}
            body={t("Add your blood pressure, weight and height to track them. Readings in letters you upload are added automatically.")}
            action={<Button onClick={() => setParams({ add: "1" })}>{t("Add a reading")}</Button>}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              {cards.map((c) => (
                <button
                  key={c.kind}
                  type="button"
                  onClick={() => setKind(c.kind === "bmi" ? "weight" : c.kind)}
                  className={cn(
                    "rounded-[22px] bg-white p-3 text-left shadow-[0_2px_12px_-6px_rgba(35,32,47,0.12)] ring-2",
                    c.kind === kind ? "ring-ink" : "ring-transparent",
                  )}
                >
                  <p className="text-xs font-bold text-ink/60">{t(c.label)}</p>
                  {c.value ? (
                    <>
                      <p className="mt-0.5 text-2xl font-extrabold leading-tight">
                        {c.value}
                        <span className="ml-1 text-xs font-semibold text-ink/50">{c.unit}</span>
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <AssessmentBadge a={c.a} />
                        {c.date && <span className="text-[11px] text-ink/45">{fmt.date(c.date, { day: "numeric", month: "short" })}</span>}
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-ink/40">{t("Not recorded")}</p>
                  )}
                </button>
              ))}
            </div>
            {bmiValue == null && (latest.weight || latest.height) && <p className="px-1 text-xs text-ink/55">{t("Add both your weight and height to see your BMI.")}</p>}

            <Card className="space-y-3">
              <p className="text-base font-extrabold">
                {t(def.label)} <span className="text-xs font-semibold text-ink/45">{t("Tap a card above to see another")}</span>
              </p>
              {series.length < 2 ? (
                <p className="py-4 text-center text-sm text-ink/55">{t("Add more readings to see a trend.")}</p>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid stroke="rgba(35,32,47,0.08)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                      <Tooltip />
                      {kind === "bp" && <ReferenceLine y={140} stroke="#f87171" strokeDasharray="4 4" />}
                      {kind === "bp" && <ReferenceLine y={90} stroke="#f87171" strokeDasharray="4 4" />}
                      <Line isAnimationActive={false} type="monotone" dataKey="value" name={kind === "bp" ? t("Systolic") : t(def.label)} stroke="#6c5fd8" strokeWidth={3} dot={{ r: 4 }} />
                      {kind === "bp" && <Line isAnimationActive={false} type="monotone" dataKey="value2" name={t("Diastolic")} stroke="#23202f" strokeWidth={2} dot={{ r: 3 }} />}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {kind === "bp" && series.length >= 2 && <p className="text-xs text-ink/50">{t("Dashed lines: 140/90, the level treated as high blood pressure.")}</p>}

              <ul className="divide-y divide-ink/5">
                {[...series].reverse().map((r) => {
                  const a = assess(r.kind, r.value, r.value2, profile?.sex);
                  const p = provenance(r);
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 py-2.5 text-left"
                        onClick={() =>
                          setTrace({
                            title: `${t(VITALS[r.kind].label)} ${formatVital(r.kind, r.value, r.value2)} ${VITALS[r.kind].unit}`,
                            date: r.date,
                            provenance: p,
                            find: { words: VITAL_WORDS[r.kind], prefer: [formatVital(r.kind, r.value, r.value2)] },
                          })
                        }
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold">
                            {formatVital(r.kind, r.value, r.value2)} <span className="text-xs font-semibold text-ink/50">{VITALS[r.kind].unit}</span>
                          </span>
                          <span className="block text-xs text-ink/55">{fmt.date(r.date)}</span>
                          <SourceLabel p={p} className="mt-0.5 max-w-full" />
                        </span>
                        <AssessmentBadge a={a} />
                      </button>
                    </li>
                  );
                })}
                {series.length === 0 && <li className="py-3 text-sm text-ink/55">{t("No {{name}} readings yet.", { name: t(def.label).toLowerCase() })}</li>}
              </ul>
            </Card>
            <p className="px-1 text-xs text-ink/45">{t("Ranges are for adults and are a guide only. Talk to a health worker about your readings.")}</p>
          </>
        )}
      </Page>
      <AddVitalSheet open={adding} initialKind={kind} onClose={() => setParams({}, { replace: true })} />
      <SourceSheet target={trace} onClose={() => setTrace(null)} />
    </>
  );
}

const VITAL_WORDS: Record<VitalKind, string[]> = {
  bp: ["bp", "b/p", "blood pressure"],
  pulse: ["pulse", "hr", "heart rate", "pr"],
  weight: ["weight", "wt"],
  height: ["height", "ht"],
  temperature: ["temp", "temperature"],
  spo2: ["spo2", "sats", "oxygen saturation"],
  waist: ["waist"],
};

function AddVitalSheet({ open, initialKind, onClose }: { open: boolean; initialKind: VitalKind; onClose: () => void }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<VitalKind>(initialKind);
  const [f, setF] = useState({ value: "", value2: "", date: today(), notes: "" });
  useEffect(() => {
    if (open) {
      setKind(initialKind);
      setF({ value: "", value2: "", date: today(), notes: "" });
    }
  }, [open, initialKind]);
  const def = VITALS[kind];
  const v = Number(f.value);
  const v2 = kind === "bp" ? Number(f.value2) : undefined;
  const filled = f.value.trim() !== "" && (kind !== "bp" || f.value2.trim() !== "");
  const ok = filled && isPlausible(kind, v, v2);
  const a = ok ? assess(kind, v, v2) : undefined;

  const save = async () => {
    await db.vitals.add({ id: uid(), kind, value: v, value2: v2, date: f.date, notes: f.notes.trim() || undefined, createdAt: nowIso() });
    // A blood pressure reading counts as the yearly BP check.
    if (kind === "bp") {
      const cur = await db.ruleStatus.get("bp-check");
      if (!cur?.lastDone || cur.lastDone < f.date) await db.ruleStatus.put({ ...cur, ruleId: "bp-check", lastDone: f.date });
    }
    toast.success(t("Reading saved"));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("Add a reading")}
      footer={
        <Button className="w-full" disabled={!ok} onClick={() => void save()}>
          {t("Save")}
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Choices wrap onto new lines, so nothing needs scrolling sideways */}
        <div className="flex flex-wrap gap-2">
          {VITAL_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn("rounded-full px-3.5 py-2 text-sm font-bold", k === kind ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-ink/10")}
            >
              {t(VITALS[k].label)}
            </button>
          ))}
        </div>
        {kind === "bp" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Top number (systolic)")}>{(id) => <Input id={id} inputMode="numeric" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} placeholder="120" />}</Field>
            <Field label={t("Bottom number (diastolic)")}>{(id) => <Input id={id} inputMode="numeric" value={f.value2} onChange={(e) => setF({ ...f, value2: e.target.value })} placeholder="80" />}</Field>
          </div>
        ) : (
          <Field label={`${t(def.label)} (${def.unit})`}>
            {(id) => <Input id={id} inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value.replace(",", ".") })} />}
          </Field>
        )}
        {filled && !ok && <Notice tone="amber">{t("That doesn't look right. Check the numbers and the unit ({{unit}}).", { unit: def.unit })}</Notice>}
        {a && (
          <p className="flex items-center gap-2 text-sm">
            {t("This reading is")} <AssessmentBadge a={a} />
          </p>
        )}
        {a?.tone === "high" && (kind === "bp" || kind === "spo2") && (
          <Notice tone="red">{t("If you feel unwell (chest pain, breathlessness, severe headache, weakness), get medical help now.")}</Notice>
        )}
        <Field label={t("Date")}>{(id) => <Input id={id} type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</Field>
        <Field label={t("Notes")}>{(id) => <Textarea id={id} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder={t("e.g. at home, after rest")} />}</Field>
      </div>
    </Sheet>
  );
}
