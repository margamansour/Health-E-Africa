import type { ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { Activity, AlertTriangle, ArrowRight, Bell, ChevronRight, ClipboardList, Droplet, FilePlus2, FlaskConical, HeartHandshake, Inbox, Pill, Search } from "lucide-react";
import { db } from "@/db/db";
import { Card, type CardTone } from "@/components/ui";
import { Page } from "@/components/layout";
import { active, useFormat, useProfile } from "@/lib/hooks";
import { cn, initials } from "@/lib/utils";
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

function Ring({ pct }: { pct: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90" aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(35,32,47,0.12)" strokeWidth="9" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#23202f" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
      <circle cx="50" cy="50" r="31" fill="#fff" />
    </svg>
  );
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
  const next = data.events[0];
  const hasUnread = data.notifications.some((n) => !n.readAt);

  return (
    <Page className="space-y-4 pt-3">
      {/* Greeting */}
      <div className="flex items-center gap-3">
        <Link to="/bio" className="flex h-12 w-12 items-center justify-center rounded-full bg-lavender text-base font-extrabold text-ink" aria-label={t("My bio")}>
          {initials(profile.fullName)}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink/55">{greeting}</p>
          <p className="truncate text-lg font-extrabold">{firstName}!</p>
        </div>
        <Link to="/find-care" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_2px_12px_-6px_rgba(35,32,47,0.15)]" aria-label={t("Find care")}>
          <Search className="h-5 w-5" />
        </Link>
        <Link to="/notifications" className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_2px_12px_-6px_rgba(35,32,47,0.15)]" aria-label={t("Notifications")}>
          <Bell className="h-5 w-5" />
          {hasUnread && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-coral ring-2 ring-white" />}
        </Link>
      </div>

      <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-tight">
        {t("Your health,")}
        <br />
        <span className="font-semibold italic">{t("all in one place")}</span>
      </h1>

      {/* Quick action pills */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[
          { to: "/records?add=1", icon: FilePlus2, label: "Upload record", dark: true },
          { to: "/results?add=1", icon: FlaskConical, label: "Add result" },
          { to: "/summary", icon: ClipboardList, label: "My summary" },
          { to: "/find-care", icon: Search, label: "Find care" },
        ].map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full py-2 pl-2 pr-4 text-sm font-semibold",
              q.dark ? "bg-ink text-white" : "bg-white text-ink shadow-[0_2px_12px_-6px_rgba(35,32,47,0.12)]",
            )}
          >
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", q.dark ? "bg-white/15" : "bg-cream")}>
              <q.icon className="h-4 w-4" />
            </span>
            {t(q.label)}
          </Link>
        ))}
      </div>

      {/* Passport hero */}
      <Card tone="lavender" onClick={() => navigate(pct < 100 ? "/bio" : "/summary")} className="p-5">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold text-ink/70">{t("Health passport")}</p>
            <p className="text-5xl font-extrabold leading-none tracking-tight">
              {pct}
              <span className="text-2xl">%</span>
            </p>
            <p className="text-sm font-semibold">{pct < 100 ? t("Profile complete — finish it") : t("Profile complete")}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold">
                <Droplet className="h-3 w-3 text-red-600" />
                {profile.bloodGroup ?? t("Blood group?")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold">
                <HeartHandshake className="h-3 w-3" />
                {profile.donorStatus === "registered" ? t("Organ donor") : t("Donor status not set")}
              </span>
            </div>
          </div>
          <div className="relative shrink-0">
            <Ring pct={pct} />
            <span className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
              <span className="text-lg font-extrabold">{data.allergies.length + data.meds.length + data.conditions.length}</span>
              <span className="text-[10px] font-semibold text-ink/60">{t("items")}</span>
            </span>
          </div>
        </div>
      </Card>

      {data.unseen > 0 && (
        <Card tone="sky" onClick={() => navigate("/records")} className="flex items-center gap-3 py-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70">
            <Inbox className="h-5 w-5" />
          </span>
          <span className="flex-1 text-sm font-bold">{t("{{count}} new report(s) from your care team", { count: data.unseen })}</span>
          <ChevronRight className="h-5 w-5" />
        </Card>
      )}

      {/* Snapshot tiles */}
      <div className="grid grid-cols-2 gap-3">
        <Tile tone="coral" icon={<AlertTriangle className="h-4 w-4" />} title={t("Allergies")} items={data.allergies.map((a) => a.substance)} empty={t("None recorded")} onClick={() => navigate("/summary#allergies")} />
        <Tile tone="sky" icon={<Pill className="h-4 w-4" />} title={t("Medicines")} items={data.meds.map((m) => m.name)} empty={t("None recorded")} onClick={() => navigate("/summary#medications")} />
        <Tile tone="mint" icon={<Activity className="h-4 w-4" />} title={t("Conditions")} items={data.conditions.map((c) => c.name)} empty={t("None recorded")} onClick={() => navigate("/summary#conditions")} />
        <Tile tone="peach" icon={<FlaskConical className="h-4 w-4" />} title={t("Results")} items={[]} empty={t("Blood tests and lab results")} onClick={() => navigate("/results")} />
      </div>

      {/* Coming up */}
      <Card tone="sage" className="space-y-2 p-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-extrabold">{t("Coming up")}</h2>
          <Link to="/calendar" className="rounded-full bg-white/60 px-3 py-1 text-xs font-bold">
            {t("Calendar")}
          </Link>
        </div>
        {next ? (
          data.events.map((e) => (
            <Link key={e.id} to="/calendar" className="flex items-center gap-3 rounded-full bg-white/65 py-2 pl-2 pr-3">
              <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full bg-white leading-none">
                <span className="text-[9px] font-bold uppercase text-ink/55">{fmt.date(e.start, { month: "short" })}</span>
                <span className="text-base font-extrabold">{new Date(e.start).getDate()}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{t(e.title)}</span>
                <span className="block text-xs text-ink/60">{e.allDay ? t("All day") : fmt.time(e.start)}</span>
              </span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ))
        ) : (
          <p className="rounded-full bg-white/65 px-4 py-3 text-sm font-medium">{t("Nothing scheduled. Your reminders will show here.")}</p>
        )}
      </Card>

      {/* Updates */}
      <div className="flex items-center justify-between px-1 pt-1">
        <h2 className="text-lg font-extrabold">{t("Latest updates")}</h2>
        <Link to="/notifications" className="text-sm font-bold underline decoration-2 underline-offset-4">
          {t("See all")}
        </Link>
      </div>
      {data.notifications.length === 0 ? (
        <Card className="text-sm text-ink/55">{t("No notifications yet.")}</Card>
      ) : (
        <div className="space-y-2">
          {data.notifications.map((n) => (
            <Link key={n.id} to={n.link ?? "/notifications"} className="flex items-center gap-3 rounded-[24px] bg-white px-4 py-3 shadow-[0_2px_12px_-6px_rgba(35,32,47,0.12)]">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", n.readAt ? "bg-ink/15" : "bg-coral")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{t(n.title)}</span>
                <span className="block truncate text-xs text-ink/55">{t(n.body)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}

function Tile({ icon, tone, title, items, empty, onClick }: { icon: ReactNode; tone: CardTone; title: string; items: string[]; empty: string; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Card tone={tone} onClick={onClick} className="flex min-h-40 flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-extrabold leading-tight">{title}</span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/60">{icon}</span>
      </div>
      {items.length > 0 && <span className="mt-1 text-3xl font-extrabold leading-none">{items.length}</span>}
      <p className="mt-1.5 line-clamp-2 flex-1 text-xs font-medium text-ink/70">{items.length ? items.join(", ") : empty}</p>
      <span className="mt-2 flex items-center justify-between text-sm font-bold">
        {t("Check")}
        <ArrowRight className="h-4 w-4" />
      </span>
    </Card>
  );
}
