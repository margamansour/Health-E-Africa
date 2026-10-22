import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Check, Info, Pill, Plus, Truck, Wand2, Store } from "lucide-react";
import { db } from "@/db/db";
import type { Medication, MedRequest, MedRequestStatus } from "@/db/types";
import { Badge, Button, Card, Checkbox, EmptyState, Field, Input, Notice, Select, Sheet, Tabs, Textarea } from "@/components/ui";
import { Page, PageHeader } from "@/components/layout";
import { MedicationSheet } from "@/components/ClinicalForms";
import { checkMedicines, MedicineSafetyCard, SafetyList, useMedicineSafety } from "@/components/MedicineSafety";
import { cancelMedRequest, simulatePharmacyReject, simulatePharmacyStep, submitMedRequest } from "@/db/actions";
import { active, useFormat, useProfile, useProvenance } from "@/lib/hooks";
import { SourceLabel } from "@/components/SourceDocumentSheet";
import { today } from "@/lib/utils";

export const MED_STATUS: Record<MedRequestStatus, { label: string; tone: "amber" | "green" | "red" | "slate" | "blue" | "purple" }> = {
  submitted: { label: "Sent to pharmacy", tone: "amber" },
  awaiting_prescriber: { label: "Waiting for prescriber", tone: "purple" },
  approved: { label: "Approved", tone: "blue" },
  dispensed: { label: "Ready", tone: "blue" },
  out_for_delivery: { label: "Out for delivery", tone: "blue" },
  delivered: { label: "Delivered", tone: "green" },
  rejected: { label: "Not approved", tone: "red" },
  cancelled: { label: "Cancelled", tone: "slate" },
};

const OPEN_STATES: MedRequestStatus[] = ["submitted", "awaiting_prescriber", "approved", "dispensed", "out_for_delivery"];

