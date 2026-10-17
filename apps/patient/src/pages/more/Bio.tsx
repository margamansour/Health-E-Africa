import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { LocateFixed, Plus, Trash2 } from "lucide-react";
import { db } from "@/db/db";
import type { InsurancePlan, Profile, Sex } from "@/db/types";
import { Button, Card, Field, Input, SectionTitle, Select, Textarea } from "@/components/ui";
import { Page, PageHeader } from "@/components/layout";
import { BLOOD_GROUPS, COUNTIES, INSURERS } from "@/data/kenya";
import { syncReminders } from "@/db/actions";
import { useProfile } from "@/lib/hooks";

export function BioPage() {
  const { t } = useTranslation();
  const profile = useProfile();
  const [f, setF] = useState<Profile | null>(null);

  useEffect(() => {
    if (profile && !f) setF(structuredClone(profile));
  }, [profile, f]);

  if (!f) return null;
  const set = (patch: Partial<Profile>) => setF({ ...f, ...patch });
  const setIns = (i: number, patch: Partial<InsurancePlan>) => set({ insurance: f.insurance.map((x, n) => (n === i ? { ...x, ...patch } : x)) });

  const save = async () => {
    if (!f.fullName.trim() || !f.dob) return toast.error(t("Name and date of birth are required"));
    const { id: _id, ...rest } = f;
    void _id;
    await db.profile.update("me", { ...rest, insurance: f.insurance.filter((i) => i.provider) });
    void syncReminders();
    toast.success(t("Profile saved"));
  };

  const locate = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        set({ lat: p.coords.latitude, lng: p.coords.longitude });
        toast.success(t("Location saved — remember to tap Save"));
      },
      () => toast.error(t("Couldn't get your location")),
    );

  return (
    <>
      <PageHeader title={t("My bio")} back action={<Button size="sm" onClick={() => void save()}>{t("Save")}</Button>} />
      <Page>
        <SectionTitle>{t("Personal details")}</SectionTitle>
        <Card className="space-y-4">
          <Field label={t("Full name")} required>
            {(id) => <Input id={id} value={f.fullName} onChange={(e) => set({ fullName: e.target.value })} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Date of birth")} required>
              {(id) => <Input id={id} type="date" value={f.dob} onChange={(e) => set({ dob: e.target.value })} />}
            </Field>
            <Field label={t("Sex")}>
              {(id) => (
                <Select id={id} value={f.sex} onChange={(e) => set({ sex: e.target.value as Sex })}>
                  <option value="female">{t("Female")}</option>
                  <option value="male">{t("Male")}</option>
                </Select>
              )}
            </Field>
          </div>
          <Field label={t("Phone number")}>{(id) => <Input id={id} type="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} />}</Field>
          <Field label={t("Email")}>{(id) => <Input id={id} type="email" value={f.email ?? ""} onChange={(e) => set({ email: e.target.value || undefined })} />}</Field>
        </Card>

        <SectionTitle>{t("Location")}</SectionTitle>
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("County")}>
              {(id) => (
                <Select id={id} value={f.county} onChange={(e) => set({ county: e.target.value })}>
                  {COUNTIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t("Town / area")}>{(id) => <Input id={id} value={f.town ?? ""} onChange={(e) => set({ town: e.target.value || undefined })} />}</Field>
          </div>
          <Button variant="secondary" size="sm" onClick={locate}>
            <LocateFixed className="h-4 w-4" />
            {f.lat != null ? t("Update my location") : t("Use my current location")}
          </Button>
          <p className="text-xs text-ink/55">{t("Used to show care near you. Without it, we use the centre of your county.")}</p>
          <Field label={t("Delivery address")}>{(id) => <Textarea id={id} className="min-h-16" value={f.deliveryAddress ?? ""} onChange={(e) => set({ deliveryAddress: e.target.value || undefined })} />}</Field>
        </Card>

        <SectionTitle>{t("Emergency contact")}</SectionTitle>
        <Card className="space-y-4">
          <Field label={t("Name")}>{(id) => <Input id={id} value={f.emergencyName ?? ""} onChange={(e) => set({ emergencyName: e.target.value || undefined })} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Phone")}>{(id) => <Input id={id} type="tel" value={f.emergencyPhone ?? ""} onChange={(e) => set({ emergencyPhone: e.target.value || undefined })} />}</Field>
            <Field label={t("Relationship")}>
              {(id) => (
                <Select id={id} value={f.emergencyRelation ?? ""} onChange={(e) => set({ emergencyRelation: e.target.value || undefined })}>
                  <option value="">{t("Select")}</option>
                  {["Spouse", "Parent", "Child", "Sibling", "Friend", "Other"].map((r) => (
                    <option key={r} value={r}>
                      {t(r)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Card>

        <SectionTitle>{t("Health profile")}</SectionTitle>
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Blood group")}>
              {(id) => (
                <Select id={id} value={f.bloodGroup ?? ""} onChange={(e) => set({ bloodGroup: e.target.value || undefined })}>
                  <option value="">{t("Don't know")}</option>
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t("Organ donor")}>
              {(id) => (
                <Select id={id} value={f.donorStatus ?? ""} onChange={(e) => set({ donorStatus: (e.target.value || undefined) as Profile["donorStatus"] })}>
                  <option value="">{t("Not set")}</option>
                  <option value="registered">{t("Yes, registered")}</option>
                  <option value="not_registered">{t("No")}</option>
                  <option value="undecided">{t("Undecided")}</option>
                </Select>
              )}
            </Field>
          </div>
        </Card>

        <SectionTitle
          action={
            <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700" onClick={() => set({ insurance: [...f.insurance, { provider: "", plan: "", memberNumber: "" }] })}>
              <Plus className="h-4 w-4" />
              {t("Add")}
            </button>
          }
        >
          {t("Insurance")}
        </SectionTitle>
        {f.insurance.length === 0 && <Card className="text-sm text-ink/55">{t("Add your SHA or private insurance to find places that accept it.")}</Card>}
        {f.insurance.map((ins, i) => (
          <Card key={i} className="space-y-3">
            <div className="flex gap-2">
              <Select value={ins.provider} onChange={(e) => setIns(i, { provider: e.target.value })} aria-label={t("Insurer")}>
                <option value="">{t("Select insurer")}</option>
                {INSURERS.map((s) => (
                  <option key={s} value={s}>
                    {t(s)}
                  </option>
                ))}
              </Select>
              <Button variant="ghost" size="icon" onClick={() => set({ insurance: f.insurance.filter((_, n) => n !== i) })} aria-label={t("Remove")}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input value={ins.plan} onChange={(e) => setIns(i, { plan: e.target.value })} placeholder={t("Plan / cover")} aria-label={t("Plan / cover")} />
              <Input value={ins.memberNumber} onChange={(e) => setIns(i, { memberNumber: e.target.value })} placeholder={t("Member number")} aria-label={t("Member number")} />
            </div>
          </Card>
        ))}
        <Button className="mt-4 w-full" onClick={() => void save()}>
          {t("Save")}
        </Button>
      </Page>
    </>
  );
}
