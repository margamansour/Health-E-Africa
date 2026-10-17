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
}

export const HEALTH_LINKS: NavItem[] = [
  { to: "/summary", label: "Medical summary", description: "Your health at a glance, and sharing", icon: ClipboardList },
  { to: "/records", label: "Records", description: "Letters, reports and documents", icon: FileText },
  { to: "/results", label: "Results", description: "Blood tests and lab results", icon: FlaskConical },
  { to: "/immunisations", label: "Immunisations", description: "Vaccines given and due", icon: Syringe },
];

export const MORE_LINKS: NavItem[] = [
  { to: "/appointments", label: "My appointments", description: "Requests and bookings", icon: Stethoscope },
  { to: "/prescriptions", label: "Prescriptions", description: "Repeat and acute medicines", icon: Pill },
  { to: "/calendar", label: "Calendar", description: "Events and health reminders", icon: CalendarDays },
  { to: "/notifications", label: "Notifications", description: "Updates and reminders", icon: Bell },
  { to: "/bio", label: "My bio", description: "Personal and health profile", icon: User },
  { to: "/settings", label: "Settings", description: "Notifications, privacy, account", icon: Settings },
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
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
      {links.map((l) => (
        <li key={l.to}>
          <button type="button" onClick={() => onPick(l.to)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
            <span className="rounded-xl bg-brand-50 p-2 text-brand-700">
              <l.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-slate-900">{t(l.label)}</span>
              <span className="block truncate text-xs text-slate-500">{t(l.description)}</span>
            </span>
            {l.to === "/notifications" && unread > 0 && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">{unread}</span>
            )}
            <ChevronRight className="h-4 w-4 text-slate-400" />
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
    cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition", activeTab ? "text-brand-700" : "text-slate-500");

  return (
    <>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur" aria-label={t("Main")}>
        <div className="mx-auto flex max-w-lg">
          <NavLink to="/" end className={({ isActive }) => tab(isActive)}>
            <Home className="h-6 w-6" />
            {t("Home")}
          </NavLink>
          <button type="button" className={tab(inHealth)} onClick={() => setSheet("health")}>
            <HeartPulse className="h-6 w-6" />
            {t("Health")}
          </button>
          <NavLink to="/find-care" className={({ isActive }) => tab(isActive)}>
            <Stethoscope className="h-6 w-6" />
            {t("Care")}
          </NavLink>
          <button type="button" className={cn(tab(inMore), "relative")} onClick={() => setSheet("more")}>
            <LayoutGrid className="h-6 w-6" />
            {t("More")}
            {unread > 0 && <span className="absolute right-[calc(50%-18px)] top-1.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" />}
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
    <div className="mx-auto min-h-dvh max-w-lg bg-slate-50 pb-24 shadow-sm">
      <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
        {t("Demo mode — use sample data only. Your data stays on this device.")}
      </div>
      <Suspense fallback={<div className="flex justify-center py-24"><span className="h-8 w-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700" /></div>}>
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
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200/70 bg-slate-50/95 px-4 py-3 backdrop-blur">
      {back && (
        <button
          type="button"
          onClick={() => (typeof back === "string" ? navigate(back) : navigate(-1))}
          className="-ml-2 rounded-full p-2 text-slate-700 hover:bg-slate-200"
          aria-label={t("Back")}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("space-y-3 px-4 py-4", className)}>{children}</main>;
}
