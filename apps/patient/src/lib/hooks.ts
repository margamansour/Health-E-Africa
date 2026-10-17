import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "@/db/db";
import type { Archivable } from "@/db/types";

export function useProfile() {
  return useLiveQuery(() => db.profile.get("me"), [], null);
}

export function useSession() {
  return useLiveQuery(
    async () => {
      const [signedIn, profile] = await Promise.all([db.settings.get("signedIn"), db.profile.get("me")]);
      return { signedIn: signedIn?.value === true && profile?.status === "active", hasProfile: !!profile, profile };
    },
    [],
    undefined,
  );
}

export const active = <T extends Archivable>(rows: T[] | undefined) => (rows ?? []).filter((r) => !r.archivedAt);

export function useUnreadCount() {
  return useLiveQuery(() => db.notifications.filter((n) => !n.readAt).count(), [], 0);
}

/** Localised date/time formatting. */
export function useFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.language === "sw" ? "sw-KE" : "en-KE";
  const date = (v?: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) => {
    if (!v) return "";
    const d = typeof v === "string" ? (v.length === 10 ? new Date(`${v}T00:00:00`) : new Date(v)) : v;
    return d.toLocaleDateString(locale, opts);
  };
  const time = (v?: string | Date) => {
    if (!v) return "";
    const d = typeof v === "string" ? new Date(v) : v;
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  };
  const dateTime = (v?: string) => (v ? `${date(v)}, ${time(v)}` : "");
  const relative = (v: string) => {
    const diff = Date.now() - new Date(v).getTime();
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const mins = Math.round(diff / 60000);
    if (Math.abs(mins) < 60) return rtf.format(-mins, "minute");
    const hrs = Math.round(mins / 60);
    if (Math.abs(hrs) < 24) return rtf.format(-hrs, "hour");
    return rtf.format(-Math.round(hrs / 24), "day");
  };
  return { date, time, dateTime, relative, locale };
}
