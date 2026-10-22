import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Activity, AlertTriangle, CalendarClock, Camera, FlaskConical, HeartPulse, Keyboard, ListTodo, Paperclip, Pill, ScanText, Syringe, Upload } from "lucide-react";
import { db } from "@/db/db";
import type { RecordCategory } from "@/db/types";
import { Button, Checkbox, Field, Input, Notice, Select, Sheet, Textarea } from "./ui";
import { VerificationCard } from "./VerificationCard";
import { ACTION_KIND_LABEL, CATEGORY_LABELS } from "@/lib/labels";
import { scanDocument, type ScanResult, type ScanStage } from "@/lib/scan";
import { existingFor, saveScannedRecord, type ScanSelection } from "@/db/scanActions";
import { extractionCount } from "@/domain/extract/parse";
import { findAllergyConflicts } from "@/domain/allergy";
import { conditionWarnings, interactionsWith } from "@/domain/interactions";
import { assess, formatVital, VITALS } from "@/domain/vitals";
import { flagFor } from "@/domain/labs";
import { standardise } from "@/domain/units";
import { useFormat, useProfile } from "@/lib/hooks";
import { ageOn, cn, formatBytes, today } from "@/lib/utils";

const MAX_FILE = 15 * 1024 * 1024;

const STAGE_TEXT: Record<ScanStage, string> = {
  opening: "Opening document…",
  reading: "Reading text…",
  recognising: "Recognising text on the page…",
  checking: "Checking stamp and signature…",
  extracting: "Finding health information…",
};

type Step = "pick" | "scanning" | "review";
type Group = keyof ScanSelection;