export function PrescriptionsPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "requests" ? "requests" : "medicines";
  const profile = useProfile();
  const meds = active(useLiveQuery(() => db.medications.toArray(), []));
  const safety = useMedicineSafety();
  const provenance = useProvenance();
  const requests = useLiveQuery(() => db.medRequests.orderBy("createdAt").reverse().toArray(), []) ?? [];
  const facilities = useLiveQuery(() => db.facilities.where("id").startsWith("fac-").toArray(), []) ?? [];
  const [selected, setSelected] = useState<string[]>([]);
  const [requestType, setRequestType] = useState<"repeat" | "acute" | null>(null);
  const [editMed, setEditMed] = useState<Medication | null | undefined>(undefined);

  const repeats = meds.filter((m) => m.status === "active" && m.type === "repeat");
  const pharmacy = facilities.find((f) => f.id === profile?.nominatedPharmacyId);
  const tk = today();
  const openRequestFor = (medId: string) => requests.some((r) => OPEN_STATES.includes(r.status) && r.items.some((i) => i.medicationId === medId));

  return (
    <>
      <PageHeader title={t("Prescriptions")} back />
      <Page>
        <Tabs
          value={tab}
          onChange={(v) => setParams(v === "requests" ? { tab: "requests" } : {}, { replace: true })}
          options={[
            { value: "medicines", label: t("My medicines") },
            { value: "requests", label: t("Requests") },
          ]}
        />

        <Card className="flex items-center gap-3">
          <Store className="h-5 w-5 text-brand-700" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink/55">{t("My pharmacy")}</p>
            <p className="truncate text-sm font-medium">{pharmacy ? `${pharmacy.name}, ${pharmacy.town}` : t("Not chosen yet")}</p>
          </div>
          <Link to="/find-care" className="text-sm font-medium text-brand-700">
            {pharmacy ? t("Change") : t("Choose")}
          </Link>
        </Card>

        {tab === "medicines" && (
          <>
            <MedicineSafetyCard />
            {repeats.length === 0 ? (
              <EmptyState
                icon={<Pill className="h-6 w-6" />}
                title={t("No repeat medicines")}
                body={t("Add the medicines you take regularly to order them quickly.")}
                action={<Button onClick={() => setEditMed(null)}>{t("Add medicine")}</Button>}
              />
            ) : (
              <>
                <p className="px-1 text-sm text-ink/65">{t("Select the medicines you need, then request them.")}</p>
                <Card className="divide-y divide-ink/5 p-0">
                  {repeats.map((m) => {
                    const alerts = safety.issuesFor(m.name);
                    const overdue = m.reviewDate && m.reviewDate < tk;
                    const pending = openRequestFor(m.id);
                    return (
                      <div key={m.id} className="space-y-1.5 px-4 py-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            aria-label={t("Select {{name}}", { name: m.name })}
                            className="mt-1 h-5 w-5 accent-brand-700"
                            checked={selected.includes(m.id)}
                            disabled={pending}
                            onChange={(e) => setSelected((cur) => (e.target.checked ? [...cur, m.id] : cur.filter((x) => x !== m.id)))}
                          />
                          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditMed(m)}>
                            <p className="font-medium">
                              {m.name} {m.dose}
                            </p>
                            <p className="text-xs text-ink/55">{m.frequency}</p>
                            <SourceLabel p={provenance(m)} className="mt-0.5 max-w-full" />
                            {m.reportedChange && <p className="text-[11px] font-semibold text-amber-800">{t("Change reported: waiting for your prescriber")}</p>}
                          </button>
                          {pending && <Badge tone="amber">{t("Requested")}</Badge>}
                        </div>
                        {m.reviewDate && (
                          <p className={`flex items-center gap-1 pl-8 text-xs ${overdue ? "font-medium text-red-600" : "text-ink/55"}`}>
                            <CalendarClock className="h-3.5 w-3.5" />
                            {overdue ? t("Medication review overdue since {{date}}", { date: fmt.date(m.reviewDate) }) : t("Medication review due {{date}}", { date: fmt.date(m.reviewDate) })}
                          </p>
                        )}
                        {alerts.map((a, n) => (
                          <p key={n} className={`flex items-start gap-1 pl-8 text-xs font-medium ${a.severity === "major" ? "text-red-600" : "text-amber-700"}`}>
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {a.kind === "allergy"
                              ? t("Allergy warning: {{title}}", { title: a.title })
                              : t("{{kind}}: {{title}}", { kind: a.kind === "duplicate" ? t("Same type") : a.kind === "condition" ? t("Condition") : t("Interaction"), title: a.title })}
                          </p>
                        ))}
                      </div>
                    );
                  })}
                </Card>
                <Button className="w-full" disabled={selected.length === 0} onClick={() => setRequestType("repeat")}>
                  {t("Request {{count}} medicine(s)", { count: selected.length })}
                </Button>
              </>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setRequestType("acute")}>
                {t("Request something new")}
              </Button>
              <Button variant="outline" onClick={() => setEditMed(null)}>
                <Plus className="h-4 w-4" />
                {t("Add medicine")}
              </Button>
            </div>
          </>
        )}

        {tab === "requests" && (
          <>
            {requests.length === 0 && <EmptyState icon={<Truck className="h-6 w-6" />} title={t("No requests yet")} body={t("Your prescription requests and delivery updates will show here.")} />}
            {requests.map((r) => (
              <RequestCard key={r.id} req={r} pharmacyName={facilities.find((f) => f.id === r.pharmacyId)?.name ?? ""} />
            ))}
          </>
        )}
      </Page>

      <RequestSheet
        type={requestType}
        meds={repeats.filter((m) => selected.includes(m.id))}
        onClose={() => setRequestType(null)}
        onDone={() => {
          setSelected([]);
          setRequestType(null);
          setParams({ tab: "requests" }, { replace: true });
        }}
      />
      <MedicationSheet open={editMed !== undefined} item={editMed ?? undefined} onClose={() => setEditMed(undefined)} />
    </>
  );
}

