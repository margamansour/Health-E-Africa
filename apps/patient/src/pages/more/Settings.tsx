import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";
import { ChevronRight, Download, FileClock, Globe, LogOut, RotateCcw, ShieldCheck, Trash2, UserX } from "lucide-react";
import { db } from "@/db/db";
import { Badge, Button, Card, ConfirmDialog, KeyValue, SectionTitle, Select, Sheet, Switch } from "@/components/ui";
import { Page, PageHeader } from "@/components/layout";
import { LANGUAGES } from "@/i18n";
import { KENYA_RULES } from "@/domain/reminders";
import { closeAccount, exportAllData, getSetting, resetDevice, setSetting, signOut, syncReminders } from "@/db/actions";
import { useFormat, useProfile } from "@/lib/hooks";
import { POLICY_VERSION } from "@/lib/policy";

const PREFS = [
  { key: "appointments", label: "Appointments", description: "Confirmations, changes and reminders" },
  { key: "results", label: "Results and reports", description: "When a clinic sends something to you" },
  { key: "prescriptions", label: "Prescriptions", description: "Request and delivery updates" },
  { key: "medication", label: "Medication reviews", description: "When a review is due" },
  { key: "screening", label: "Screening and check-ups", description: "Based on your age, sex and conditions" },
  { key: "vaccines", label: "Vaccines", description: "When a dose is due" },
];

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const fmt = useFormat();
  const profile = useProfile();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState<null | "close" | "reset" | "logout">(null);
  const [sheet, setSheet] = useState<null | "consents" | "activity" | "privacy">(null);
  const hiddenRules = useLiveQuery(() => db.ruleStatus.filter((r) => !!r.dismissed).toArray(), []) ?? [];

  useEffect(() => {
    void getSetting<Record<string, boolean>>("notificationPrefs", {}).then(setPrefs);
  }, []);

  const updatePref = async (key: string, value: boolean) => {
    if (key === "browser" && value) {
      if (!("Notification" in window)) return toast.error(t("This browser doesn't support notifications"));
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return toast.error(t("Notifications are blocked in your browser settings"));
    }
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    await setSetting("notificationPrefs", next);
  };

  const download = async () => {
    const blob = await exportAllData();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `health-e-africa-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(t("Your data has been downloaded"));
  };

  return (
    <>
      <PageHeader title={t("Settings")} back />
      <Page>
        <SectionTitle>{t("Notifications")}</SectionTitle>
        <Card className="divide-y divide-slate-100 py-1">
          {PREFS.map((p) => (
            <Switch key={p.key} checked={prefs[p.key] !== false} onChange={(v) => void updatePref(p.key, v)} label={t(p.label)} description={t(p.description)} />
          ))}
          <Switch checked={!!prefs.browser} onChange={(v) => void updatePref("browser", v)} label={t("Phone / browser alerts")} description={t("Alerts never show health details on your lock screen")} />
        </Card>
        {hiddenRules.length > 0 && (
          <Card className="space-y-2">
            <p className="text-sm font-medium">{t("Hidden health checks")}</p>
            {hiddenRules.map((r) => (
              <div key={r.ruleId} className="flex items-center justify-between text-sm">
                <span>{t(KENYA_RULES.find((k) => k.id === r.ruleId)?.title ?? r.ruleId)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await db.ruleStatus.update(r.ruleId, { dismissed: false });
                    void syncReminders();
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("Show again")}
                </Button>
              </div>
            ))}
          </Card>
        )}

        <SectionTitle>{t("Language")}</SectionTitle>
        <Card className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-brand-700" />
          <Select value={i18n.language} onChange={(e) => void i18n.changeLanguage(e.target.value)} aria-label={t("Language")}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </Select>
        </Card>

        <SectionTitle>{t("Privacy and your data")}</SectionTitle>
        <Card className="divide-y divide-slate-100 p-0">
          <MenuRow icon={<ShieldCheck className="h-5 w-5" />} label={t("How we protect your data")} onClick={() => setSheet("privacy")} />
          <MenuRow icon={<FileClock className="h-5 w-5" />} label={t("Consents you've given")} onClick={() => setSheet("consents")} />
          <MenuRow icon={<FileClock className="h-5 w-5" />} label={t("Activity log")} onClick={() => setSheet("activity")} />
          <Link to="/summary?tab=history" className="flex items-center gap-3 px-4 py-3.5 text-sm">
            <span className="text-brand-700">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="flex-1 font-medium">{t("Who I've shared with")}</span>
            <ChevronRight className="h-4 w-4 text-slate-300" />
          </Link>
          <MenuRow icon={<Download className="h-5 w-5" />} label={t("Download my data")} onClick={() => void download()} />
        </Card>

        <SectionTitle>{t("Account")}</SectionTitle>
        {profile && (
          <Card className="divide-y divide-slate-100">
            <KeyValue label={t("Name")} value={profile.fullName} />
            <KeyValue label={t("Phone")} value={profile.phone} />
            <KeyValue label={t("Member since")} value={fmt.date(profile.createdAt)} />
          </Card>
        )}
        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => setConfirm("logout")}>
            <LogOut className="h-4 w-4" />
            {t("Log out")}
          </Button>
          <Button variant="outline" className="w-full text-red-600" onClick={() => setConfirm("close")}>
            <UserX className="h-4 w-4" />
            {t("Close my account")}
          </Button>
          <Button variant="ghost" className="w-full text-slate-500" onClick={() => setConfirm("reset")}>
            <Trash2 className="h-4 w-4" />
            {t("Demo: clear all data on this device")}
          </Button>
        </div>
        <p className="px-1 pt-2 text-xs leading-relaxed text-slate-400">
          {t("Health-e Africa helps you keep and share your health information. It does not give medical advice, diagnose or treat. In an emergency, call 999 or 112, or go to the nearest hospital.")}
        </p>
        <p className="px-1 text-xs text-slate-400">
          {t("Version")} 0.1.0 · {t("Privacy notice")} {POLICY_VERSION}
        </p>
      </Page>

      <ConfirmDialog
        open={confirm === "logout"}
        title={t("Log out?")}
        message={t("Your data stays saved on this device.")}
        confirmLabel={t("Log out")}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void signOut()}
      />
      <ConfirmDialog
        open={confirm === "close"}
        title={t("Close your account?")}
        message={
          <>
            <p>{t("You'll be signed out, all sharing will stop and your consents will be withdrawn.")}</p>
            <p className="mt-2">{t("By law (Digital Health Regulations), your health records will be kept securely and not used for 20 years after the last update, then deleted.")}</p>
          </>
        }
        confirmLabel={t("Close account")}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => void closeAccount()}
      />
      <ConfirmDialog
        open={confirm === "reset"}
        title={t("Clear all demo data?")}
        message={t("Everything on this device will be deleted. Use this only for testing.")}
        confirmLabel={t("Clear everything")}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => void resetDevice()}
      />
      <ConsentsSheet open={sheet === "consents"} onClose={() => setSheet(null)} />
      <ActivitySheet open={sheet === "activity"} onClose={() => setSheet(null)} />
      <PrivacySheet open={sheet === "privacy"} onClose={() => setSheet(null)} />
    </>
  );
}

function MenuRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm">
      <span className="text-brand-700">{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      <ChevronRight className="h-4 w-4 text-slate-300" />
    </button>
  );
}

function ConsentsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const consents = useLiveQuery(() => db.consents.orderBy("grantedAt").reverse().toArray(), []) ?? [];
  const PURPOSE: Record<string, string> = { account: "Using Health-e Africa", share: "Sharing my summary", reminders: "Reminders", notifications: "Notifications" };
  return (
    <Sheet open={open} onClose={onClose} title={t("Consents you've given")}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">{t("A record of exactly what you agreed to, and when. To stop a share, use “Who I've shared with”.")}</p>
        {consents.map((c) => (
          <details key={c.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm">
              <span className="font-medium">{t(PURPOSE[c.purpose] ?? c.purpose)}</span>
              <Badge tone={c.withdrawnAt ? "slate" : c.expiresAt && c.expiresAt < new Date().toISOString() ? "slate" : "green"}>
                {c.withdrawnAt ? t("Withdrawn") : c.expiresAt && c.expiresAt < new Date().toISOString() ? t("Expired") : t("Active")}
              </Badge>
            </summary>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <p>
                {t("Given")}: {fmt.dateTime(c.grantedAt)} · {t("Version")} {c.policyVersion} · {c.language.toUpperCase()}
              </p>
              {c.scope && <p>{c.scope}</p>}
              {c.withdrawnAt && (
                <p>
                  {t("Withdrawn")}: {fmt.dateTime(c.withdrawnAt)}
                </p>
              )}
              <p className="rounded-lg bg-white p-2 italic">“{c.wording}”</p>
            </div>
          </details>
        ))}
      </div>
    </Sheet>
  );
}

function ActivitySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const entries = useLiveQuery(() => (open ? db.audit.orderBy("at").reverse().limit(200).toArray() : []), [open]) ?? [];
  const ACTION: Record<string, string> = {
    create: "Added",
    update: "Changed",
    archive: "Removed",
    delete: "Deleted",
    view: "Viewed",
    share: "Shared",
    revoke: "Stopped sharing",
    export: "Downloaded",
    login: "Signed in",
    logout: "Signed out",
  };
  const ENTITY: Record<string, string> = {
    profile: "Profile",
    conditions: "Condition",
    allergies: "Allergy",
    medications: "Medicine",
    immunisations: "Vaccine",
    records: "Record",
    labPanels: "Lab panel",
    labResults: "Lab result",
    appointments: "Appointment",
    medRequests: "Prescription request",
    shares: "Shared summary",
    consents: "Consent",
    summary: "Medical summary",
    session: "Session",
    account: "Account",
  };
  return (
    <Sheet open={open} onClose={onClose} title={t("Activity log")}>
      <p className="mb-3 text-sm text-slate-600">{t("Every time your health information is added, changed, viewed or shared.")}</p>
      <ul className="divide-y divide-slate-100 text-sm">
        {entries.map((e) => (
          <li key={e.id} className="flex justify-between gap-3 py-2">
            <span>
              <span className="font-medium">{t(ACTION[e.action] ?? e.action)}</span> · {t(ENTITY[e.entity] ?? e.entity)}
              {e.actor !== "patient" && <span className="block text-xs text-slate-500">{t("By")}: {e.actor}</span>}
            </span>
            <span className="shrink-0 text-xs text-slate-400">{fmt.dateTime(e.at)}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function PrivacySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const points = [
    "Your information is stored in Kenya, as required by Kenyan law.",
    "We never sell your data or use it for advertising.",
    "Only people you choose can see your information, and only for as long as you allow.",
    "Every view and change is recorded, and you can see the log.",
    "You can download your data at any time.",
    "If you close your account, your health records are kept securely for 20 years as the law requires, then deleted.",
    "If there is ever a data breach, we will tell you and the regulators straight away.",
  ];
  return (
    <Sheet open={open} onClose={onClose} title={t("How we protect your data")}>
      <ul className="space-y-3 text-sm text-slate-700">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
            {t(p)}
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
        {t("Demo version: data is saved only in this browser on this device and is not sent anywhere.")}
      </p>
    </Sheet>
  );
}
