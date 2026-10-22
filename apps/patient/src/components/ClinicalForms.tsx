import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { db } from "@/db/db";
import { markEdited } from "@/domain/provenance";
import type { Allergy, Condition, Medication, Severity } from "@/db/types";
import { Button, Checkbox, ConfirmDialog, Field, Input, Notice, Select, Sheet, Textarea } from "./ui";
import { findAllergyConflicts } from "@/domain/allergy";
import { interactionsWith } from "@/domain/interactions";
import { interactionIssue, SafetyList } from "./MedicineSafety";
import { nowIso, uid } from "@/lib/utils";
import { syncReminders } from "@/db/actions";

// ---------- Condition ----------

export function ConditionSheet({ open, onClose, item }: { open: boolean; onClose: () => void; item?: Condition }) {
  const { t } = useTranslation();
  const [f, setF] = useState({ name: "", status: "active" as Condition["status"], chronic: true, onsetDate: "", notes: "" });
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (open) setF({ name: item?.name ?? "", status: item?.status ?? "active", chronic: item?.chronic ?? true, onsetDate: item?.onsetDate ?? "", notes: item?.notes ?? "" });
  }, [open, item]);

  const save = async () => {
    const data = { ...f, name: f.name.trim(), onsetDate: f.onsetDate || undefined, notes: f.notes || undefined };
    if (item) await db.conditions.update(item.id, { ...data, ...markEdited(item, data) });
    else await db.conditions.add({ ...data, id: uid(), createdAt: nowIso() });
    void syncReminders();
    toast.success(t("Saved"));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? t("Edit condition") : t("Add condition")}
      footer={
        <div className="flex gap-2">
          {item && (
            <Button variant="ghost" className="text-red-600" onClick={() => setConfirm(true)}>
              {t("Remove")}
            </Button>
          )}
          <Button className="flex-1" disabled={!f.name.trim()} onClick={() => void save()}>
            {t("Save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t("Condition or diagnosis")} required>
          {(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t("e.g. Type 2 diabetes")} list="condition-suggestions" />}
        </Field>
        <datalist id="condition-suggestions">
          {["Type 2 diabetes", "Type 1 diabetes", "Hypertension", "Asthma", "COPD", "HIV", "Chronic kidney disease", "Heart failure", "Epilepsy", "Sickle cell disease", "Depression", "Arthritis", "Tuberculosis"].map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Status")}>
            {(id) => (
              <Select id={id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Condition["status"] })}>
                <option value="active">{t("Active")}</option>
                <option value="resolved">{t("Resolved")}</option>
              </Select>
            )}
          </Field>
          <Field label={t("Since")}>{(id) => <Input id={id} type="date" value={f.onsetDate} onChange={(e) => setF({ ...f, onsetDate: e.target.value })} />}</Field>
        </div>
        <Checkbox checked={f.chronic} onChange={(v) => setF({ ...f, chronic: v })}>
          {t("Long-term (chronic) condition")}
        </Checkbox>
        <Field label={t("Notes")}>{(id) => <Textarea id={id} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />}</Field>
      </div>
      <ConfirmDialog
        open={confirm}
        title={t("Remove this condition?")}
        message={t("It will be hidden from your summary. A copy is kept in your history, as health records must be kept by law.")}
        confirmLabel={t("Remove")}
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          await db.conditions.update(item!.id, { archivedAt: nowIso() });
          setConfirm(false);
          void syncReminders();
          onClose();
        }}
      />
    </Sheet>
  );
}

// ---------- Allergy ----------

export function AllergySheet({ open, onClose, item }: { open: boolean; onClose: () => void; item?: Allergy }) {
  const { t } = useTranslation();
  const [f, setF] = useState({ substance: "", reaction: "", severity: "moderate" as Severity, status: "active" as Allergy["status"] });
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (open) setF({ substance: item?.substance ?? "", reaction: item?.reaction ?? "", severity: item?.severity ?? "moderate", status: item?.status ?? "active" });
  }, [open, item]);

  const save = async () => {
    const data = { ...f, substance: f.substance.trim(), reaction: f.reaction || undefined };
    if (item) await db.allergies.update(item.id, { ...data, ...markEdited(item, data) });
    else await db.allergies.add({ ...data, id: uid(), createdAt: nowIso() });
    toast.success(t("Saved"));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? t("Edit allergy") : t("Add allergy")}
      footer={
        <div className="flex gap-2">
          {item && (
            <Button variant="ghost" className="text-red-600" onClick={() => setConfirm(true)}>
              {t("Remove")}
            </Button>
          )}
          <Button className="flex-1" disabled={!f.substance.trim()} onClick={() => void save()}>
            {t("Save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t("Allergic to")} required>
          {(id) => <Input id={id} value={f.substance} onChange={(e) => setF({ ...f, substance: e.target.value })} placeholder={t("e.g. Penicillin, peanuts")} list="allergy-suggestions" />}
        </Field>
        <datalist id="allergy-suggestions">
          {["Penicillin", "Sulfa drugs", "Aspirin", "Ibuprofen (NSAIDs)", "Codeine", "Latex", "Peanuts", "Shellfish", "Eggs", "Bee stings"].map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <Field label={t("Reaction")}>{(id) => <Input id={id} value={f.reaction} onChange={(e) => setF({ ...f, reaction: e.target.value })} placeholder={t("e.g. Rash, swelling")} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Severity")}>
            {(id) => (
              <Select id={id} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value as Severity })}>
                <option value="mild">{t("Mild")}</option>
                <option value="moderate">{t("Moderate")}</option>
                <option value="severe">{t("Severe")}</option>
              </Select>
            )}
          </Field>
          <Field label={t("Status")}>
            {(id) => (
              <Select id={id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Allergy["status"] })}>
                <option value="active">{t("Active")}</option>
                <option value="inactive">{t("No longer allergic")}</option>
              </Select>
            )}
          </Field>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        title={t("Remove this allergy?")}
        message={t("Only remove it if it was added by mistake. If you're no longer allergic, change the status instead.")}
        confirmLabel={t("Remove")}
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          await db.allergies.update(item!.id, { archivedAt: nowIso() });
          setConfirm(false);
          onClose();
        }}
      />
    </Sheet>
  );
}

