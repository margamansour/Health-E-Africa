import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgeCheck, ChevronDown, ClipboardPaste, FlaskConical, History, Plus, Trash2 } from "lucide-react";
import { db } from "@/db/db";
import type { LabPanel, LabResult } from "@/db/types";
import { Button, Card, EmptyState, Field, Input, Notice, Select, Sheet, Tabs, Textarea } from "@/components/ui";
import { Page, PageHeader } from "@/components/layout";
import { analyteOrder, flagFor, LAB_GROUPS, labGroupFor, PANEL_TEMPLATES, parseResultsText, type ParsedRow } from "@/domain/labs";
import { active, useFormat, useVerifiedRecordIds } from "@/lib/hooks";
import { ScanUploadSheet } from "@/components/ScanUploadSheet";
import { SourceDocumentSheet } from "@/components/SourceDocumentSheet";
import { cn, nowIso, today, uid } from "@/lib/utils";

type View = "panels" | "table" | "graph";

export function ResultsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>("panels");
  const [source, setSource] = useState<LabResult | null>(null);
  const panels = active(useLiveQuery(() => db.labPanels.orderBy("date").reverse().toArray(), []));
  const results = useLiveQuery(() => db.labResults.orderBy("date").toArray(), []) ?? [];
  const liveResults = useMemo(() => {
    const ids = new Set(panels.map((p) => p.id));
    return results.filter((r) => ids.has(r.panelId));
  }, [panels, results]);
  const panelById = useMemo(() => new Map(panels.map((p) => [p.id, p])), [panels]);
  // "Add" offers the same choices as uploading a record; typing results in is still possible.
  const uploadOpen = params.get("add") === "1";
  const manualOpen = params.get("manual") === "1";

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
            {view === "panels" && <GroupedView results={liveResults} panelById={panelById} onOpenSource={setSource} />}
            {view === "table" && <TableView results={liveResults} onOpenSource={setSource} />}
            {view === "graph" && <GraphView results={liveResults} />}
            {view !== "graph" && <p className="px-1 text-center text-xs text-ink/45">{t("Tap a value to see the document it came from.")}</p>}
          </>
        )}
      </Page>
      <ScanUploadSheet open={uploadOpen} onClose={() => setParams({}, { replace: true })} onManual={() => setParams({ manual: "1" }, { replace: true })} />
      <AddResultsSheet open={manualOpen} onClose={() => setParams({}, { replace: true })} />
      <SourceDocumentSheet result={source} panel={source ? panelById.get(source.panelId) : undefined} onClose={() => setSource(null)} />
    </>
  );
}

