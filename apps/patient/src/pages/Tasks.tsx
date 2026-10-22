import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { CalendarPlus, Check, FileText, FlaskConical, ListTodo, Pill, RotateCcw, Stethoscope, Leaf, Send, CalendarClock } from "lucide-react";
import { db } from "@/db/db";
import type { HealthRecord, Task } from "@/db/types";
import { Badge, Button, Card, EmptyState, Tabs } from "@/components/ui";
import { Page, PageHeader } from "@/components/layout";
import { useFormat } from "@/lib/hooks";
import { ACTION_KIND_LABEL } from "@/lib/labels";
import { cn, nowIso, parseDateKey, today, uid } from "@/lib/utils";

export const KIND_ICON: Record<Task["kind"], typeof Pill> = {
  medication: Pill,
  test: FlaskConical,
  referral: Send,
  appointment: Stethoscope,
  lifestyle: Leaf,
  other: ListTodo,
};

/** Open to-dos, soonest due first, then newest. */
export function useOpenTasks() {
  return (
    useLiveQuery(async () => {
      const all = await db.tasks.filter((x) => !x.doneAt && !x.archivedAt).toArray();
      return all.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || b.createdAt.localeCompare(a.createdAt));
    }, []) ?? []
  );
}

export async function setTaskDone(task: Task, done: boolean) {
  await db.tasks.update(task.id, { doneAt: done ? nowIso() : undefined });
}

export function TasksPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"open" | "done">("open");
  const open = useOpenTasks();
  const done = useLiveQuery(() => db.tasks.filter((x) => !!x.doneAt && !x.archivedAt).reverse().sortBy("doneAt"), []) ?? [];
  const records = useLiveQuery(async () => new Map((await db.records.toArray()).map((r) => [r.id, r])), [], new Map<string, HealthRecord>());
  const list = tab === "open" ? open : done;

  return (
    <>
      <PageHeader title={t("To do")} back />
      <Page>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "open", label: `${t("To do")}${open.length ? ` (${open.length})` : ""}` },
            { value: "done", label: t("Done") },
          ]}
        />
        {tab === "open" && open.length > 0 && (
          <p className="px-1 text-xs text-ink/55">{t("Taken from your documents: follow-ups, tests, referrals and medicine changes. Tick each one off when it's done.")}</p>
        )}
        {list.length === 0 ? (
          <EmptyState
            icon={<ListTodo className="h-6 w-6" />}
            title={tab === "open" ? t("Nothing to do right now") : t("Nothing ticked off yet")}
            body={t("When you upload a letter or discharge summary with a plan, the things to do appear here.")}
          />
        ) : (
          list.map((task) => <TaskCard key={task.id} task={task} record={task.sourceRecordId ? records.get(task.sourceRecordId) : undefined} />)
        )}
      </Page>
    </>
  );
}

export function TaskCard({ task, record, compact }: { task: Task; record?: HealthRecord; compact?: boolean }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const navigate = useNavigate();
  const Icon = KIND_ICON[task.kind];
  const overdue = !task.doneAt && task.dueDate && task.dueDate < today();
  const inCalendar = useLiveQuery(() => db.events.filter((e) => e.notes === `task:${task.id}`).count(), [task.id], 0);

  const toggle = async () => {
    await setTaskDone(task, !task.doneAt);
    toast.success(task.doneAt ? t("Moved back to your to-do list") : t("Done — nice work"));
  };
  const addToCalendar = async () => {
    const start = parseDateKey(task.dueDate!);
    start.setHours(9, 0, 0, 0);
    await db.events.add({ id: uid(), title: task.title, type: "review", start: start.toISOString(), allDay: true, notes: `task:${task.id}`, source: "manual", remindMinutesBefore: 24 * 60 });
    toast.success(t("Added to your calendar"));
  };

  // The most useful next step for each kind of action.
  const next =
    task.kind === "medication"
      ? { label: t("My medicines"), to: "/prescriptions" }
      : task.kind === "lifestyle" || task.kind === "other"
        ? undefined
        : { label: task.forGp || task.kind === "appointment" ? t("Book appointment") : t("Find a clinic"), to: "/find-care" };

  return (
    <Card className={cn("space-y-2", task.doneAt && "opacity-60")}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={task.doneAt ? t("Mark as not done") : t("Mark as done")}
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-2",
            task.doneAt ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white ring-ink/20",
          )}
        >
          {task.doneAt && <Check className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-semibold leading-snug", task.doneAt && "line-through")}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={task.forGp ? "purple" : "slate"}>
              <Icon className="mr-1 inline h-3 w-3" />
              {task.forGp ? t("For your GP") : t(ACTION_KIND_LABEL[task.kind])}
            </Badge>
            {task.dueDate && <Badge tone={overdue ? "red" : "amber"}>{overdue ? t("Overdue: {{date}}", { date: fmt.date(task.dueDate) }) : t("By {{date}}", { date: fmt.date(task.dueDate) })}</Badge>}
          </div>
          {task.forGp && !task.doneAt && !compact && <p className="mt-1.5 text-xs text-ink/60">{t("Show this to your GP or regular doctor, or book an appointment so they can do it.")}</p>}
          {record && !compact && (
            <button type="button" onClick={() => navigate(`/records?open=${record.id}`)} className="mt-1.5 flex items-start gap-1 text-left text-xs font-semibold text-ink/55 underline underline-offset-2">
              <FileText className="h-3.5 w-3.5" />
              {t("From: {{title}}", { title: t(record.title) })}
            </button>
          )}
        </div>
      </div>
      {!task.doneAt && !compact && (next || task.dueDate) && (
        <div className="flex flex-wrap gap-2 pl-10">
          {next && (
            <Button size="sm" variant="secondary" onClick={() => navigate(next.to)}>
              {task.kind === "medication" ? <Pill className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
              {next.label}
            </Button>
          )}
          {task.dueDate && !inCalendar && (
            <Button size="sm" variant="outline" onClick={addToCalendar}>
              <CalendarPlus className="h-4 w-4" />
              {t("Add to calendar")}
            </Button>
          )}
        </div>
      )}
      {task.doneAt && !compact && (
        <div className="pl-10 text-xs text-ink/55">
          <RotateCcw className="mr-1 inline h-3 w-3" />
          {t("Done {{date}}", { date: fmt.date(task.doneAt) })}
        </div>
      )}
    </Card>
  );
}
