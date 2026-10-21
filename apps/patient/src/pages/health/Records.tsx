import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { Activity, AlertTriangle, ScanText, FileImage, FileText, FlaskConical, Inbox, Paperclip, Pill, Plus, Search, Syringe, Upload } from "lucide-react";
import { db } from "@/db/db";
import type { HealthRecord, RecordCategory } from "@/db/types";
import { Badge, Button, Card, Chips, ConfirmDialog, EmptyState, Input, KeyValue, Sheet } from "@/components/ui";
import { ScanUploadSheet } from "@/components/ScanUploadSheet";
import { VerificationCard, VerifiedBadge } from "@/components/VerificationCard";
import { CATEGORY_LABELS } from "@/lib/labels";
import { Page, PageHeader } from "@/components/layout";
import { active, useFormat } from "@/lib/hooks";
import { nowIso } from "@/lib/utils";

export { CATEGORY_LABELS };

export function RecordsPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [params, setParams] = useSearchParams();
  const all = active(useLiveQuery(() => db.records.orderBy("date").reverse().toArray(), []));
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | RecordCategory>("all");
  const [selected, setSelected] = useState<HealthRecord | null>(null);
  const [rescan, setRescan] = useState<{ recordId: string; file: File } | null>(null);
  const uploadOpen = params.get("add") === "1" || !!rescan;
  // Opened from a result's "source" link.
  const openId = params.get("open");
  useEffect(() => {
    if (!openId) return;
    void db.records.get(openId).then((r) => r && setSelected(r));
    setParams({}, { replace: true });
  }, [openId, setParams]);

  const list = useMemo(
    () =>
      all.filter(
        (r) =>
          (cat === "all" || r.category === cat) &&
          (!q || `${r.title} ${r.facilityName ?? ""} ${r.notes ?? ""} ${r.scannedText ?? ""}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [all, q, cat],
  );

  return (
    <>
      <PageHeader
        title={t("Records")}
        back
        action={
          <Button size="sm" onClick={() => setParams({ add: "1" })}>
            <Upload className="h-4 w-4" />
            {t("Upload")}
          </Button>
        }
      />
      <Page>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search records")} className="pl-9" />
        </div>
        <Chips
          value={cat}
          onChange={setCat}
          options={[{ value: "all" as const, label: t("All") }, ...(Object.keys(CATEGORY_LABELS) as RecordCategory[]).map((c) => ({ value: c, label: t(CATEGORY_LABELS[c]) }))]}
        />
        {all.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title={t("No records yet")}
            body={t("Upload clinic letters, scan reports, blood results and prescriptions. Take a photo or choose a PDF.")}
            action={
              <Button onClick={() => setParams({ add: "1" })}>
                <Plus className="h-4 w-4" />
                {t("Upload a record")}
              </Button>
            }
          />
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/55">{t("No records match your search.")}</p>
        ) : (
          list.map((r) => (
            <Card key={r.id} onClick={() => setSelected(r)} className="flex items-start gap-3">
              <span className="rounded-2xl bg-brand-50 p-2.5 text-brand-700">{r.fileType?.startsWith("image/") ? <FileImage className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium leading-snug">{r.title}</p>
                  {r.source === "facility" && !r.seenAt && <Badge tone="blue">{t("New")}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-ink/55">
                  {t(CATEGORY_LABELS[r.category])} · {fmt.date(r.date)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.verification && <VerifiedBadge verified={r.verification.status === "verified"} />}
                  {r.source === "facility" && (
                    <Badge tone="brand">
                      <Inbox className="h-3 w-3" />
                      {t("Received from {{name}}", { name: r.facilityName ?? t("facility") })}
                    </Badge>
                  )}
                  {r.fileId && (
                    <Badge>
                      <Paperclip className="h-3 w-3" />
                      {t("File")}
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </Page>
      <ScanUploadSheet
        open={uploadOpen}
        rescan={rescan}
        onClose={() => {
          setRescan(null);
          setParams({}, { replace: true });
        }}
      />
      <RecordDetail
        record={selected}
        onClose={() => setSelected(null)}
        onRescan={async (r) => {
          const f = r.fileId ? await db.files.get(r.fileId) : undefined;
          if (!f) return;
          setSelected(null);
          setRescan({ recordId: r.id, file: new File([f.blob], f.name, { type: f.type }) });
        }}
      />
    </>
  );
}

function RecordDetail({ record, onClose, onRescan }: { record: HealthRecord | null; onClose: () => void; onRescan: (r: HealthRecord) => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [url, setUrl] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    setUrl(null);
    if (!record) return;
    if (record.source === "facility" && !record.seenAt) void db.records.update(record.id, { seenAt: nowIso() });
    if (record.fileId)
      void db.files.get(record.fileId).then((f) => {
        if (f) {
          objectUrl = URL.createObjectURL(f.blob);
          setUrl(objectUrl);
        }
      });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [record]);

  if (!record) return null;
  return (
    <Sheet
      open={!!record}
      onClose={onClose}
      title={record.title}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" className="text-red-600" onClick={() => setConfirm(true)}>
            {t("Remove")}
          </Button>
          {record.fileId && (record.fileType === "application/pdf" || record.fileType?.startsWith("image/")) && (
            <Button variant="secondary" onClick={() => onRescan(record)}>
              <ScanText className="h-4 w-4" />
              {t("Scan again")}
            </Button>
          )}
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="flex flex-1">
              <Button className="flex-1">{t("Open file")}</Button>
            </a>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        {url && record.fileType?.startsWith("image/") && <img src={url} alt={record.title} className="max-h-80 w-full rounded-2xl object-contain ring-1 ring-ink/10" />}
        <div className="divide-y divide-ink/5">
          <KeyValue label={t("Type")} value={t(CATEGORY_LABELS[record.category])} />
          <KeyValue label={t("Date")} value={fmt.date(record.date)} />
          <KeyValue label={t("Hospital or clinic")} value={record.facilityName} />
          <KeyValue label={t("Added by")} value={record.source === "facility" ? t("Care provider") : t("You")} />
          {record.fileName && <KeyValue label={t("File")} value={record.fileName} />}
        </div>
        {record.notes && <p className="rounded-2xl bg-cream p-3 text-sm text-ink/80">{record.notes}</p>}
        {record.verification && <VerificationCard v={record.verification} />}
        {record.source === "facility" && !record.verification && (
          <p className="rounded-2xl bg-mint p-3 text-sm font-semibold">{t("Sent directly by your care provider through the app, so it's a verified source.")}</p>
        )}
        <AddedFromRecord recordId={record.id} />
      </div>
      <ConfirmDialog
        open={confirm}
        title={t("Remove this record?")}
        message={t("It will be hidden from your records. A secure copy is kept, as health records must be kept by law.")}
        confirmLabel={t("Remove")}
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          await db.records.update(record.id, { archivedAt: nowIso() });
          setConfirm(false);
          onClose();
        }}
      />
    </Sheet>
  );
}

/** Items that were added to the patient's record from this document. */
function AddedFromRecord({ recordId }: { recordId: string }) {
  const { t } = useTranslation();
  const data = useLiveQuery(async () => {
    const by = <T extends { sourceRecordId?: string; archivedAt?: string }>(rows: T[]) => rows.filter((r) => r.sourceRecordId === recordId && !r.archivedAt);
    const [c, a, m, i, p] = await Promise.all([db.conditions.toArray(), db.allergies.toArray(), db.medications.toArray(), db.immunisations.toArray(), db.labPanels.toArray()]);
    const panels = by(p);
    const results = panels.length ? await db.labResults.where("panelId").anyOf(panels.map((x) => x.id)).toArray() : [];
    return { conditions: by(c), allergies: by(a), medications: by(m), immunisations: by(i), results };
  }, [recordId]);
  if (!data) return null;
  const rows = [
    { icon: Activity, label: t("Conditions"), items: data.conditions.map((x) => x.name) },
    { icon: AlertTriangle, label: t("Allergies"), items: data.allergies.map((x) => x.substance) },
    { icon: Pill, label: t("Medicines"), items: data.medications.map((x) => `${x.name} ${x.dose}`) },
    { icon: FlaskConical, label: t("Lab results"), items: data.results.map((x) => `${x.analyte} ${x.value} ${x.unit}`) },
    { icon: Syringe, label: t("Immunisations"), items: data.immunisations.map((x) => x.vaccine) },
  ].filter((r) => r.items.length);
  if (!rows.length) return null;
  return (
    <div className="space-y-2 rounded-[24px] bg-cream p-4">
      <p className="text-sm font-extrabold">{t("Added to your record from this document")}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex gap-2 text-sm">
          <r.icon className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">{r.label}:</span> <span className="text-ink/70">{r.items.join(", ")}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
