import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { Camera, FileImage, FileText, Inbox, Paperclip, Plus, Search, Upload } from "lucide-react";
import { db } from "@/db/db";
import type { HealthRecord, RecordCategory } from "@/db/types";
import { Badge, Button, Card, Chips, ConfirmDialog, EmptyState, Field, Input, KeyValue, Select, Sheet, Textarea } from "@/components/ui";
import { Page, PageHeader } from "@/components/layout";
import { addRecord } from "@/db/actions";
import { active, useFormat } from "@/lib/hooks";
import { formatBytes, nowIso, today } from "@/lib/utils";

export const CATEGORY_LABELS: Record<RecordCategory, string> = {
  letter: "Clinic letter",
  radiology: "Radiology / scan",
  lab: "Lab report",
  prescription: "Prescription",
  discharge: "Discharge summary",
  other: "Other",
};

const MAX_FILE = 15 * 1024 * 1024;

export function RecordsPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [params, setParams] = useSearchParams();
  const all = active(useLiveQuery(() => db.records.orderBy("date").reverse().toArray(), []));
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | RecordCategory>("all");
  const [selected, setSelected] = useState<HealthRecord | null>(null);
  const uploadOpen = params.get("add") === "1";

  const list = useMemo(
    () =>
      all.filter(
        (r) =>
          (cat === "all" || r.category === cat) &&
          (!q || `${r.title} ${r.facilityName ?? ""} ${r.notes ?? ""}`.toLowerCase().includes(q.toLowerCase())),
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
          <p className="py-8 text-center text-sm text-slate-500">{t("No records match your search.")}</p>
        ) : (
          list.map((r) => (
            <Card key={r.id} onClick={() => setSelected(r)} className="flex items-start gap-3">
              <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700">{r.fileType?.startsWith("image/") ? <FileImage className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium leading-snug">{r.title}</p>
                  {r.source === "facility" && !r.seenAt && <Badge tone="blue">{t("New")}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t(CATEGORY_LABELS[r.category])} · {fmt.date(r.date)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
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
      <UploadSheet open={uploadOpen} onClose={() => setParams({}, { replace: true })} />
      <RecordDetail record={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function UploadSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [f, setF] = useState({ title: "", category: "letter" as RecordCategory, date: today(), facilityName: "", notes: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setFile(null);
      setF({ title: "", category: "letter", date: today(), facilityName: "", notes: "" });
    }
  }, [open]);

  const pick = (fl: FileList | null) => {
    const x = fl?.[0];
    if (!x) return;
    if (x.size > MAX_FILE) return toast.error(t("File is too large (max 15 MB)"));
    setFile(x);
    if (!f.title) setF((cur) => ({ ...cur, title: x.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") }));
  };

  const save = async () => {
    setBusy(true);
    try {
      await addRecord({ ...f, title: f.title.trim(), facilityName: f.facilityName || undefined, notes: f.notes || undefined, file: file ?? undefined });
      toast.success(t("Record saved"));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("Upload a record")}
      footer={
        <Button className="w-full" disabled={!f.title.trim() || busy} onClick={() => void save()}>
          {t("Save record")}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-300 p-4 text-sm text-slate-600 hover:border-brand-500">
            <Camera className="h-6 w-6 text-brand-700" />
            {t("Take photo")}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files)} />
          </label>
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-300 p-4 text-sm text-slate-600 hover:border-brand-500">
            <Upload className="h-6 w-6 text-brand-700" />
            {t("Choose file")}
            <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => pick(e.target.files)} />
          </label>
        </div>
        {file && (
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm">
            <Paperclip className="h-4 w-4 text-slate-500" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <span className="text-xs text-slate-500">{formatBytes(file.size)}</span>
          </div>
        )}
        <Field label={t("Title")} required>
          {(id) => <Input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t("e.g. Cardiology clinic letter")} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Type")}>
            {(id) => (
              <Select id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as RecordCategory })}>
                {(Object.keys(CATEGORY_LABELS) as RecordCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {t(CATEGORY_LABELS[c])}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("Date")}>{(id) => <Input id={id} type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</Field>
        </div>
        <Field label={t("Hospital or clinic")}>{(id) => <Input id={id} value={f.facilityName} onChange={(e) => setF({ ...f, facilityName: e.target.value })} />}</Field>
        <Field label={t("Notes")}>{(id) => <Textarea id={id} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder={t("Key points, e.g. what the doctor said")} />}</Field>
      </div>
    </Sheet>
  );
}

function RecordDetail({ record, onClose }: { record: HealthRecord | null; onClose: () => void }) {
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
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="flex flex-1">
              <Button className="flex-1">{t("Open file")}</Button>
            </a>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        {url && record.fileType?.startsWith("image/") && <img src={url} alt={record.title} className="max-h-80 w-full rounded-xl object-contain ring-1 ring-slate-200" />}
        <div className="divide-y divide-slate-100">
          <KeyValue label={t("Type")} value={t(CATEGORY_LABELS[record.category])} />
          <KeyValue label={t("Date")} value={fmt.date(record.date)} />
          <KeyValue label={t("Hospital or clinic")} value={record.facilityName} />
          <KeyValue label={t("Added by")} value={record.source === "facility" ? t("Care provider") : t("You")} />
          {record.fileName && <KeyValue label={t("File")} value={record.fileName} />}
        </div>
        {record.notes && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{record.notes}</p>}
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
