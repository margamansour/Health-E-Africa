import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { CalendarPlus, Check, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { db } from "@/db/db";
import type { CalendarEvent, EventType } from "@/db/types";
import { Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, Field, Input, Notice, Select, Sheet, Tabs, Textarea } from "@/components/ui";
import { Page, PageHeader } from "@/components/layout";
import { planReminders, type PlannedReminder } from "@/domain/reminders";
import { dismissRule, markRuleDone } from "@/db/actions";
import { useFormat, useProfile } from "@/lib/hooks";
import { cn, toDateKey, today, uid } from "@/lib/utils";

export const EVENT_TYPES: Record<EventType, { label: string; dot: string; tone: "blue" | "purple" | "amber" | "green" | "red" | "slate" }> = {
  appointment: { label: "Appointment", dot: "bg-sky-500", tone: "blue" },
  medication: { label: "Medicine", dot: "bg-violet-500", tone: "purple" },
  screening: { label: "Screening", dot: "bg-emerald-500", tone: "green" },
  vaccine: { label: "Vaccine", dot: "bg-amber-500", tone: "amber" },
  review: { label: "Review", dot: "bg-red-500", tone: "red" },
  other: { label: "Other", dot: "bg-slate-400", tone: "slate" },
};

type Tab = "month" | "agenda" | "checks";

export function CalendarPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = (["month", "agenda", "checks"].includes(params.get("tab") ?? "") ? params.get("tab") : "month") as Tab;
  const events = useLiveQuery(() => db.events.orderBy("start").toArray(), []) ?? [];
  const [editing, setEditing] = useState<CalendarEvent | null | undefined>(undefined);
  const [newDate, setNewDate] = useState<string | undefined>();

  return (
    <>
      <PageHeader
        title={t("Calendar")}
        back
        action={
          <Button
            size="sm"
            onClick={() => {
              setNewDate(undefined);
              setEditing(null);
            }}
          >
            <CalendarPlus className="h-4 w-4" />
            {t("Add")}
          </Button>
        }
      />
      <Page>
        <Tabs
          value={tab}
          onChange={(v) => setParams(v === "month" ? {} : { tab: v }, { replace: true })}
          options={[
            { value: "month", label: t("Month") },
            { value: "agenda", label: t("Agenda") },
            { value: "checks", label: t("Health checks") },
          ]}
        />
        {tab === "month" && (
          <MonthView
            events={events}
            onOpen={setEditing}
            onAdd={(d) => {
              setNewDate(d);
              setEditing(null);
            }}
          />
        )}
        {tab === "agenda" && <AgendaView events={events} onOpen={setEditing} />}
        {tab === "checks" && <ChecksView />}
      </Page>
      <EventSheet open={editing !== undefined} event={editing ?? undefined} defaultDate={newDate} onClose={() => setEditing(undefined)} />
    </>
  );
}