export function ScanUploadSheet({
  open,
  onClose,
  rescan,
  onManual,
}: {
  open: boolean;
  onClose: () => void;
  rescan?: { recordId: string; file: File } | null;
  /** Offer typing results in by hand (shown when opened from Results). */
  onManual?: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fmt = useFormat();
  const profile = useProfile();
  const allergies = useLiveQuery(() => db.allergies.toArray(), []) ?? [];
  const currentConditions = useLiveQuery(() => db.conditions.filter((x) => !x.archivedAt && x.status === "active").toArray(), []) ?? [];
  const currentMeds = useLiveQuery(() => db.medications.filter((x) => !x.archivedAt && x.status === "active").toArray(), []) ?? [];
  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<{ s: ScanStage; p?: number }>({ s: "opening" });
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", category: "letter" as RecordCategory, date: today(), facilityName: "", notes: "" });
  const [keep, setKeep] = useState<Record<string, boolean>>({});
  const [existing, setExisting] = useState<Awaited<ReturnType<typeof existingFor>> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("pick");
    setFile(null);
    setScan(null);
    setScanError(null);
    setForm({ title: "", category: "letter", date: today(), facilityName: "", notes: "" });
    setKeep({});
    if (rescan) void scanFile(rescan.file);
    // Start once per opening.
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (fl: FileList | null) => {
    const f = fl?.[0];
    if (!f) return;
    if (f.size > MAX_FILE) return toast.error(t("File is too large (max 15 MB)"));
    await scanFile(f);
  };

  const scanFile = async (f: File) => {
    setFile(f);
    setStep("scanning");
    setScanError(null);
    try {
      const facilities = await db.facilities.toArray();
      const [result, ex] = await Promise.all([scanDocument(f, { facilities, profile }, (s, p) => setStage({ s, p })), existingFor()]);
      const e = result.extraction;
      setScan(result);
      setExisting(ex);
      setForm({
        title: e.title,
        category: e.docType,
        date: e.date ?? today(),
        facilityName: e.facilityName ?? "",
        notes: e.notes ?? "",
      });
      // Tick everything new by default; leave duplicates unticked.
      const k: Record<string, boolean> = {};
      e.conditions.forEach((c, i) => (k[`conditions:${i}`] = !ex.hasCondition(c)));
      e.allergies.forEach((a, i) => (k[`allergies:${i}`] = !ex.hasAllergy(a)));
      e.medications.forEach((m, i) => (k[`medications:${i}`] = ex.medicationChange(m) !== "same"));
      e.immunisations.forEach((v, i) => (k[`immunisations:${i}`] = !ex.hasImmunisation(v)));
      e.labs.forEach((l, i) => (k[`labs:${i}`] = !ex.hasLab(l, e.date)));
      e.followUps.forEach((_, i) => (k[`followUps:${i}`] = true));
      e.actions.forEach((_, i) => (k[`actions:${i}`] = true));
      e.vitals.forEach((_, i) => (k[`vitals:${i}`] = true));
      setKeep(k);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
      setForm((cur) => ({ ...cur, title: f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") }));
    }
    setStep("review");
  };

  const selection = useMemo<ScanSelection>(() => {
    const e = scan?.extraction;
    const sel = <T,>(g: Group, arr: T[] | undefined) => (arr ?? []).filter((_, i) => keep[`${g}:${i}`]);
    return {
      labs: sel("labs", e?.labs),
      conditions: sel("conditions", e?.conditions),
      medications: sel("medications", e?.medications),
      allergies: sel("allergies", e?.allergies),
      immunisations: sel("immunisations", e?.immunisations),
      followUps: sel("followUps", e?.followUps),
      actions: sel("actions", e?.actions),
      vitals: sel("vitals", e?.vitals),
    };
  }, [scan, keep]);
  const selectedCount = Object.values(selection).reduce((s, a) => s + a.length, 0);

  const save = async () => {
    setBusy(true);
    try {
      const res = await saveScannedRecord({
        file: file ?? undefined,
        title: form.title.trim(),
        category: form.category,
        date: form.date,
        facilityName: form.facilityName || undefined,
        notes: form.notes || undefined,
        verification: scan?.verification,
        scannedText: scan?.text,
        selected: selection,
        existingRecordId: rescan?.recordId,
      });
      toast.success(res.added ? t("Record saved and {{count}} item(s) added", { count: res.added }) : t("Record saved"));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key: string) => (v: boolean) => setKeep((k) => ({ ...k, [key]: v }));
  const e = scan?.extraction;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={step === "review" ? t("Check and save") : rescan ? t("Scan again") : t("Upload a record")}
      footer={
        step === "review" ? (
          <Button className="w-full" disabled={!form.title.trim() || busy} onClick={() => void save()}>
            {selectedCount ? t("Save record and add {{count}} item(s)", { count: selectedCount }) : t("Save record")}
          </Button>
        ) : undefined
      }
    >
      {step === "pick" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[24px] bg-lavender p-5 text-sm font-bold">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/70">
                <Camera className="h-6 w-6" />
              </span>
              {t("Take photo")}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(ev) => void pick(ev.target.files)} />
            </label>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[24px] bg-peach p-5 text-sm font-bold">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/70">
                <Upload className="h-6 w-6" />
              </span>
              {t("Choose file")}
              <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(ev) => void pick(ev.target.files)} />
            </label>
          </div>
          <Notice tone="blue" icon={<ScanText className="h-4 w-4" />}>
            {t("We'll scan the document on your phone and pick out diagnoses, medicines, allergies, results and vaccines for you to check. Nothing is sent anywhere.")}
          </Notice>
          <p className="text-xs text-ink/55">
            {t("Printed documents from a licensed clinic that are dated, stamped or signed are marked as a verified source. Handwritten notes are saved as unverified.")}
          </p>
          {onManual && (
            <button type="button" onClick={onManual} className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-bold ring-1 ring-ink/10">
              <Keyboard className="h-4 w-4" />
              {t("No document? Type results in")}
            </button>
          )}
        </div>
      )}

      {step === "scanning" && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="shape-flower flex h-20 w-20 animate-pulse items-center justify-center bg-lavender">
            <ScanText className="h-8 w-8" />
          </div>
          <p className="text-lg font-extrabold">{t(STAGE_TEXT[stage.s])}</p>
          <div className="h-2 w-56 overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-ink transition-all"
              style={{ width: `${Math.round(((stage.p ?? 0.5) * 0.7 + ["opening", "reading", "recognising", "checking", "extracting"].indexOf(stage.s) * 0.06) * 100)}%` }}
            />
          </div>
          {stage.s === "recognising" && <p className="max-w-xs text-xs text-ink/55">{t("Reading a photo can take up to a minute the first time.")}</p>}
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          {file && (
            <div className="flex items-center gap-3 rounded-2xl bg-cream p-3">
              {scan?.thumbnail ? <img src={scan.thumbnail} alt="" className="h-16 w-12 rounded-lg object-cover ring-1 ring-ink/10" /> : <Paperclip className="h-5 w-5" />}
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-semibold">{file.name}</p>
                <p className="text-xs text-ink/55">
                  {formatBytes(file.size)}
                  {scan?.ocrConfidence !== undefined && ` · ${t("read with {{pct}}% confidence", { pct: Math.round(scan.ocrConfidence) })}`}
                </p>
              </div>
            </div>
          )}

          {scanError && <Notice tone="amber">{t("We couldn't scan this file, so please fill in the details yourself.")} <span className="block text-xs">{scanError}</span></Notice>}
          {scan && <VerificationCard v={scan.verification} />}
          {scan?.verification.handwritten && (
            <Notice tone="amber">{t("Handwriting is hard to read automatically. Check every item carefully and correct or untick anything that's wrong.")}</Notice>
          )}
          {e?.patientMatch === "mismatch" && (
            <Notice tone="red" icon={<AlertTriangle className="h-4 w-4" />}>
              {t("This document seems to be for someone else ({{name}}). Only save it if it's yours.", { name: e.patientName ?? "?" })}
            </Notice>
          )}

          <div className="space-y-3 rounded-[24px] bg-white p-1">
            <Field label={t("Title")} required>
              {(id) => <Input id={id} value={form.title} onChange={(ev) => setForm({ ...form, title: ev.target.value })} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Type")}>
                {(id) => (
                  <Select id={id} value={form.category} onChange={(ev) => setForm({ ...form, category: ev.target.value as RecordCategory })}>
                    {(Object.keys(CATEGORY_LABELS) as RecordCategory[]).map((c) => (
                      <option key={c} value={c}>
                        {t(CATEGORY_LABELS[c])}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t("Date")}>{(id) => <Input id={id} type="date" max={today()} value={form.date} onChange={(ev) => setForm({ ...form, date: ev.target.value })} />}</Field>
            </div>
            <Field label={t("Hospital or clinic")}>{(id) => <Input id={id} value={form.facilityName} onChange={(ev) => setForm({ ...form, facilityName: ev.target.value })} />}</Field>
          </div>

          {e && e.docType === "lab" && e.labs.length === 0 && (
            <Notice tone="amber" icon={<FlaskConical className="h-4 w-4" />}>
              {t("This looks like a lab report, but we couldn't read its results table. You can add the results yourself on the Results page.")}{" "}
              <a href="#" onClick={(ev) => { ev.preventDefault(); onClose(); navigate("/results?manual=1"); }} className="font-bold underline">
                {t("Add results")}
              </a>
            </Notice>
          )}
          {e && extractionCount(e) > 0 ? (
            <div className="space-y-3">
              <div>
                <p className="text-lg font-extrabold">{t("Found in this document")}</p>
                <p className="text-xs text-ink/55">{t("Untick anything you don't want to add. Items already in your record are unticked.")}</p>
              </div>
              <ItemGroup icon={<Activity className="h-4 w-4" />} tone="bg-mint" title={t("Conditions")} count={e.conditions.length}>
                {e.conditions.map((c, i) => (
                  <Item key={i} checked={!!keep[`conditions:${i}`]} onChange={toggle(`conditions:${i}`)} title={c.name} detail={c.status === "resolved" ? t("Resolved") : c.chronic ? t("Long-term") : t("Active")} dup={existing?.hasCondition(c)} />
                ))}
              </ItemGroup>
              <ItemGroup icon={<AlertTriangle className="h-4 w-4" />} tone="bg-coral" title={t("Allergies")} count={e.allergies.length}>
                {e.allergies.map((a, i) => (
                  <Item key={i} checked={!!keep[`allergies:${i}`]} onChange={toggle(`allergies:${i}`)} title={a.substance} detail={[a.reaction, t(a.severity === "severe" ? "Severe" : a.severity === "mild" ? "Mild" : "Moderate")].filter(Boolean).join(" · ")} dup={existing?.hasAllergy(a)} />
                ))}
              </ItemGroup>
              <ItemGroup icon={<Pill className="h-4 w-4" />} tone="bg-sky" title={t("Medicines")} count={e.medications.length}>
                {e.medications.map((m, i) => {
                  const change = existing?.medicationChange(m);
                  const conflict = findAllergyConflicts(m.name, allergies)[0];
                  // Against the patient's current medicines and the others in this document.
                  const others = [...new Set([...currentMeds.map((x) => x.name), ...e.medications.map((x) => x.name)])].filter((n) => n.toLowerCase() !== m.name.toLowerCase());
                  const clash = interactionsWith(m.name, others)[0];
                  const caution = conditionWarnings(m.name, [...currentConditions.map((c) => c.name), ...e.conditions.map((c) => c.name)], profile?.dob ? ageOn(profile.dob) : undefined)[0];
                  return (
                    <Item
                      key={i}
                      checked={!!keep[`medications:${i}`]}
                      onChange={toggle(`medications:${i}`)}
                      title={`${m.name} ${m.dose}`}
                      detail={[m.frequency, m.type === "acute" ? t("Short course") : "", m.status === "stopped" ? t("Stopped") : ""].filter(Boolean).join(" · ")}
                      dup={change === "same"}
                      tag={change === "update" ? t("Update: was {{dose}}", { dose: existing?.currentDose(m) ?? "" }) : undefined}
                      warning={
                        conflict
                          ? t("Allergy warning: {{substance}}", { substance: conflict.allergy.substance })
                          : clash
                            ? `${clash.kind === "duplicate" ? t("Same type") : t("Interaction")}: ${clash.meds.join(" + ")}. ${t(clash.effect)}`
                            : caution
                              ? `${t("Condition")}: ${caution.condition}. ${t(caution.effect)}`
                              : undefined
                      }
                    />
                  );
                })}
              </ItemGroup>
              <ItemGroup icon={<FlaskConical className="h-4 w-4" />} tone="bg-peach" title={t("Lab results")} count={e.labs.length}>
                {e.labs.map((l, i) => {
                  const std = standardise(l.analyte, l.value, l.unit, l.refLow, l.refHigh);
                  const f = flagFor(std);
                  return (
                    <Item
                      key={i}
                      checked={!!keep[`labs:${i}`]}
                      onChange={toggle(`labs:${i}`)}
                      title={l.analyte}
                      detail={std.originalUnit ? t("Converted from {{value}} {{unit}}", { value: l.value, unit: l.unit || "?" }) : t(l.panel)}
                      value={`${std.value} ${std.unit}${f === "high" ? " ↑" : f === "low" ? " ↓" : ""}`}
                      valueTone={f === "high" || f === "low" ? "text-red-600" : undefined}
                      dup={existing?.hasLab(l, e.date)}
                    />
                  );
                })}
              </ItemGroup>
              <ItemGroup icon={<Syringe className="h-4 w-4" />} tone="bg-butter" title={t("Immunisations")} count={e.immunisations.length}>
                {e.immunisations.map((v, i) => (
                  <Item
                    key={i}
                    checked={!!keep[`immunisations:${i}`]}
                    onChange={toggle(`immunisations:${i}`)}
                    title={v.vaccine}
                    detail={[t("Dose {{n}} of {{total}}", { n: v.doseNumber, total: Math.max(1, v.doseNumber) }), v.dateGiven ? fmt.date(v.dateGiven) : "", v.batchNumber ? `${t("Batch")} ${v.batchNumber}` : ""].filter(Boolean).join(" · ")}
                    dup={existing?.hasImmunisation(v)}
                  />
                ))}
              </ItemGroup>
              <ItemGroup icon={<HeartPulse className="h-4 w-4" />} tone="bg-sage" title={t("Vitals")} count={e.vitals.length}>
                {e.vitals.map((v, i) => {
                  const a = assess(v.kind, v.value, v.value2, profile?.sex);
                  return (
                    <Item
                      key={i}
                      checked={!!keep[`vitals:${i}`]}
                      onChange={toggle(`vitals:${i}`)}
                      title={t(VITALS[v.kind].label)}
                      detail={a ? t(a.label) : undefined}
                      value={`${formatVital(v.kind, v.value, v.value2)} ${VITALS[v.kind].unit}`}
                      valueTone={a && (a.tone === "high" || a.tone === "low") ? "text-red-600" : undefined}
                    />
                  );
                })}
              </ItemGroup>
              <ItemGroup icon={<ListTodo className="h-4 w-4" />} tone="bg-rose" title={t("To do")} count={e.actions.length}>
                {e.actions.map((a, i) => (
                  <Item
                    key={i}
                    checked={!!keep[`actions:${i}`]}
                    onChange={toggle(`actions:${i}`)}
                    title={a.text}
                    detail={[a.forGp ? t("For your GP") : t(ACTION_KIND_LABEL[a.kind]), a.due ? t("By {{date}}", { date: fmt.date(a.due) }) : ""].filter(Boolean).join(" · ")}
                  />
                ))}
              </ItemGroup>
              <ItemGroup icon={<CalendarClock className="h-4 w-4" />} tone="bg-lavender" title={t("Follow-ups for your calendar")} count={e.followUps.length}>
                {e.followUps.map((f, i) => (
                  <Item key={i} checked={!!keep[`followUps:${i}`]} onChange={toggle(`followUps:${i}`)} title={t(f.title)} detail={fmt.date(f.date)} />
                ))}
              </ItemGroup>
            </div>
          ) : (
            scan && <Notice tone="blue">{t("We didn't find health details to add automatically. The document will still be saved, and you can add details yourself.")}</Notice>
          )}

          <Field label={t("Notes")}>{(id) => <Textarea id={id} value={form.notes} onChange={(ev) => setForm({ ...form, notes: ev.target.value })} placeholder={t("Key points, e.g. what the doctor said")} />}</Field>

          {scan?.text && (
            <details className="rounded-2xl bg-cream p-3 text-xs">
              <summary className="cursor-pointer font-semibold">{t("Text we read")}</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-ink/70">{scan.text}</pre>
            </details>
          )}
        </div>
      )}
    </Sheet>
  );
}

function ItemGroup({ icon, tone, title, count, children }: { icon: React.ReactNode; tone: string; title: string; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <section className="rounded-[24px] bg-cream p-3">
      <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-extrabold">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-ink", tone)}>{icon}</span>
        {title}
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs">{count}</span>
      </h3>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

function Item({
  checked,
  onChange,
  title,
  detail,
  value,
  valueTone,
  dup,
  tag,
  warning,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  detail?: string;
  value?: string;
  valueTone?: string;
  dup?: boolean;
  tag?: string;
  warning?: string;
}) {
  const { t } = useTranslation();
  return (
    <li className={cn("rounded-2xl bg-white px-3 py-2.5", !checked && "opacity-60")}>
      <Checkbox checked={checked} onChange={onChange}>
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block font-bold text-ink">{title}</span>
            {detail && <span className="block text-xs text-ink/60">{detail}</span>}
            {dup && <span className="mt-1 inline-block rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-ink/60">{t("Already in your record")}</span>}
            {tag && <span className="mt-1 inline-block rounded-full bg-lavender px-2 py-0.5 text-[11px] font-semibold">{tag}</span>}
            {warning && <span className="mt-1 block text-xs font-semibold text-red-600">{warning}</span>}
          </span>
          {value && <span className={cn("shrink-0 text-sm font-extrabold", valueTone)}>{value}</span>}
        </span>
      </Checkbox>
    </li>
  );
}
