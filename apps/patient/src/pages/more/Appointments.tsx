import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";
import { CalendarCheck, Clock, FlaskConical, Search, Stethoscope, Wand2 } from "lucide-react";
import { db } from "@/db/db";
import type { Appointment, AppointmentStatus } from "@/db/types";
import { Badge, Button, Card, Chips, EmptyState, Field, Select, Sheet, Textarea } from "@/components/ui";
import { Page, PageHeader } from "@/components/layout";
import { acceptProposedTime, cancelAppointment, simulateFacilityResponse } from "@/db/actions";
import { useFormat } from "@/lib/hooks";

export const APPT_STATUS: Record<AppointmentStatus, { label: string; tone: "amber" | "green" | "red" | "slate" | "blue" | "purple" }> = {
  pending: { label: "Waiting for reply", tone: "amber" },
  proposed: { label: "New time proposed", tone: "purple" },
  confirmed: { label: "Confirmed", tone: "green" },
  declined: { label: "Declined", tone: "red" },
  cancelled: { label: "Cancelled", tone: "slate" },
  completed: { label: "Completed", tone: "blue" },
};

type Filter = "all" | "upcoming" | "pending" | "past";

export function AppointmentsPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const appts = useLiveQuery(() => db.appointments.orderBy("createdAt").reverse().toArray(), []);
  const facilities = useLiveQuery(() => db.facilities.where("id").startsWith("fac-").toArray(), []) ?? [];
  const [filter, setFilter] = useState<Filter>("all");
  const [cancelling, setCancelling] = useState<Appointment | null>(null);

  const list = (appts ?? []).filter((a) =>
    filter === "all"
      ? true
      : filter === "upcoming"
        ? a.status === "confirmed"
        : filter === "pending"
          ? a.status === "pending" || a.status === "proposed"
          : ["completed", "cancelled", "declined"].includes(a.status),
  );

  return (
    <>
      <PageHeader
        title={t("My appointments")}
        back
        action={
          <Link to="/find-care">
            <Button size="sm">
              <Search className="h-4 w-4" />
              {t("Book")}
            </Button>
          </Link>
        }
      />
      <Page>
        <Chips
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("All") },
            { value: "upcoming", label: t("Confirmed") },
            { value: "pending", label: t("Waiting") },
            { value: "past", label: t("Past & cancelled") },
          ]}
        />
        {appts && appts.length === 0 && (
          <EmptyState
            icon={<Stethoscope className="h-6 w-6" />}
            title={t("No appointments yet")}
            body={t("Find a clinic, hospital or lab and request an appointment. Your summary can be shared automatically.")}
            action={
              <Link to="/find-care">
                <Button>{t("Find care")}</Button>
              </Link>
            }
          />
        )}
        {appts && appts.length > 0 && list.length === 0 && <p className="py-8 text-center text-sm text-ink/55">{t("Nothing here.")}</p>}
        {list.map((a) => {
          const f = facilities.find((x) => x.id === a.facilityId);
          const st = APPT_STATUS[a.status];
          const canCancel = ["pending", "proposed", "confirmed"].includes(a.status);
          return (
            <Card key={a.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{f?.name ?? t("Facility")}</p>
                  <p className="text-xs text-ink/55">
                    {a.service ? t(a.service) : ""} {f && `· ${f.town}`}
                  </p>
                </div>
                <Badge tone={st.tone}>{t(st.label)}</Badge>
              </div>
              <div className="space-y-1 text-sm">
                {a.status === "confirmed" || a.status === "completed" ? (
                  <p className="flex items-center gap-2 font-medium text-emerald-800">
                    <CalendarCheck className="h-4 w-4" />
                    {fmt.date(a.confirmedStart, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}, {fmt.time(a.confirmedStart)}
                  </p>
                ) : a.status === "proposed" ? (
                  <p className="flex items-center gap-2 font-medium text-violet-800">
                    <Clock className="h-4 w-4" />
                    {t("Proposed")}: {fmt.date(a.confirmedStart, { weekday: "short", day: "numeric", month: "short" })}, {fmt.time(a.confirmedStart)}
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-ink/65">
                    <Clock className="h-4 w-4" />
                    {t("Requested")}: {fmt.date(a.preferredDate, { weekday: "short", day: "numeric", month: "short" })}, {a.preferredTime}
                  </p>
                )}
                <p className="text-ink/65">{a.reason}</p>
                {a.shareId && <p className="text-xs text-brand-700">{t("Health summary shared with this facility")}</p>}
              </div>

              {(a.status === "proposed" || canCancel) && (
                <div className="flex gap-2">
                  {a.status === "proposed" && (
                    <Button size="sm" onClick={() => void acceptProposedTime(a.id).then(() => toast.success(t("Appointment confirmed")))}>
                      {t("Accept new time")}
                    </Button>
                  )}
                  {canCancel && (
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => setCancelling(a)}>
                      {t("Cancel")}
                    </Button>
                  )}
                </div>
              )}
              {a.status === "completed" && (
                <Link to="/records" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                  <FlaskConical className="h-4 w-4" />
                  {t("View results from this visit")}
                </Link>
              )}

              <details className="text-xs text-ink/55">
                <summary className="cursor-pointer">{t("History")}</summary>
                <ul className="mt-1 space-y-0.5">
                  {a.history.map((h, i) => (
                    <li key={i}>
                      {fmt.dateTime(h.at)} — {t(APPT_STATUS[h.status].label)}
                      {h.note && ` (${h.note})`}
                    </li>
                  ))}
                </ul>
              </details>

              {["pending", "confirmed"].includes(a.status) && <DemoFacilityActions appt={a} />}
            </Card>
          );
        })}
      </Page>
      <CancelSheet appt={cancelling} onClose={() => setCancelling(null)} />
    </>
  );
}

function DemoFacilityActions({ appt }: { appt: Appointment }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-2.5">
      <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
        <Wand2 className="h-3.5 w-3.5" />
        {t("Demo: act as the facility")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {appt.status === "pending" ? (
          <>
            <Button size="sm" variant="outline" onClick={() => void simulateFacilityResponse(appt.id, "confirm")}>
              {t("Confirm")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void simulateFacilityResponse(appt.id, "propose")}>
              {t("Propose new time")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void simulateFacilityResponse(appt.id, "decline")}>
              {t("Decline")}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => void simulateFacilityResponse(appt.id, "complete")}>
            {t("Visit done — send results")}
          </Button>
        )}
      </div>
    </div>
  );
}

function CancelSheet({ appt, onClose }: { appt: Appointment | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("No longer needed");
  const [note, setNote] = useState("");
  if (!appt) return null;
  return (
    <Sheet
      open={!!appt}
      onClose={onClose}
      title={t("Cancel appointment")}
      footer={
        <Button
          variant="danger"
          className="w-full"
          onClick={async () => {
            await cancelAppointment(appt.id, [t(reason), note].filter(Boolean).join(" — "));
            toast.success(t("Appointment cancelled"));
            onClose();
          }}
        >
          {t("Cancel appointment")}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label={t("Reason")}>
          {(id) => (
            <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
              {["No longer needed", "Time doesn't suit me", "Booked somewhere else", "Feeling better", "Other"].map((r) => (
                <option key={r} value={r}>
                  {t(r)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("Message to the facility (optional)")}>{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        <p className="text-xs text-ink/55">{t("Sharing of your summary with this facility will also stop.")}</p>
      </div>
    </Sheet>
  );
}
