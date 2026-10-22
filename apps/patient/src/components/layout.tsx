import { Suspense, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  FlaskConical,
  HeartPulse,
  Home,
  LayoutGrid,
  Pill,
  Settings,
  Stethoscope,
  Syringe,
  User,
  ListTodo,
  type LucideIcon,
} from "lucide-react";
import { Sheet } from "./ui";
import { cn } from "@/lib/utils";
import { useUnreadCount } from "@/lib/hooks";

export interface NavItem {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: string;
}

export const HEALTH_LINKS: NavItem[] = [
  { to: "/summary", label: "Medical summary", description: "Your health at a glance, and sharing", icon: ClipboardList, tone: "bg-lavender" },
  { to: "/records", label: "Records", description: "Letters, reports and documents", icon: FileText, tone: "bg-peach" },
  { to: "/results", label: "Results", description: "Blood tests and lab results", icon: FlaskConical, tone: "bg-mint" },
  { to: "/immunisations", label: "Immunisations", description: "Vaccines given and due", icon: Syringe, tone: "bg-butter" },
];

export const MORE_LINKS: NavItem[] = [
  { to: "/tasks", label: "To do", description: "Follow-ups, tests and medicine changes from your documents", icon: ListTodo, tone: "bg-peach" },
  { to: "/appointments", label: "My appointments", description: "Requests and bookings", icon: Stethoscope, tone: "bg-sky" },
  { to: "/prescriptions", label: "Prescriptions", description: "Repeat and acute medicines", icon: Pill, tone: "bg-rose" },
  { to: "/calendar", label: "Calendar", description: "Events and health reminders", icon: CalendarDays, tone: "bg-butter" },
  { to: "/notifications", label: "Notifications", description: "Updates and reminders", icon: Bell, tone: "bg-coral" },
  { to: "/bio", label: "My bio", description: "Personal and health profile", icon: User, tone: "bg-mint" },
  { to: "/settings", label: "Settings", description: "Notifications, privacy, account", icon: Settings, tone: "bg-sage" },
];

const HEALTH_PATHS = ["/health", ...HEALTH_LINKS.map((l) => l.to)];
const MORE_PATHS = ["/more", ...MORE_LINKS.map((l) => l.to)];

function NavSheet({ open, onClose, title, links }: { open: boolean; onClose: () => void; title: string; links: NavItem[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <LinkList
        links={links}
        onPick={(to) => {
          onClose();
          navigate(to);
        }}
      />
      <p className="sr-only">{t("Choose a page")}</p>
    </Sheet>
  );
}

export function LinkList({ links, onPick }: { links: NavItem[]; onPick: (to: string) => void }) {
  const { t } = useTranslation();
  const unread = useUnreadCount();
  return (
    <ul className="space-y-2">
      {links.map((l) => (
        <li key={l.to}>
          <button type="button" onClick={() => onPick(l.to)} className="flex w-full items-center gap-3 rounded-[24px] bg-white px-3 py-3 text-left shadow-[0_2px_12px_-6px_rgba(35,32,47,0.12)] transition active:scale-[0.99]">
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink", l.tone)}>
              <l.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-ink">{t(l.label)}</span>
              <span className="block truncate text-xs text-ink/55">{t(l.description)}</span>
            </span>
            {l.to === "/notifications" && unread > 0 && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">{unread}</span>
            )}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream"><ChevronRight className="h-4 w-4 text-ink" /></span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function BottomNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const unread = useUnreadCount();
  const [sheet, setSheet] = useState<null | "health" | "more">(null);
  const inHealth = HEALTH_PATHS.some((p) => pathname.startsWith(p));
  const inMore = MORE_PATHS.some((p) => pathname.startsWith(p));

  const tab = (activeTab: boolean) =>
    cn(
      "flex h-12 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition",
      activeTab ? "bg-white px-4 text-ink" : "w-12 text-white/70 hover:text-white",
    );
  const label = (activeTab: boolean, text: string) => (activeTab ? <span>{text}</span> : <span className="sr-only">{text}</span>);

  return (
    <>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 px-4 pt-2" aria-label={t("Main")}>
        <div className="mx-auto mb-1 flex max-w-md items-center justify-between rounded-full bg-ink p-1.5 shadow-[0_12px_30px_-10px_rgba(35,32,47,0.6)]">
          <NavLink to="/" end className={({ isActive }) => tab(isActive)}>
            {({ isActive }) => (
              <>
                <Home className="h-5 w-5" />
                {label(isActive, t("Home"))}
              </>
            )}
          </NavLink>
          <button type="button" className={tab(inHealth)} onClick={() => setSheet("health")}>
            <HeartPulse className="h-5 w-5" />
            {label(inHealth, t("Health"))}
          </button>
          <NavLink to="/find-care" className={({ isActive }) => tab(isActive)}>
            {({ isActive }) => (
              <>
                <Stethoscope className="h-5 w-5" />
                {label(isActive, t("Care"))}
              </>
            )}
          </NavLink>
          <button type="button" className={cn(tab(inMore), "relative")} onClick={() => setSheet("more")}>
            <LayoutGrid className="h-5 w-5" />
            {label(inMore, t("More"))}
            {unread > 0 && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-coral ring-2 ring-ink" />}
          </button>
        </div>
      </nav>
      <NavSheet open={sheet === "health"} onClose={() => setSheet(null)} title={t("Health")} links={HEALTH_LINKS} />
      <NavSheet open={sheet === "more"} onClose={() => setSheet(null)} title={t("More")} links={MORE_LINKS} />
    </>
  );
}

export function AppShell() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-cream pb-28">
      <div className="px-4 pt-2">
        <p className="rounded-full bg-butter px-3 py-1 text-center text-[11px] font-semibold text-ink">
          {t("Demo mode — use sample data only. Your data stays on this device.")}
        </p>
      </div>
      <Suspense fallback={<div className="flex justify-center py-24"><span className="h-8 w-8 animate-spin rounded-full border-4 border-lavender border-t-ink" /></div>}>
        <Outlet />
      </Suspense>
      <BottomNav />
    </div>
  );
}

export function PageHeader({ title, back, action, subtitle }: { title: string; back?: boolean | string; action?: ReactNode; subtitle?: string }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 bg-cream/90 px-4 py-3 backdrop-blur">
      {back && (
        <button
          type="button"
          onClick={() => (typeof back === "string" ? navigate(back) : navigate(-1))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-[0_2px_12px_-6px_rgba(35,32,47,0.15)]"
          aria-label={t("Back")}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="truncate text-xs font-medium text-ink/55">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("space-y-3 px-4 py-4", className)}>{children}</main>;
}