// ---------- Medication ----------

export function MedicationSheet({ open, onClose, item }: { open: boolean; onClose: () => void; item?: Medication }) {
  const { t } = useTranslation();
  const allergies = useLiveQuery(() => db.allergies.toArray(), []) ?? [];
  const blank = { name: "", dose: "", frequency: "", type: "repeat" as Medication["type"], status: "active" as Medication["status"], prescriptionOnly: true, startDate: "", reviewDate: "", prescriber: "", instructions: "" };
  const [f, setF] = useState(blank);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (open)
      setF(
        item
          ? { name: item.name, dose: item.dose, frequency: item.frequency, type: item.type, status: item.status, prescriptionOnly: item.prescriptionOnly, startDate: item.startDate ?? "", reviewDate: item.reviewDate ?? "", prescriber: item.prescriber ?? "", instructions: item.instructions ?? "" }
          : blank,
      );
  }, [open, item]);

  const conflicts = findAllergyConflicts(f.name, allergies);
  // Interactions with the patient's other current medicines.
  const others = useLiveQuery(() => db.medications.filter((m) => !m.archivedAt && m.status === "active").toArray(), []) ?? [];
  const interactions = f.name.trim().length >= 3 && f.status === "active" ? interactionsWith(f.name.trim(), others.filter((m) => m.id !== item?.id).map((m) => m.name)).map(interactionIssue) : [];

  const save = async () => {
    const data = {
      ...f,
      name: f.name.trim(),
      startDate: f.startDate || undefined,
      reviewDate: f.reviewDate || undefined,
      prescriber: f.prescriber || undefined,
      instructions: f.instructions || undefined,
    };
    if (item) await db.medications.update(item.id, { ...data, ...markEdited(item, data) });
    else await db.medications.add({ ...data, id: uid(), createdAt: nowIso() });
    void syncReminders();
    toast.success(t("Saved"));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? t("Edit medicine") : t("Add medicine")}
      footer={
        <div className="flex gap-2">
          {item && (
            <Button variant="ghost" className="text-red-600" onClick={() => setConfirm(true)}>
              {t("Remove")}
            </Button>
          )}
          <Button className="flex-1" disabled={!f.name.trim() || !f.dose.trim()} onClick={() => void save()}>
            {t("Save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t("Medicine name")} required>
          {(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t("e.g. Metformin")} />}
        </Field>
        {conflicts.length > 0 && (
          <Notice tone="red" icon={<AlertTriangle className="h-4 w-4" />}>
            <p className="font-semibold">{t("Allergy warning")}</p>
            {conflicts.map((c) => (
              <p key={c.allergy.id}>
                {c.level === "direct" ? t("You are allergic to {{substance}}.", { substance: c.allergy.substance }) : t("Possible cross-reaction with your {{substance}} allergy.", { substance: c.allergy.substance })}
              </p>
            ))}
            <p className="mt-1 text-xs">{t("Check with your doctor or pharmacist before taking this.")}</p>
          </Notice>
        )}
        {interactions.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-extrabold">
              <AlertTriangle className="h-4 w-4 text-red-700" />
              {t("Interacts with your other medicines")}
            </p>
            <SafetyList issues={interactions} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Dose")} required>
            {(id) => <Input id={id} value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} placeholder="500 mg" />}
          </Field>
          <Field label={t("Type")}>
            {(id) => (
              <Select id={id} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Medication["type"] })}>
                <option value="repeat">{t("Repeat (regular)")}</option>
                <option value="acute">{t("Acute (short course)")}</option>
              </Select>
            )}
          </Field>
        </div>
        <Field label={t("How often")}>{(id) => <Input id={id} value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })} placeholder={t("e.g. Twice daily with meals")} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Started")}>{(id) => <Input id={id} type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />}</Field>
          <Field label={t("Review date")}>{(id) => <Input id={id} type="date" value={f.reviewDate} onChange={(e) => setF({ ...f, reviewDate: e.target.value })} />}</Field>
        </div>
        <Field label={t("Prescribed by")}>{(id) => <Input id={id} value={f.prescriber} onChange={(e) => setF({ ...f, prescriber: e.target.value })} />}</Field>
        <Field label={t("Status")}>
          {(id) => (
            <Select id={id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Medication["status"] })}>
              <option value="active">{t("Taking now")}</option>
              <option value="stopped">{t("Stopped")}</option>
            </Select>
          )}
        </Field>
        <Checkbox checked={f.prescriptionOnly} onChange={(v) => setF({ ...f, prescriptionOnly: v })}>
          {t("Prescription-only medicine")}
        </Checkbox>
      </div>
      <ConfirmDialog
        open={confirm}
        title={t("Remove this medicine?")}
        message={t("If you stopped taking it, change the status to Stopped instead so your history stays complete.")}
        confirmLabel={t("Remove")}
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          await db.medications.update(item!.id, { archivedAt: nowIso() });
          setConfirm(false);
          void syncReminders();
          onClose();
        }}
      />
    </Sheet>
  );
}