function EventRow({ e, onOpen }: { e: CalendarEvent; onOpen: (e: CalendarEvent) => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const meta = EVENT_TYPES[e.type];
  return (
    <button type="button" onClick={() => onOpen(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
      <span className={cn("h-9 w-1 shrink-0 rounded-full", meta.dot)} />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-medium", e.doneAt && "text-ink/40 line-through")}>{t(e.title)}</span>
        <span className="block text-xs text-ink/55">
          {e.allDay ? t("All day") : fmt.time(e.start)} · {t(meta.label)}
          {e.source === "reminder" && ` · ${t("Auto reminder")}`}
        </span>
      </span>
      {e.doneAt && <Check className="h-4 w-4 text-emerald-600" />}
    </button>
  );
}

function MonthView({ events, onOpen, onAdd }: { events: CalendarEvent[]; onOpen: (e: CalendarEvent) => void; onAdd: (d: string) => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(today());

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const k = toDateKey(new Date(e.start));
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [events]);

  const days = useMemo(() => {
    const first = new Date(cursor);
    const offset = (first.getDay() + 6) % 7; // weeks start on Monday
    const start = new Date(first);
    start.setDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const weekdays = Array.from({ length: 7 }, (_, i) => fmt.date(new Date(2024, 0, 1 + i), { weekday: "narrow" }));
  const tk = today();
  const dayEvents = byDay.get(selected) ?? [];

  return (
    <>
      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label={t("Previous month")}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <button type="button" className="font-semibold" onClick={() => {
            const d = new Date();
            setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
            setSelected(tk);
          }}>
            {fmt.date(cursor, { month: "long", year: "numeric" })}
          </button>
          <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label={t("Next month")}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-ink/40">
          {weekdays.map((w, i) => (
            <div key={i} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((d) => {
            const k = toDateKey(d);
            const evs = byDay.get(k) ?? [];
            const inMonth = d.getMonth() === cursor.getMonth();
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelected(k)}
                className={cn(
                  "mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-2xl text-sm",
                  !inMonth && "text-ink/25",
                  k === selected ? "bg-brand-700 text-white" : k === tk ? "bg-brand-50 font-bold text-brand-800" : "hover:bg-ink/5",
                )}
              >
                {d.getDate()}
                <span className="flex h-1.5 gap-0.5">
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.id} className={cn("h-1.5 w-1.5 rounded-full", k === selected ? "bg-white" : EVENT_TYPES[e.type].dot)} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
      <div className="flex items-center justify-between px-1 pt-1">
        <p className="text-sm font-semibold">{fmt.date(selected, { weekday: "long", day: "numeric", month: "long" })}</p>
        <button type="button" className="text-sm font-medium text-brand-700" onClick={() => onAdd(selected)}>
          + {t("Add event")}
        </button>
      </div>
      {dayEvents.length === 0 ? (
        <p className="px-1 text-sm text-ink/55">{t("Nothing on this day.")}</p>
      ) : (
        <Card className="divide-y divide-ink/5 p-0">
          {dayEvents.map((e) => (
            <EventRow key={e.id} e={e} onOpen={onOpen} />
          ))}
        </Card>
      )}
    </>
  );
}

function AgendaView({ events, onOpen }: { events: CalendarEvent[]; onOpen: (e: CalendarEvent) => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const upcoming = events.filter((e) => new Date(e.start) >= start);
  const groups = new Map<string, CalendarEvent[]>();
  for (const e of upcoming) {
    const k = toDateKey(new Date(e.start));
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  if (upcoming.length === 0) return <EmptyState icon={<CalendarPlus className="h-6 w-6" />} title={t("Nothing coming up")} body={t("Appointments and health reminders will appear here.")} />;
  return (
    <>
      {[...groups.entries()].map(([day, evs]) => (
        <div key={day}>
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-ink/55">
            {day === today() ? t("Today") : fmt.date(day, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </p>
          <Card className="divide-y divide-ink/5 p-0">
            {evs.map((e) => (
              <EventRow key={e.id} e={e} onOpen={onOpen} />
            ))}
          </Card>
        </div>
      ))}
    </>
  );
}

function ChecksView() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const profile = useProfile();
  const data = useLiveQuery(async () => {
    const [conditions, medications, immunisations, ruleStatus] = await Promise.all([db.conditions.toArray(), db.medications.toArray(), db.immunisations.toArray(), db.ruleStatus.toArray()]);
    return { conditions, medications, immunisations, ruleStatus };
  }, []);
  const [marking, setMarking] = useState<PlannedReminder | null>(null);

  if (!profile || !data) return null;
  const plan = planReminders({ profile, ...data, today: new Date() });
  const due = plan.filter((p) => p.state === "due");
  const upcoming = plan.filter((p) => p.state === "upcoming");

  return (
    <>
      <Notice tone="green" icon={<ShieldCheck className="h-4 w-4" />}>
        {t("Based on your age, sex, conditions and Kenya's national guidelines. Tell us when you last had each check and we'll remind you when the next one is due.")}
      </Notice>
      <p className="px-1 pt-2 text-sm font-semibold">{t("Due now ({{count}})", { count: due.length })}</p>
      {due.length === 0 && <p className="px-1 text-sm text-ink/55">{t("You're up to date.")}</p>}
      {due.map((p) => (
        <Card key={p.key} className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{t(p.title)}</p>
            <Badge tone={EVENT_TYPES[p.type].tone}>{t(EVENT_TYPES[p.type].label)}</Badge>
          </div>
          <p className="text-sm text-ink/65">{t(p.description)}</p>
          <p className="text-xs text-ink/55">{p.dueDate ? t("Due since {{date}}", { date: fmt.date(p.dueDate) }) : t("No record of when you last had this")}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setMarking(p)}>
              <Check className="h-4 w-4" />
              {t("I've had this")}
            </Button>
            {p.ruleId && (
              <Button size="sm" variant="ghost" onClick={() => void dismissRule(p.ruleId!).then(() => toast(t("Hidden. You can turn it back on in Settings.")))}>
                {t("Not for me")}
              </Button>
            )}
          </div>
        </Card>
      ))}
      <p className="px-1 pt-4 text-sm font-semibold">{t("Coming up")}</p>
      {upcoming.length === 0 && <p className="px-1 text-sm text-ink/55">{t("Nothing scheduled yet.")}</p>}
      {upcoming.length > 0 && (
        <Card className="divide-y divide-ink/5 p-0">
          {upcoming.map((p) => (
            <div key={p.key} className="flex items-center gap-3 px-4 py-3">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", EVENT_TYPES[p.type].dot)} />
              <span className="min-w-0 flex-1 text-sm">{t(p.title)}</span>
              <span className="shrink-0 text-xs text-ink/55">{fmt.date(p.dueDate)}</span>
            </div>
          ))}
        </Card>
      )}
      <p className="px-1 pt-2 text-xs text-ink/40">{t("Reminders are general guidance and don't replace advice from your clinician.")}</p>
      <MarkDoneSheet item={marking} onClose={() => setMarking(null)} />
    </>
  );
}

function MarkDoneSheet({ item, onClose }: { item: PlannedReminder | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [date, setDate] = useState(today());
  useEffect(() => {
    if (item) setDate(today());
  }, [item]);
  if (!item) return null;
  return (
    <Sheet
      open={!!item}
      onClose={onClose}
      title={t(item.title)}
      footer={
        <Button
          className="w-full"
          disabled={!date}
          onClick={async () => {
            await markRuleDone(item.key, date);
            toast.success(t("Saved. We'll remind you next time."));
            onClose();
          }}
        >
          {t("Save")}
        </Button>
      }
    >
      <Field label={t("When did you last have it?")} hint={t("An estimate is fine.")}>
        {(id) => <Input id={id} type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />}
      </Field>
    </Sheet>
  );
}

function EventSheet({ open, event, defaultDate, onClose }: { open: boolean; event?: CalendarEvent; defaultDate?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [f, setF] = useState({ title: "", type: "other" as EventType, date: today(), time: "09:00", allDay: false, notes: "", remind: "60" });
  const [confirm, setConfirm] = useState(false);
  const readOnly = event && event.source !== "manual";

  useEffect(() => {
    if (!open) return;
    if (event) {
      const d = new Date(event.start);
      setF({
        title: event.title,
        type: event.type,
        date: toDateKey(d),
        time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
        allDay: event.allDay,
        notes: event.notes ?? "",
        remind: event.remindMinutesBefore != null ? String(event.remindMinutesBefore) : "",
      });
    } else setF({ title: "", type: "other", date: defaultDate ?? today(), time: "09:00", allDay: false, notes: "", remind: "60" });
  }, [open, event, defaultDate]);

  const save = async () => {
    const [h, m] = f.time.split(":").map(Number);
    const start = new Date(`${f.date}T00:00:00`);
    if (!f.allDay) start.setHours(h ?? 9, m ?? 0, 0, 0);
    else start.setHours(9, 0, 0, 0);
    const data = { title: f.title.trim(), type: f.type, start: start.toISOString(), allDay: f.allDay, notes: f.notes || undefined, remindMinutesBefore: f.remind ? Number(f.remind) : undefined };
    if (event) await db.events.update(event.id, data);
    else await db.events.add({ ...data, id: uid(), source: "manual" });
    toast.success(t("Saved"));
    onClose();
  };

  const title = event ? (readOnly ? t(event.title) : t("Edit event")) : t("New event");

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        readOnly ? (
          <div className="flex gap-2">
            {event!.source === "appointment" ? (
              <Button className="flex-1" onClick={() => navigate("/appointments")}>
                {t("Open appointment")}
              </Button>
            ) : (
              <Button className="flex-1" onClick={() => navigate("/calendar?tab=checks")}>
                {t("Open health checks")}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            {event && (
              <Button variant="ghost" className="text-red-600" onClick={() => setConfirm(true)}>
                {t("Delete")}
              </Button>
            )}
            <Button className="flex-1" disabled={!f.title.trim() || !f.date} onClick={() => void save()}>
              {t("Save")}
            </Button>
          </div>
        )
      }
    >
      {readOnly ? (
        <div className="space-y-2 text-sm">
          <p>{f.allDay ? `${f.date} · ${t("All day")}` : `${f.date} · ${f.time}`}</p>
          {f.notes && <p className="text-ink/65">{t(f.notes)}</p>}
          <p className="text-xs text-ink/55">{event!.source === "appointment" ? t("Added from a confirmed appointment.") : t("Created automatically from your health reminders.")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label={t("Title")} required>
            {(id) => <Input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t("e.g. Take blood pressure reading")} />}
          </Field>
          <Field label={t("Type")}>
            {(id) => (
              <Select id={id} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as EventType })}>
                {(Object.keys(EVENT_TYPES) as EventType[]).map((k) => (
                  <option key={k} value={k}>
                    {t(EVENT_TYPES[k].label)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Date")}>{(id) => <Input id={id} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</Field>
            <Field label={t("Time")}>{(id) => <Input id={id} type="time" value={f.time} disabled={f.allDay} onChange={(e) => setF({ ...f, time: e.target.value })} />}</Field>
          </div>
          <Checkbox checked={f.allDay} onChange={(v) => setF({ ...f, allDay: v })}>
            {t("All day")}
          </Checkbox>
          <Field label={t("Reminder")}>
            {(id) => (
              <Select id={id} value={f.remind} onChange={(e) => setF({ ...f, remind: e.target.value })}>
                <option value="">{t("No reminder")}</option>
                <option value="15">{t("15 minutes before")}</option>
                <option value="60">{t("1 hour before")}</option>
                <option value="1440">{t("1 day before")}</option>
              </Select>
            )}
          </Field>
          <Field label={t("Notes")}>{(id) => <Textarea id={id} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />}</Field>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        title={t("Delete this event?")}
        message={t("This can't be undone.")}
        confirmLabel={t("Delete")}
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          await db.events.delete(event!.id);
          setConfirm(false);
          onClose();
        }}
      />
    </Sheet>
  );
}