function ValueCell({ r }: { r: LabResult }) {
  const f = flagFor(r);
  return (
    <span className={cn("font-semibold", f === "high" || f === "low" ? "text-red-600" : "text-ink")}>
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

/** Results grouped under clinical headings (CBC, U&Es, LFTs…), latest value first, history on tap. */
function GroupedView({ results, panelById, onOpenSource }: { results: LabResult[]; panelById: Map<string, LabPanel>; onOpenSource: (r: LabResult) => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const verifiedIds = useVerifiedRecordIds();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [openTests, setOpenTests] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const byGroup = new Map<string, Map<string, LabResult[]>>();
    for (const r of results) {
      const g = labGroupFor(r.analyte, panelById.get(r.panelId)?.name);
      const tests = byGroup.get(g) ?? new Map<string, LabResult[]>();
      tests.set(r.analyte, [...(tests.get(r.analyte) ?? []), r]);
      byGroup.set(g, tests);
    }
    return LAB_GROUPS.filter((g) => byGroup.has(g.key)).map((g) => {
      const tests = [...byGroup.get(g.key)!.entries()]
        .map(([analyte, rows]) => ({ analyte, rows: rows.sort((x, y) => y.date.localeCompare(x.date)) }))
        .sort((x, y) => analyteOrder(x.analyte) - analyteOrder(y.analyte) || x.analyte.localeCompare(y.analyte));
      const latestDate = tests.reduce((d, x) => (x.rows[0]!.date > d ? x.rows[0]!.date : d), "");
      const abnormal = tests.filter((x) => ["high", "low"].includes(flagFor(x.rows[0]!))).length;
      return { ...g, tests, latestDate, abnormal };
    });
  }, [results, panelById]);

  const toggle = (set: Set<string>, key: string, update: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    update(next);
  };

  const sourceBadge = (r: LabResult) => {
    const p = panelById.get(r.panelId);
    if (p?.sourceRecordId) return verifiedIds.has(p.sourceRecordId) ? <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" aria-label={t("From a verified document")} /> : null;
    return null;
  };

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const open = openGroups.has(g.key);
        return (
          <Card key={g.key} tone={g.tone} className="p-0">
            <button type="button" className="flex w-full items-center gap-3 px-4 py-3.5 text-left" aria-expanded={open} onClick={() => toggle(openGroups, g.key, setOpenGroups)}>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-xl font-extrabold">{t(g.label)}</span>
                  <span className="truncate text-xs font-semibold text-ink/55">{t(g.full)}</span>
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="rounded-full bg-white/70 px-2 py-0.5 font-bold">{t("{{count}} test(s)", { count: g.tests.length })}</span>
                  {g.abnormal > 0 ? (
                    <span className="rounded-full bg-white/70 px-2 py-0.5 font-bold text-red-600">{t("{{count}} out of range", { count: g.abnormal })}</span>
                  ) : (
                    <span className="rounded-full bg-white/70 px-2 py-0.5 font-bold text-emerald-700">{t("All in range")}</span>
                  )}
                  <span className="text-ink/55">{t("Latest {{date}}", { date: fmt.date(g.latestDate) })}</span>
                </span>
              </span>
              <ChevronDown className={cn("h-5 w-5 shrink-0 transition", open && "rotate-180")} />
            </button>
            {open && (
              <ul className="space-y-1.5 px-2 pb-2">
                {g.tests.map(({ analyte, rows }) => {
                  const latest = rows[0]!;
                  const key = `${g.key}:${analyte}`;
                  const histOpen = openTests.has(key);
                  return (
                    <li key={analyte} className="rounded-2xl bg-white px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1 text-sm font-bold">
                            <span className="truncate">{analyte}</span>
                            {sourceBadge(latest)}
                          </p>
                          <p className="text-[11px] text-ink/50">
                            {fmt.date(latest.date)}
                            {range(latest) && ` · ${t("Normal range")} ${range(latest)}`}
                          </p>
                        </div>
                        <ValueButton r={latest} onClick={() => onOpenSource(latest)} />
                      </div>
                      {rows.length > 1 && (
                        <>
                          <button type="button" className="mt-1 flex items-center gap-1 text-[11px] font-bold text-ink/60" onClick={() => toggle(openTests, key, setOpenTests)}>
                            <History className="h-3 w-3" />
                            {histOpen ? t("Hide earlier results") : t("{{count}} earlier result(s)", { count: rows.length - 1 })}
                          </button>
                          {histOpen && (
                            <ul className="mt-1.5 divide-y divide-ink/5 border-t border-ink/5">
                              {rows.slice(1).map((r) => (
                                <li key={r.id} className="flex items-center justify-between py-1.5 text-xs">
                                  <span className="text-ink/60">{fmt.date(r.date)}</span>
                                  <ValueButton r={r} small onClick={() => onOpenSource(r)} />
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/** A result value that opens the document it came from. */
function ValueButton({ r, onClick, small }: { r: LabResult; onClick: () => void; small?: boolean }) {
  const { t } = useTranslation();
  const f = flagFor(r);
  const bad = f === "high" || f === "low";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("{{name}} {{value}} {{unit}}: show source document", { name: r.analyte, value: r.value, unit: r.unit })}
      className={cn(
        "shrink-0 rounded-full px-3 py-1 text-right font-extrabold underline decoration-dotted underline-offset-4 transition active:scale-95",
        small ? "text-xs" : "text-base",
        bad ? "bg-coral/40 text-red-700" : "bg-cream text-ink",
      )}
    >
      {r.value}
      {f === "high" ? " ↑" : f === "low" ? " ↓" : ""} <span className="text-[11px] font-semibold text-ink/55 no-underline">{r.unit}</span>
    </button>
  );
}

function TableView({ results, onOpenSource }: { results: LabResult[]; onOpenSource: (r: LabResult) => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const analytes = [...new Set(results.map((r) => r.analyte))].sort();
  const dates = [...new Set(results.map((r) => r.date))].sort().reverse();
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="bg-cream text-xs text-ink/55">
          <tr>
            <th className="sticky left-0 bg-cream px-3 py-2 text-left">{t("Test")}</th>
            {dates.map((d) => (
              <th key={d} className="whitespace-nowrap px-3 py-2 text-right">
                {fmt.date(d, { day: "numeric", month: "short", year: "2-digit" })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {analytes.map((a) => (
            <tr key={a} className="border-t border-ink/10">
              <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-2 text-ink/80">{a}</td>
              {dates.map((d) => {
                const r = results.find((x) => x.analyte === a && x.date === d);
                return (
                  <td key={d} className="px-3 py-2 text-right">
                    {r ? (
                      <button type="button" className="underline decoration-dotted underline-offset-4" onClick={() => onOpenSource(r)}>
                        <ValueCell r={r} />
                      </button>
                    ) : (
                      <span className="text-ink/25">—</span>
                    )}
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
          <span className="text-sm text-ink/55">{last.unit}</span>
          <span className="ml-auto text-xs text-ink/55">
            {t("Normal range")}: {range(last) || "—"}
          </span>
        </div>
      )}
      {series.length < 2 ? (
        <p className="py-6 text-center text-sm text-ink/55">{t("Add more results for this test to see a trend.")}</p>
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="rgba(35,32,47,0.08)" vertical={false} />
              {last && (last.refLow != null || last.refHigh != null) && (
                <ReferenceArea y1={last.refLow ?? yMin} y2={last.refHigh ?? yMax} fill="#c9ebe2" fillOpacity={0.7} />
              )}
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} domain={[yMin, yMax]} ticks={ticks} allowDataOverflow />
              <Tooltip formatter={(v) => [`${v} ${last?.unit ?? ""}`, analyte]} />
              <Line isAnimationActive={false} type="monotone" dataKey="value" stroke="#6c5fd8" strokeWidth={3} dot={{ r: 5, fill: "#23202f", stroke: "#fff", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-xs text-ink/40">{t("Green band shows the normal range. Ranges vary between labs.")}</p>
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
            <p className="text-xs text-ink/55">{t("Reading results from a photo or PDF is coming soon.")}</p>
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
                <div key={r.key} className={cn("space-y-2 rounded-2xl p-3 ring-1", preview === "high" || preview === "low" ? "bg-red-50 ring-red-200" : "bg-cream ring-ink/10")}>
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