function RequestCard({ req, pharmacyName }: { req: MedRequest; pharmacyName: string }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const st = MED_STATUS[req.status];
  const steps: MedRequestStatus[] = req.delivery === "delivery" ? ["submitted", "approved", "dispensed", "out_for_delivery", "delivered"] : ["submitted", "approved", "dispensed", "delivered"];
  const reached = new Set<MedRequestStatus>(req.history.map((h) => (h.status === "awaiting_prescriber" ? "submitted" : h.status)));
  const isOpen = OPEN_STATES.includes(req.status);
  const lastNote = [...req.history].reverse().find((h) => h.note)?.note;

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{req.type === "repeat" ? t("Repeat medicines") : t("New medicine request")}</p>
          <p className="text-xs text-ink/55">
            {pharmacyName} · {fmt.dateTime(req.createdAt)}
          </p>
        </div>
        <Badge tone={st.tone}>{t(st.label)}</Badge>
      </div>
      <ul className="text-sm text-ink/80">
        {req.items.map((i, n) => (
          <li key={n}>
            • {i.name} {i.dose}
          </li>
        ))}
        {req.acuteDetails && <li className="text-ink/65">“{req.acuteDetails}”</li>}
      </ul>
      {req.safetyNotes?.length ? (
        <p className="flex items-start gap-1 text-xs font-medium text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("{{count}} safety alert(s) sent to the pharmacist to check", { count: req.safetyNotes.length })}
        </p>
      ) : null}
      {!["rejected", "cancelled"].includes(req.status) && (
        <ol className="flex items-center gap-1">
          {steps.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-1">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${reached.has(s) ? "bg-brand-600 text-white" : "bg-ink/10 text-ink/55"}`}>
                {reached.has(s) ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {i < steps.length - 1 && <span className={`h-0.5 flex-1 ${reached.has(steps[i + 1]!) ? "bg-brand-600" : "bg-ink/10"}`} />}
            </li>
          ))}
        </ol>
      )}
      {lastNote && <Notice tone={req.status === "rejected" ? "red" : "blue"}>{lastNote}</Notice>}
      <p className="text-xs text-ink/55">{req.delivery === "delivery" ? `${t("Deliver to")}: ${req.deliveryAddress}` : t("Collect from pharmacy")}</p>
      {req.status === "submitted" && (
        <Button size="sm" variant="outline" className="text-red-600" onClick={() => void cancelMedRequest(req.id)}>
          {t("Cancel request")}
        </Button>
      )}
      {isOpen && (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-2.5">
          <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            <Wand2 className="h-3.5 w-3.5" />
            {t("Demo: act as the pharmacy")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => void simulatePharmacyStep(req.id)}>
              {t("Next step")}
            </Button>
            {["submitted", "awaiting_prescriber"].includes(req.status) && (
              <Button size="sm" variant="outline" onClick={() => void simulatePharmacyReject(req.id)}>
                {t("Reject")}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function RequestSheet({ type, meds, onClose, onDone }: { type: "repeat" | "acute" | null; meds: Medication[]; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const profile = useProfile();
  // Requests can only be sent to partner pharmacies through the app.
  const pharmacies = useLiveQuery(() => db.facilities.where("id").startsWith("fac-").filter((f) => f.type === "pharmacy").toArray(), []) ?? [];
  const prescriptions = active(useLiveQuery(() => db.records.where("category").equals("prescription").reverse().sortBy("date"), []));
  const safety = useMedicineSafety();
  const [pharmacyId, setPharmacyId] = useState("");
  const [delivery, setDelivery] = useState<"delivery" | "collect">("delivery");
  const [address, setAddress] = useState("");
  const [rxId, setRxId] = useState("");
  const [acute, setAcute] = useState({ medicine: "", details: "" });
  const [ackAllergy, setAckAllergy] = useState(false);

  useEffect(() => {
    if (!type) return;
    setPharmacyId(profile?.nominatedPharmacyId ?? pharmacies[0]?.id ?? "");
    setAddress(profile?.deliveryAddress ?? "");
    setRxId(prescriptions[0]?.id ?? "");
    setAcute({ medicine: "", details: "" });
    setAckAllergy(false);
    setDelivery("delivery");
    // Only reset when the sheet opens.
  }, [type]);

  const pharmacy = pharmacies.find((p) => p.id === pharmacyId);

  // Pharmacies load asynchronously; pick a default once they arrive.
  useEffect(() => {
    if (type && !pharmacyId && pharmacies.length) setPharmacyId(profile?.nominatedPharmacyId ?? pharmacies[0]!.id);
  }, [type, pharmacyId, pharmacies, profile]);

  // Not every pharmacy delivers.
  useEffect(() => {
    if (pharmacy && !pharmacy.delivers) setDelivery("collect");
  }, [pharmacy]);

  // What's being asked for, checked against allergies and every other current medicine.
  const conflicts = useMemo(() => {
    const asked = type === "repeat" ? meds.map((m) => m.name) : acute.medicine.trim() ? [acute.medicine.trim()] : [];
    if (!asked.length) return [];
    const current = safety.meds.map((m) => m.name);
    return checkMedicines([...new Set([...asked, ...current])], safety.allergies, { onlyInvolving: asked, conditions: safety.conditions, age: safety.age });
  }, [type, meds, acute.medicine, safety.meds, safety.allergies, safety.conditions, safety.age]);
  const needsRx = type === "repeat" && meds.some((m) => m.prescriptionOnly) && !rxId;

  if (!type) return null;
  const valid = pharmacyId && (delivery === "collect" || address.trim()) && (type === "repeat" ? meds.length > 0 : acute.details.trim()) && (conflicts.length === 0 || ackAllergy);

  const submit = async () => {
    const notes = [
      ...conflicts.map((c) => `${c.title}: ${c.effect}`),
      // The pharmacist dispenses against the prescription, never the dose typed into the app.
      ...(type === "repeat"
        ? meds.filter((m) => !m.sourceRecordId && !m.sourceFacility).map((m) => `${m.name} ${m.dose}: typed in by the patient, not from a verified prescription`)
        : []),
    ];
    await submitMedRequest({
      pharmacyId,
      type,
      items:
        type === "repeat"
          ? meds.map((m) => ({ medicationId: m.id, name: m.name, dose: m.dose, patientEntered: !m.sourceRecordId && !m.sourceFacility }))
          : acute.medicine
            ? [{ name: acute.medicine, patientEntered: true }]
            : [],
      acuteDetails: type === "acute" ? acute.details.trim() : undefined,
      safetyNotes: notes.length ? notes : undefined,
      prescriptionRecordId: type === "repeat" ? rxId || undefined : undefined,
      deliveryAddress: delivery === "delivery" ? address.trim() : "",
      delivery,
    });
    if (delivery === "delivery" && address.trim() !== profile?.deliveryAddress) await db.profile.update("me", { deliveryAddress: address.trim() });
    toast.success(t("Request sent to {{name}}", { name: pharmacy?.name ?? "" }));
    onDone();
  };

  return (
    <Sheet
      open={!!type}
      onClose={onClose}
      title={type === "repeat" ? t("Request repeat medicines") : t("Request a new medicine")}
      footer={
        <Button className="w-full" disabled={!valid} onClick={() => void submit()}>
          {t("Send to pharmacy")}
        </Button>
      }
    >
      <div className="space-y-4">
        {type === "repeat" ? (
          <ul className="space-y-1 rounded-2xl bg-cream p-3 text-sm">
            {meds.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  {m.name} {m.dose}
                  {!m.sourceRecordId && !m.sourceFacility && <span className="block text-[11px] font-semibold text-amber-800">{t("Typed in by you: the pharmacist will check it against your prescription")}</span>}
                </span>
                {m.prescriptionOnly && <Badge>{t("Prescription only")}</Badge>}
              </li>
            ))}
          </ul>
        ) : (
          <>
            <Field label={t("Medicine (if you know it)")}>{(id) => <Input id={id} value={acute.medicine} onChange={(e) => setAcute({ ...acute, medicine: e.target.value })} />}</Field>
            <Field label={t("What do you need help with?")} required>
              {(id) => <Textarea id={id} value={acute.details} onChange={(e) => setAcute({ ...acute, details: e.target.value })} placeholder={t("e.g. Sore throat for 3 days, no fever")} />}
            </Field>
            <Notice tone="blue" icon={<Info className="h-4 w-4" />}>
              {t("The pharmacist will contact you. Over-the-counter medicines can be supplied after a consultation; prescription-only medicines need a prescription from a doctor or clinical officer.")}
            </Notice>
          </>
        )}

        {conflicts.length > 0 && (
          <div className="space-y-2 rounded-[24px] bg-white p-3 ring-2 ring-coral">
            <p className="flex items-center gap-1.5 font-extrabold">
              <AlertTriangle className="h-4 w-4 text-red-700" />
              {t("Safety check: {{count}} alert(s)", { count: conflicts.length })}
            </p>
            <SafetyList issues={conflicts} />
            <p className="text-xs text-ink/60">{t("These alerts are sent with your request so the pharmacist can check them with you.")}</p>
            <Checkbox checked={ackAllergy} onChange={setAckAllergy}>
              {t("I understand. The pharmacist will check this with me.")}
            </Checkbox>
          </div>
        )}

        <Field label={t("Pharmacy")}>
          {(id) => (
            <Select id={id} value={pharmacyId} onChange={(e) => setPharmacyId(e.target.value)}>
              {pharmacies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.town}
                  {p.id === profile?.nominatedPharmacyId ? ` (${t("my pharmacy")})` : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {type === "repeat" && (
          <Field label={t("Prescription")} hint={t("Pharmacists can only dispense prescription-only medicines against a valid prescription.")}>
            {(id) => (
              <Select id={id} value={rxId} onChange={(e) => setRxId(e.target.value)}>
                <option value="">{t("I don't have one on file")}</option>
                {prescriptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {needsRx && (
          <Notice tone="amber">
            {t("Without a prescription on file, the pharmacist will need to contact your prescriber first. This may take longer.")}{" "}
            <Link to="/records?add=1" className="font-medium underline">
              {t("Upload a prescription")}
            </Link>
          </Notice>
        )}

        <Field label={t("How do you want to get it?")}>
          {(id) => (
            <Select id={id} value={delivery} onChange={(e) => setDelivery(e.target.value as "delivery" | "collect")}>
              <option value="delivery" disabled={!pharmacy?.delivers}>
                {t("Deliver to me")}
                {!pharmacy?.delivers ? ` (${t("not available")})` : ""}
              </option>
              <option value="collect">{t("I'll collect it")}</option>
            </Select>
          )}
        </Field>
        {delivery === "delivery" && (
          <Field label={t("Delivery address")} required>
            {(id) => <Textarea id={id} value={address} onChange={(e) => setAddress(e.target.value)} className="min-h-16" />}
          </Field>
        )}
      </div>
    </Sheet>
  );
}
