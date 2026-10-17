import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { AlertTriangle, Bell, CalendarDays, ChevronRight, Droplet, FilePlus2, FlaskConical, HeartHandshake, Pill, Search, ClipboardList, Activity } from "lucide-react";
import { db } from "@/db/db";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { Page } from "@/components/layout";
import { active, useFormat, useProfile } from "@/lib/hooks";
import { initials } from "@/lib/utils";
import type { Profile } from "@/db/types";

function completeness(p: Profile, counts: { allergies: number; meds: number; conditions: number }) {
  const checks = [
    !!p.bloodGroup,
    !!p.emergencyName && !!p.emergencyPhone,
    p.insurance.length > 0,
    !!p.donorStatus,
    !!p.nominatedPharmacyId,
    counts.allergies > 0,
    counts.meds > 0,
    counts.conditions > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fmt = useFormat();
  const profile = useProfile();
  const data = useLiveQuery(async () => {
    const [allergies, meds, conditions, events, notifications, unseen] = await Promise.all([
      db.allergies.toArray(),
      db.medications.toArray(),
      db.conditions.toArray(),
      db.events.where("start").aboveOrEqual(new Date(new Date().setHours(0, 0, 0, 0)).toISOString()).limit(20).sortBy("start"),
      db.notifications.orderBy("createdAt").reverse().limit(3).toArray(),
      db.records.filter((r) => r.source === "facility" && !r.seenAt).count(),
    ]);
    return {
      allergies: active(allergies).filter((a) => a.status === "active"),
      meds: active(meds).filter((m) => m.status === "active"),
      conditions: active(conditions).filter((c) => c.status === "active"),
      events: events.filter((e) => !e.doneAt).slice(0, 3),
      notifications,
      unseen,
    };
  }, []);

  if (!profile || !data) return null;
  const pct = completeness(profile, { allergies: data.allergies.length, meds: data.meds.length, conditions: data.conditions.length });
  const firstName = profile.fullName.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("Good morning") : hour < 17 ? t("Good afternoon") : t("Good evening");

  return (
    <>
      <div className="bg-gradient-to-br from-brand-700 to-brand-900 px-4 pb-16 pt-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-brand-100">{greeting},</p>
            <h1 className="text-2xl font-bold">{firstName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/notifications" className="relative rounded-full bg-white/15 p-2.5" aria-label={t("Notifications")}>
              <Bell className="h-5 w-5" />
              {data.notifications.some((n) => !n.readAt) && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-brand-800" />}
            </Link>
            <Link to="/bio" className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-semibold text-brand-800" aria-label={t("My bio")}>
              {initials(profile.fullName)}
            </Link>
          </div>
        </div>
      </div>

      <Page className="-mt-12">
        {/* Health passport card */}
        <Card className="space-y-3" onClick={() => navigate("/summary")}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t("Health passport")}</p>
              <p className="font-semibold">{profile.fullName}</p>
              <p className="text-xs text-slate-500">
                {fmt.date(profile.dob)} · {profile.county}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge tone="red">
                <Droplet className="h-3 w-3" />
                {profile.bloodGroup ?? t("Blood group?")}
              </Badge>
              <Badge tone={profile.donorStatus === "registered" ? "green" : "slate"}>
                <HeartHandshake className="h-3 w-3" />
                {profile.donorStatus === "registered" ? t("Organ donor") : t("Donor status not set")}
              </Badge>
            </div>
          </div>
          {pct < 100 && (
            <div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">{t("Profile {{pct}}% complete", { pct })}</span>
                <span className="font-medium text-brand-700">{t("Complete it")}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </Card>

        {data.unseen > 0 && (
          <Card onClick={() => navigate("/records")} className="flex items-center gap-3 bg-sky-50 ring-sky-200">
            <FlaskConical className="h-5 w-5 text-sky-700" />
            <span className="flex-1 text-sm font-medium text-sky-900">{t("{{count}} new report(s) from your care team", { count: data.unseen })}</span>
            <ChevronRight className="h-4 w-4 text-sky-700" />
          </Card>
        )}

        {/* Snapshot */}
        <div className="grid grid-cols-2 gap-3">
          <SnapshotCard
            icon={<AlertTriangle className="h-4 w-4" />}
            tone="red"
            title={t("Allergies")}
            items={data.allergies.map((a) => a.substance)}
            empty={t("None recorded")}
            onClick={() => navigate("/summary#allergies")}
          />
          <SnapshotCard
            icon={<Pill className="h-4 w-4" />}
            tone="blue"
            title={t("Medicines")}
            items={data.meds.map((m) => m.name)}
            empty={t("None recorded")}
            onClick={() => navigate("/summary#medications")}
          />
          <SnapshotCard
            icon={<Activity className="h-4 w-4" />}
            tone="purple"
            title={t("Conditions")}
            items={data.conditions.map((c) => c.name)}
            empty={t("None recorded")}
            onClick={() => navigate("/summary#conditions")}
          />
          <SnapshotCard
            icon={<Droplet className="h-4 w-4" />}
            tone="amber"
            title={t("Blood group")}
            items={profile.bloodGroup ? [profile.bloodGroup] : []}
            empty={t("Not set")}
            onClick={() => navigate("/bio")}
          />
        </div>

        {/* Quick links */}
        <SectionTitle>{t("Quick actions")}</SectionTitle>
        <div className="grid grid-cols-4 gap-2">
          {[
            { to: "/records?add=1", icon: FilePlus2, label: "Upload record" },
            { to: "/results?add=1", icon: FlaskConical, label: "Add result" },
            { to: "/summary", icon: ClipboardList, label: "My summary" },
            { to: "/find-care", icon: Search, label: "Find care" },
          ].map((q) => (
            <Link key={q.to} to={q.to} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-center text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/70">
              <span className="rounded-xl bg-brand-50 p-2 text-brand-700">
                <q.icon className="h-5 w-5" />
              </span>
              {t(q.label)}
            </Link>
          ))}
        </div>

        {/* Upcoming */}
        <SectionTitle action={<Link to="/calendar" className="text-sm font-medium text-brand-700">{t("Calendar")}</Link>}>{t("Coming up")}</SectionTitle>
        {data.events.length === 0 ? (
          <Card className="text-sm text-slate-500">{t("Nothing scheduled. Your reminders will show here.")}</Card>
        ) : (
          <Card className="divide-y divide-slate-100 p-0">
            {data.events.map((e) => (
              <Link key={e.id} to="/calendar" className="flex items-center gap-3 px-4 py-3">
                <div className="w-12 shrink-0 rounded-lg bg-brand-50 py-1 text-center">
                  <div className="text-[10px] font-semibold uppercase text-brand-700">{fmt.date(e.start, { month: "short" })}</div>
                  <div className="text-lg font-bold leading-none text-brand-900">{new Date(e.start).getDate()}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t(e.title)}</p>
                  <p className="text-xs text-slate-500">{e.allDay ? t("All day") : fmt.time(e.start)}</p>
                </div>
                <CalendarDays className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </Card>
        )}

        {/* Notifications */}
        <SectionTitle action={<Link to="/notifications" className="text-sm font-medium text-brand-700">{t("See all")}</Link>}>{t("Latest updates")}</SectionTitle>
        {data.notifications.length === 0 ? (
          <Card className="text-sm text-slate-500">{t("No notifications yet.")}</Card>
        ) : (
          <Card className="divide-y divide-slate-100 p-0">
            {data.notifications.map((n) => (
              <Link key={n.id} to={n.link ?? "/notifications"} className="flex gap-3 px-4 py-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-brand-600"}`} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t(n.title)}</p>
                  <p className="truncate text-xs text-slate-500">{t(n.body)}</p>
                </div>
              </Link>
            ))}
          </Card>
        )}
      </Page>
    </>
  );
}

function SnapshotCard({
  icon,
  tone,
  title,
  items,
  empty,
  onClick,
}: {
  icon: React.ReactNode;
  tone: "red" | "blue" | "purple" | "amber";
  title: string;
  items: string[];
  empty: string;
  onClick: () => void;
}) {
  const toneCls = { red: "bg-red-50 text-red-700", blue: "bg-sky-50 text-sky-700", purple: "bg-violet-50 text-violet-700", amber: "bg-amber-50 text-amber-700" }[tone];
  return (
    <Card onClick={onClick} className="min-h-28 p-3">
      <div className="flex items-center gap-2">
        <span className={`rounded-lg p-1.5 ${toneCls}`}>{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
        {items.length > 0 && <span className="ml-auto text-xs text-slate-400">{items.length}</span>}
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{items.length ? items.join(", ") : <span className="text-slate-400">{empty}</span>}</p>
    </Card>
  );
}
