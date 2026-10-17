import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ClipboardPaste, FlaskConical, Inbox, Plus, Trash2 } from "lucide-react";
import { db } from "@/db/db";
import type { LabPanel, LabResult } from "@/db/types";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, Select, Sheet, Tabs, Textarea } from "@/components/ui";
import { Page, PageHeader } from "@/components/layout";
import { flagFor, PANEL_TEMPLATES, parseResultsText, type ParsedRow } from "@/domain/labs";
import { active, useFormat } from "@/lib/hooks";
import { cn, nowIso, today, uid } from "@/lib/utils";

type View = "panels" | "table" | "graph";

export function ResultsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>("panels");
  const panels = active(useLiveQuery(() => db.labPanels.orderBy("date").reverse().toArray(), []));
  const results = useLiveQuery(() => db.labResults.orderBy("date").toArray(), []) ?? [];
  const liveResults = useMemo(() => {
    const ids = new Set(panels.map((p) => p.id));
    return results.filter((r) => ids.has(r.panelId));
  }, [panels, results]);
  const addOpen = params.get("add") === "1";

  return (
    <>
      <PageHeader
        title={t("Results")}
        back
        action={
          <Button size="sm" onClick={() => setParams({ add: "1" })}>
            <Plus className="h-4 w-4" />
            {t("Add")}
          </Button>
        }
      />
      <Page>
        {panels.length === 0 ? (
          <EmptyState
            icon={<FlaskConical className="h-6 w-6" />}
            title={t("No results yet")}
            body={t("Add blood test results to track them over time. Results from your clinic will appear here automatically.")}
            action={<Button onClick={() => setParams({ add: "1" })}>{t("Add results")}</Button>}
          />
        ) : (
          <>
            <Tabs
              value={view}
              onChange={setView}
              options={[
                { value: "panels", label: t("Panels") },
                { value: "table", label: t("Table") },
                { value: "graph", label: t("Graph") },
              ]}
            />
            {view === "panels" && <PanelsView panels={panels} results={liveResults} />}
            {view === "table" && <TableView results={liveResults} />}
            {view === "graph" && <GraphView results={liveResults} />}
          </>
        )}
      </Page>
      <AddResultsSheet open={addOpen} onClose={() => setParams({}, { replace: true })} />
    </>
  );
}

function ValueCell({ r }: { r: LabResult }) {
  const f = flagFor(r);
  return (
    <span className={cn("font-semibold", f === "high" || f === "low" ? "text-red-600" : "text-slate-900")}>
      {r.value}
      {f === "high" ? " ↑" : f === "low" ? " ↓" : ""}
    </span>
  );
}

function range(r: Pick<LabResult, "refLow" | "refHigh">) {
  if (r.refLow != null && r.refHigh != null) return `${r.refLow}–${r.refHigh}`;
  if (r.refLow != null) return `> ${r.refLow}`;
  if (r.refHigh != null) return `< ${r.refHigh}`;
  return "";
}

