import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { Facility } from "@/db/types";
import { Button, Checkbox, Field, Input, Notice, Select, Sheet, Textarea } from "./ui";
import { requestAppointment } from "@/db/actions";
import { APPOINTMENT_SHARE_CONSENT } from "@/lib/policy";
import { addDays, toDateKey } from "@/lib/utils";

const SLOTS = ["08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"];

export function BookingSheet({ facility, onClose }: { facility: Facility | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const tomorrow = toDateKey(addDays(new Date(), 1));
  const [f, setF] = useState({ service: "", date: tomorrow, time: "09:00", reason: "", share: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (facility) setF({ service: facility.services[0] ?? "", date: tomorrow, time: "09:00", reason: "", share: true });
  }, [facility, tomorrow]);

  if (!facility) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await requestAppointment({
        facilityId: facility.id,
        service: f.service || undefined,
        preferredDate: f.date,
        preferredTime: f.time,
        reason: f.reason.trim(),
        shareSummary: f.share,
        consentWording: t(APPOINTMENT_SHARE_CONSENT),
        language: i18n.language,
      });
      toast.success(t("Appointment requested"));
      onClose();
      navigate("/appointments");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={!!facility}
      onClose={onClose}
      title={t("Request appointment")}
      footer={
        <Button className="w-full" disabled={!f.reason.trim() || !f.date || busy} onClick={() => void submit()}>
          {t("Send request")}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {facility.name} · {facility.town}
        </p>
        <Field label={t("Service")}>
          {(id) => (
            <Select id={id} value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}>
              {facility.services.map((s) => (
                <option key={s} value={s}>
                  {t(s)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Preferred date")}>{(id) => <Input id={id} type="date" min={tomorrow} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</Field>
          <Field label={t("Preferred time")}>
            {(id) => (
              <Select id={id} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })}>
                {SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label={t("Reason for visit")} required>
          {(id) => <Textarea id={id} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder={t("e.g. Diabetes check-up and blood tests")} />}
        </Field>
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <Checkbox checked={f.share} onChange={(v) => setF({ ...f, share: v })}>
            <span className="font-medium">{t("Share my health summary with this facility")}</span>
          </Checkbox>
          {f.share && <p className="pl-8 text-xs text-slate-600">{t(APPOINTMENT_SHARE_CONSENT)}</p>}
        </div>
        <Notice tone="blue">{t("This is a request. The facility will confirm a time or suggest another one.")}</Notice>
      </div>
    </Sheet>
  );
}
