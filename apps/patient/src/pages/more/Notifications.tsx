import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Bell, CalendarDays, CheckCheck, FlaskConical, Pill, Share2, Stethoscope, Info } from "lucide-react";
import { db } from "@/db/db";
import { markAllRead } from "@/db/actions";
import { Button, Card, EmptyState } from "@/components/ui";
import { Page, PageHeader } from "@/components/layout";
import { useFormat } from "@/lib/hooks";
import { nowIso, cn } from "@/lib/utils";
import type { AppNotification } from "@/db/types";

const ICONS: Record<AppNotification["type"], typeof Bell> = {
  appointment: Stethoscope,
  result: FlaskConical,
  prescription: Pill,
  reminder: CalendarDays,
  share: Share2,
  system: Info,
};

export function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fmt = useFormat();
  const items = useLiveQuery(() => db.notifications.orderBy("createdAt").reverse().toArray(), []);
  const unread = (items ?? []).filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title={t("Notifications")}
        back
        action={
          unread > 0 && (
            <Button size="sm" variant="ghost" onClick={() => void markAllRead()}>
              <CheckCheck className="h-4 w-4" />
              {t("Mark all read")}
            </Button>
          )
        }
      />
      <Page>
        {items && items.length === 0 && <EmptyState icon={<Bell className="h-6 w-6" />} title={t("You're all caught up")} body={t("Appointment updates, results and reminders will appear here.")} />}
        {items && items.length > 0 && (
          <Card className="divide-y divide-ink/5 p-0">
            {items.map((n) => {
              const Icon = ICONS[n.type];
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={async () => {
                    if (!n.readAt) await db.notifications.update(n.id, { readAt: nowIso() });
                    if (n.link) navigate(n.link);
                  }}
                  className={cn("flex w-full gap-3 px-4 py-3.5 text-left", !n.readAt && "bg-brand-50/50")}
                >
                  <span className="rounded-2xl bg-white p-2 text-brand-700 ring-1 ring-ink/10">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className={cn("text-sm", !n.readAt ? "font-semibold" : "font-medium")}>{t(n.title)}</span>
                      <span className="shrink-0 text-[11px] text-ink/40">{fmt.relative(n.createdAt)}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-ink/65">{t(n.body)}</span>
                  </span>
                </button>
              );
            })}
          </Card>
        )}
      </Page>
    </>
  );
}
