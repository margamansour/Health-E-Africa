import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Syringe } from "lucide-react";
import { db } from "@/db/db";
import type { Immunisation } from "@/db/types";
import { Badge, Button, Card, Chips, ConfirmDialog, EmptyState, Field, Input, Sheet, Tabs, Textarea } from "@/components/ui";
import { Page, PageHeader } from "@/components/layout";
import { COMMON_VACCINES } from "@/data/kenya";
import { immunisationState, type ImmunisationState } from "@/domain/reminders";
import { syncReminders } from "@/db/actions";
import { active, useFormat } from "@/lib/hooks";
import { nowIso, today, uid } from "@/lib/utils";

const STATE_TONE: Record<ImmunisationState, "green" | "red" | "amber" | "blue" | "slate"> = {
  given: "green",
  overdue: "red",
  due: "amber",
  scheduled: "blue",
  unknown: "slate",
};
const STATE_LABEL: Record<ImmunisationState, string> = { given: "Given", overdue: "Overdue", due: "Due", scheduled: "Scheduled", unknown: "No date" };

export function ImmunisationsPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const all = active(useLiveQuery(() => db.immunisations.toArray(), []));
  const [filter, setFilter] = useState<"all" | "todo" | "given">("all");
  const [edit, setEdit] = useState<Immunisation | null | undefined>(undefined);
  const tk = today();

  const groups = useMemo(() => {
    const withState = all.map((i) => ({ ...i, state: immunisationState(i, tk) }));
    const filtered = withState.filter((i) => (filter === "all" ? true : filter === "given" ? i.state === "given" : i.state !== "given"));
    const map = new Map<string, typeof filtered>();
    for (const i of filtered.sort((a, b) => a.doseNumber - b.doseNumber)) map.set(i.vaccine, [...(map.get(i.vaccine) ?? []), i]);
    return [...map.entries()];
  }, [all, filter, tk]);

  const counts = {
    overdue: all.filter((i) => immunisationState(i, tk) === "overdue").length,
    due: all.filter((i) => ["due", "scheduled"].includes(immunisationState(i, tk))).length,
    given: all.filter((i) => i.dateGiven).length,
  };

  return (
    <>
      <PageHeader
        title={t("Immunisations")}
        back
        action={
          <Button size="sm" onClick={() => setEdit(null)}>
            <Plus className="h-4 w-4" />
            {t("Add")}
          </Button>
        }
      />
      <Page>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-3">
            <p className="text-2xl font-bold text-red-600">{counts.overdue}</p>
            <p className="text-xs text-slate-500">{t("Overdue")}</p>
          </Card>
          <Card className="p-3">
            <p className="text-2xl font-bold text-amber-600">{counts.due}</p>
            <p className="text-xs text-slate-500">{t("Coming up")}</p>
          </Card>
          <Card className="p-3">
            <p className="text-2xl font-bold text-emerald-600">{counts.given}</p>
            <p className="text-xs text-slate-500">{t("Given")}</p>
          </Card>
        </div>
        <Chips
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("All") },
            { value: "todo", label: t("Due & overdue") },
            { value: "given", label: t("Given") },
          ]}
        />
        {all.length === 0 ? (
          <EmptyState icon={<Syringe className="h-6 w-6" />} title={t("No vaccines recorded")} body={t("Add vaccines from your vaccination card so you know when the next dose is due.")} action={<Button onClick={() => setEdit(null)}>{t("Add vaccine")}</Button>} />
        ) : groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{t("Nothing here.")}</p>
        ) : (
          groups.map(([vaccine, doses]) => (
            <Card key={vaccine} className="p-0">
              <div className="flex items-center justify-between px-4 pt-3">
                <p className="font-semibold">{vaccine}</p>
                <span className="text-xs text-slate-500">{t("{{n}} of {{total}} doses", { n: doses.filter((d) => d.dateGiven).length, total: doses[0]!.seriesTotal })}</span>
              </div>
              <ul className="mt-2">
                {doses.map((d) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => setEdit(d)} className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-left">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">{d.doseNumber}</span>
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block">{d.dateGiven ? fmt.date(d.dateGiven) : d.dueDate ? t("Due {{date}}", { date: fmt.date(d.dueDate) }) : t("No date")}</span>
                        {(d.batchNumber || d.administeredBy) && (
                          <span className="block truncate text-xs text-slate-500">
                            {[d.administeredBy, d.batchNumber && `${t("Batch")} ${d.batchNumber}`].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                      <Badge tone={STATE_TONE[d.state]}>{t(STATE_LABEL[d.state])}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </Page>
      <ImmunisationSheet open={edit !== undefined} item={edit ?? undefined} onClose={() => setEdit(undefined)} />
    </>
  );
}

function ImmunisationSheet({ open, onClose, item }: { open: boolean; onClose: () => void; item?: Immunisation }) {
  const { t } = useTranslation();
  const [given, setGiven] = useState<"given" | "due">("given");
  const [f, setF] = useState({ vaccine: "", doseNumber: "1", seriesTotal: "1", dateGiven: today(), dueDate: "", batchNumber: "", administeredBy: "", site: "", notes: "" });
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGiven(item && !item.dateGiven ? "due" : "given");
    setF({
      vaccine: item?.vaccine ?? "",
      doseNumber: String(item?.doseNumber ?? 1),
      seriesTotal: String(item?.seriesTotal ?? 1),
      dateGiven: item?.dateGiven ?? today(),
      dueDate: item?.dueDate ?? "",
      batchNumber: item?.batchNumber ?? "",
      administeredBy: item?.administeredBy ?? "",
      site: item?.site ?? "",
      notes: item?.notes ?? "",
    });
  }, [open, item]);

  const valid = f.vaccine.trim() && Number(f.doseNumber) >= 1 && Number(f.seriesTotal) >= Number(f.doseNumber) && (given === "given" ? !!f.dateGiven : !!f.dueDate);

  const save = async () => {
    const data = {
      vaccine: f.vaccine.trim(),
      doseNumber: Number(f.doseNumber),
      seriesTotal: Number(f.seriesTotal),
      dateGiven: given === "given" ? f.dateGiven : undefined,
      dueDate: f.dueDate || undefined,
      batchNumber: given === "given" ? f.batchNumber || undefined : undefined,
      administeredBy: given === "given" ? f.administeredBy || undefined : undefined,
      site: given === "given" ? f.site || undefined : undefined,
      notes: f.notes || undefined,
    };
    if (item) await db.immunisations.update(item.id, data);
    else await db.immunisations.add({ ...data, id: uid(), createdAt: nowIso() });
    void syncReminders();
    toast.success(t("Saved"));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? t("Edit vaccine") : t("Add vaccine")}
      footer={
        <div className="flex gap-2">
          {item && (
            <Button variant="ghost" className="text-red-600" onClick={() => setConfirm(true)}>
              {t("Remove")}
            </Button>
          )}
          <Button className="flex-1" disabled={!valid} onClick={() => void save()}>
            {t("Save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t("Vaccine")} required>
          {(id) => <Input id={id} value={f.vaccine} onChange={(e) => setF({ ...f, vaccine: e.target.value })} list="vaccine-list" />}
        </Field>
        <datalist id="vaccine-list">
          {COMMON_VACCINES.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Dose number")}>{(id) => <Input id={id} type="number" min={1} value={f.doseNumber} onChange={(e) => setF({ ...f, doseNumber: e.target.value })} />}</Field>
          <Field label={t("Doses in series")}>{(id) => <Input id={id} type="number" min={1} value={f.seriesTotal} onChange={(e) => setF({ ...f, seriesTotal: e.target.value })} />}</Field>
        </div>
        <Tabs
          value={given}
          onChange={setGiven}
          options={[
            { value: "given", label: t("Already given") },
            { value: "due", label: t("Due / scheduled") },
          ]}
        />
        {given === "given" ? (
          <>
            <Field label={t("Date given")} required>
              {(id) => <Input id={id} type="date" max={today()} value={f.dateGiven} onChange={(e) => setF({ ...f, dateGiven: e.target.value })} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Batch number")}>{(id) => <Input id={id} value={f.batchNumber} onChange={(e) => setF({ ...f, batchNumber: e.target.value })} />}</Field>
              <Field label={t("Site")}>{(id) => <Input id={id} value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })} placeholder={t("e.g. Left arm")} />}</Field>
            </div>
            <Field label={t("Given at / by")}>{(id) => <Input id={id} value={f.administeredBy} onChange={(e) => setF({ ...f, administeredBy: e.target.value })} />}</Field>
          </>
        ) : (
          <Field label={t("Due date")} required>
            {(id) => <Input id={id} type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />}
          </Field>
        )}
        <Field label={t("Notes")}>{(id) => <Textarea id={id} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />}</Field>
      </div>
      <ConfirmDialog
        open={confirm}
        title={t("Remove this vaccine record?")}
        message={t("It will be hidden from your list. A secure copy is kept, as health records must be kept by law.")}
        confirmLabel={t("Remove")}
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          await db.immunisations.update(item!.id, { archivedAt: nowIso() });
          setConfirm(false);
          void syncReminders();
          onClose();
        }}
      />
    </Sheet>
  );
}