function PanelsView({ panels, results }: { panels: LabPanel[]; results: LabResult[] }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  return (
    <>
      {panels.map((p) => {
        const rows = results.filter((r) => r.panelId === p.id);
        const abnormal = rows.filter((r) => ["high", "low"].includes(flagFor(r))).length;
        return (
          <Card key={p.id} className="p-0">
            <div className="flex items-start justify-between gap-2 px-4 pt-3">
              <div>
                <p className="font-semibold">{t(p.name)}</p>
                <p className="text-xs text-slate-500">
                  {fmt.date(p.date)} {p.facilityName && `· ${p.facilityName}`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {abnormal > 0 ? <Badge tone="red">{t("{{count}} out of range", { count: abnormal })}</Badge> : <Badge tone="green">{t("All in range")}</Badge>}
                {p.source === "facility" && (
                  <Badge tone="brand">
                    <Inbox className="h-3 w-3" />
                    {t("From clinic")}
                  </Badge>
                )}
              </div>
            </div>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-700">{r.analyte}</td>
                    <td className="py-2 text-right">
                      <ValueCell r={r} /> <span className="text-xs text-slate-500">{r.unit}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-slate-400">{range(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        );
      })}
    </>
  );
}

function TableView({ results }: { results: LabResult[] }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const analytes = [...new Set(results.map((r) => r.analyte))].sort();
  const dates = [...new Set(results.map((r) => r.date))].sort().reverse();
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left">{t("Test")}</th>
            {dates.map((d) => (
              <th key={d} className="whitespace-nowrap px-3 py-2 text-right">
                {fmt.date(d, { day: "numeric", month: "short", year: "2-digit" })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {analytes.map((a) => (
            <tr key={a} className="border-t border-slate-100">
              <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-2 text-slate-700">{a}</td>
              {dates.map((d) => {
                const r = results.find((x) => x.analyte === a && x.date === d);
                return (
                  <td key={d} className="px-3 py-2 text-right">
                    {r ? <ValueCell r={r} /> : <span className="text-slate-300">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function GraphView({ results }: { results: LabResult[] }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const analytes = [...new Set(results.map((r) => r.analyte))].sort((a, b) => results.filter((r) => r.analyte === b).length - results.filter((r) => r.analyte === a).length);
  const [analyte, setAnalyte] = useState(analytes[0] ?? "");
  const series = results.filter((r) => r.analyte === analyte).sort((a, b) => a.date.localeCompare(b.date));
  const last = series[series.length - 1];
  const data = series.map((r) => ({ date: fmt.date(r.date, { month: "short", year: "2-digit" }), value: r.value }));

  // Y-axis covers the values and the normal range, with some padding.
  const pts = [...series.map((r) => r.value), last?.refLow, last?.refHigh].filter((v): v is number => v != null);
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.15;
  const step = niceStep((hi + pad - (lo - pad)) / 4);
  const yMin = Math.max(0, Math.floor((lo - pad) / step) * step);
  const yMax = Math.ceil((hi + pad) / step) * step;
  const ticks = Array.from({ length: Math.round((yMax - yMin) / step) + 1 }, (_, i) => +(yMin + i * step).toFixed(4));

  return (
    <Card className="space-y-3">
      <Select value={analyte} onChange={(e) => setAnalyte(e.target.value)} aria-label={t("Test")}>
        {analytes.map((a) => (
          <option key={a} value={a}>
            {a} ({results.filter((r) => r.analyte === a).length})
          </option>
        ))}
      </Select>
      {last && (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">
            <ValueCell r={last} />
          </span>
          <span className="text-sm text-slate-500">{last.unit}</span>
          <span className="ml-auto text-xs text-slate-500">
            {t("Normal range")}: {range(last) || "—"}
          </span>
        </div>
      )}
      {series.length < 2 ? (
        <p className="py-6 text-center text-sm text-slate-500">{t("Add more results for this test to see a trend.")}</p>
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              {last && (last.refLow != null || last.refHigh != null) && (
                <ReferenceArea y1={last.refLow ?? yMin} y2={last.refHigh ?? yMax} fill="#10b981" fillOpacity={0.1} />
              )}
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} domain={[yMin, yMax]} ticks={ticks} allowDataOverflow />
              <Tooltip formatter={(v) => [`${v} ${last?.unit ?? ""}`, analyte]} />
              <Line isAnimationActive={false} type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 4, fill: "#0f766e" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-xs text-slate-400">{t("Green band shows the normal range. Ranges vary between labs.")}</p>
    </Card>
  );
}

/** Round a raw axis step to 1, 2, 2.5 or 5 × a power of ten. */
function niceStep(raw: number) {
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

// ---------- Add / import ----------

interface DraftRow {
  key: string;
  analyte: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
}

const toDraft = (r: Partial<ParsedRow>): DraftRow => ({
  key: uid(),
  analyte: r.analyte ?? "",
  value: r.value != null ? String(r.value) : "",
  unit: r.unit ?? "",
  refLow: r.refLow != null ? String(r.refLow) : "",
  refHigh: r.refHigh != null ? String(r.refHigh) : "",
});

function AddResultsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"manual" | "import">("manual");
  const [step, setStep] = useState<"enter" | "review">("enter");
  const [panelName, setPanelName] = useState("");
  const [date, setDate] = useState(today());
  const [facility, setFacility] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([toDraft({})]);
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setMode("manual");
    setStep("enter");
    setPanelName("");
    setDate(today());
    setFacility("");
    setRows([toDraft({})]);
    setText("");
    setErrors([]);
  }, [open]);

  const applyTemplate = (name: string) => {
    setPanelName(name);
    const tpl = PANEL_TEMPLATES[name];
    if (tpl) setRows(tpl.map((x) => toDraft({ ...x, value: undefined })));
  };

  const parse = () => {
    const res = parseResultsText(text);
    setErrors(res.errors);
    if (res.rows.length === 0) return toast.error(t("No results found. Use one line per test: name, value, unit, range."));
    setRows(res.rows.map(toDraft));
    if (!panelName) setPanelName(t("Imported results"));
    setStep("review");
  };

  const valid = rows.filter((r) => r.analyte.trim() && r.value.trim() !== "" && !Number.isNaN(Number(r.value)));

  const save = async () => {
    const panelId = uid();
    const num = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? undefined : Number(s));
    await db.transaction("rw", db.labPanels, db.labResults, async () => {
      await db.labPanels.add({ id: panelId, name: panelName.trim() || t("Lab results"), date, facilityName: facility || undefined, source: "patient", createdAt: nowIso() });
      await db.labResults.bulkAdd(
        valid.map((r) => ({ id: uid(), panelId, analyte: r.analyte.trim(), value: Number(r.value), unit: r.unit.trim(), refLow: num(r.refLow), refHigh: num(r.refHigh), date })),
      );
    });
    toast.success(t("{{count}} result(s) saved", { count: valid.length }));
    onClose();
  };

  const update = (key: string, patch: Partial<DraftRow>) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const showRows = mode === "manual" || step === "review";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("Add results")}
      footer={
        mode === "import" && step === "enter" ? (
          <Button className="w-full" disabled={!text.trim()} onClick={parse}>
            {t("Read results")}
          </Button>
        ) : (
          <Button className="w-full" disabled={valid.length === 0} onClick={() => void save()}>
            {t("Save {{count}} result(s)", { count: valid.length })}
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <Tabs
          value={mode}
          onChange={(v) => {
            setMode(v);
            setStep("enter");
          }}
          options={[
            { value: "manual", label: t("Type in") },
            { value: "import", label: t("Paste / import") },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Test date")}>{(id) => <Input id={id} type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label={t("Lab or clinic")}>{(id) => <Input id={id} value={facility} onChange={(e) => setFacility(e.target.value)} />}</Field>
        </div>
        {mode === "manual" && (
          <Field label={t("Test panel")}>
            {(id) => (
              <Select id={id} value={PANEL_TEMPLATES[panelName] ? panelName : ""} onChange={(e) => (e.target.value ? applyTemplate(e.target.value) : setPanelName(""))}>
                <option value="">{t("Other / custom")}</option>
                {Object.keys(PANEL_TEMPLATES).map((k) => (
                  <option key={k} value={k}>
                    {t(k)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {(mode === "manual" && !PANEL_TEMPLATES[panelName]) || step === "review" ? (
          <Field label={t("Panel name")}>{(id) => <Input id={id} value={panelName} onChange={(e) => setPanelName(e.target.value)} placeholder={t("e.g. Kidney function")} />}</Field>
        ) : null}

        {mode === "import" && step === "enter" && (
          <>
            <Notice tone="blue" icon={<ClipboardPaste className="h-4 w-4" />}>
              {t("Paste results from an email or lab portal. One test per line: name, value, unit, normal range.")}
              <code className="mt-1 block text-xs">Haemoglobin, 13.2, g/dL, 12-17</code>
            </Notice>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-40 font-mono text-xs" placeholder={"HbA1c, 6.8, %, 4-5.7\nCreatinine, 92, µmol/L, 45-110"} />
            <p className="text-xs text-slate-500">{t("Reading results from a photo or PDF is coming soon.")}</p>
          </>
        )}

        {step === "review" && (
          <Notice tone="amber">
            {t("Check each value against your report before saving.")}
            {errors.length > 0 && <span className="mt-1 block text-xs">{t("{{count}} line(s) couldn't be read and were skipped.", { count: errors.length })}</span>}
          </Notice>
        )}

        {showRows && (
          <div className="space-y-2">
            {rows.map((r) => {
              const preview = r.value && !Number.isNaN(Number(r.value)) ? flagFor({ value: Number(r.value), refLow: r.refLow ? Number(r.refLow) : undefined, refHigh: r.refHigh ? Number(r.refHigh) : undefined }) : "unknown";
              return (
                <div key={r.key} className={cn("space-y-2 rounded-xl p-3 ring-1", preview === "high" || preview === "low" ? "bg-red-50 ring-red-200" : "bg-slate-50 ring-slate-200")}>
                  <div className="flex gap-2">
                    <Input value={r.analyte} onChange={(e) => update(r.key, { analyte: e.target.value })} placeholder={t("Test name")} aria-label={t("Test name")} />
                    <Button variant="ghost" size="icon" onClick={() => setRows((cur) => cur.filter((x) => x.key !== r.key))} aria-label={t("Remove")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <Input inputMode="decimal" value={r.value} onChange={(e) => update(r.key, { value: e.target.value })} placeholder={t("Value")} aria-label={t("Value")} className="col-span-1" />
                    <Input value={r.unit} onChange={(e) => update(r.key, { unit: e.target.value })} placeholder={t("Unit")} aria-label={t("Unit")} />
                    <Input inputMode="decimal" value={r.refLow} onChange={(e) => update(r.key, { refLow: e.target.value })} placeholder={t("Low")} aria-label={t("Normal range low")} />
                    <Input inputMode="decimal" value={r.refHigh} onChange={(e) => update(r.key, { refHigh: e.target.value })} placeholder={t("High")} aria-label={t("Normal range high")} />
                  </div>
                </div>
              );
            })}
            <Button variant="secondary" size="sm" onClick={() => setRows((cur) => [...cur, toDraft({})])}>
              <Plus className="h-4 w-4" />
              {t("Add another test")}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
