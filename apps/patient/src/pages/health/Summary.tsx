import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router";
import { Activity, BadgeCheck, AlertTriangle, ChevronRight, Eye, Pencil, Pill, Plus, Share2, ShieldOff, Syringe, FlaskConical, Phone } from "lucide-react";
import { db, logAudit } from "@/db/db";
import type { Allergy, Condition, Medication } from "@/db/types";
import { Badge, Button, Card, ConfirmDialog, EmptyState, KeyValue, SectionTitle, Tabs } from "@/components/ui";
import { Page, PageHeader } from "@/components/layout";
import { AllergySheet, ConditionSheet, MedicationSheet } from "@/components/ClinicalForms";
import { ShareSheet, SECTION_LABELS } from "@/components/ShareSheet";
import { active, useFormat, useProfile, useVerifiedRecordIds } from "@/lib/hooks";
import { ageOn, today } from "@/lib/utils";
import { flagFor } from "@/domain/labs";
import { immunisationState } from "@/domain/reminders";
import { shareState } from "@/domain/share";
import { revokeShare } from "@/db/actions";

export function SummaryPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "history" ? "history" : "summary";
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    void logAudit({ action: "view", entity: "summary" });
  }, []);

  return (
    <>
      <PageHeader
        title={t("Medical summary")}
        back
        action={
          <Button size="sm" onClick={() => setSharing(true)}>
            <Share2 className="h-4 w-4" />
            {t("Share")}
          </Button>
        }
      />
      <Page>
        <Tabs
          value={tab}
          onChange={(v) => setParams(v === "history" ? { tab: "history" } : {}, { replace: true })}
          options={[
            { value: "summary", label: t("Summary") },
            { value: "history", label: t("Sharing history") },
          ]}
        />
        {tab === "summary" ? <SummaryContent /> : <ShareHistory onShare={() => setSharing(true)} />}
      </Page>
      <ShareSheet open={sharing} onClose={() => setSharing(false)} />
    </>
  );
}

function SummaryContent() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const { hash } = useLocation();
  const profile = useProfile();
  const conditions = active(useLiveQuery(() => db.conditions.toArray(), []));
  const allergies = active(useLiveQuery(() => db.allergies.toArray(), []));
  const meds = active(useLiveQuery(() => db.medications.toArray(), []));
  const immunisations = active(useLiveQuery(() => db.immunisations.toArray(), []));
  const latestLabs = useLiveQuery(async () => {
    const results = await db.labResults.orderBy("date").reverse().toArray();
    const seen = new Set<string>();
    return results.filter((r) => (seen.has(r.analyte) ? false : (seen.add(r.analyte), true))).slice(0, 6);
  }, []);

  const verifiedIds = useVerifiedRecordIds();
  const src = (x: { sourceRecordId?: string }) => (x.sourceRecordId ? (verifiedIds.has(x.sourceRecordId) ? "verified" : "unverified") : undefined);
  const [editCondition, setEditCondition] = useState<Condition | null | undefined>(undefined);
  const [editAllergy, setEditAllergy] = useState<Allergy | null | undefined>(undefined);
  const [editMed, setEditMed] = useState<Medication | null | undefined>(undefined);

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, profile]);

  if (!profile) return null;
  const tk = today();
  const activeConditions = conditions.filter((c) => c.status === "active");
  const pastConditions = conditions.filter((c) => c.status !== "active");
  const currentMeds = meds.filter((m) => m.status === "active");

  return (
    <>
      <Card tone="lavender" className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-extrabold">{profile.fullName}</p>
            <p className="text-sm text-ink/55">
              {t(profile.sex === "female" ? "Female" : "Male")} · {t("{{age}} years", { age: ageOn(profile.dob) })} · {fmt.date(profile.dob)}
            </p>
          </div>
          <Link to="/bio" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70" aria-label={t("Edit")}>
            <Pencil className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-3 divide-y divide-ink/10 rounded-[20px] bg-white/60 px-3">
          <KeyValue label={t("Blood group")} value={profile.bloodGroup} />
          <KeyValue
            label={t("Organ donor")}
            value={profile.donorStatus === "registered" ? t("Yes") : profile.donorStatus === "not_registered" ? t("No") : profile.donorStatus ? t("Undecided") : undefined}
          />
          <KeyValue
            label={t("Emergency contact")}
            value={
              profile.emergencyName ? (
                <a href={`tel:${profile.emergencyPhone}`} className="inline-flex items-center gap-1 text-brand-700">
                  <Phone className="h-3.5 w-3.5" />
                  {profile.emergencyName}
                  {profile.emergencyRelation && ` (${t(profile.emergencyRelation)})`}
                </a>
              ) : undefined
            }
          />
        </div>
      </Card>

      <div id="allergies" className="scroll-mt-20" />
      <SectionTitle action={<AddButton onClick={() => setEditAllergy(null)} />}>{t("Allergies")}</SectionTitle>
      {allergies.length === 0 ? (
        <Card className="text-sm text-ink/55">{t("No allergies recorded. Add any you know about — it helps keep you safe.")}</Card>
      ) : (
        <Card className="divide-y divide-ink/5 p-0">
          {allergies.map((a) => (
            <Row key={a.id} source={src(a)} onClick={() => setEditAllergy(a)} icon={<AlertTriangle className="h-4 w-4 text-red-600" />} title={a.substance} subtitle={a.reaction}>
              <Badge tone={a.status !== "active" ? "slate" : a.severity === "severe" ? "red" : a.severity === "moderate" ? "amber" : "slate"}>
                {a.status !== "active" ? t("Inactive") : t(a.severity === "severe" ? "Severe" : a.severity === "moderate" ? "Moderate" : "Mild")}
              </Badge>
            </Row>
          ))}
        </Card>
      )}

      <div id="conditions" className="scroll-mt-20" />
      <SectionTitle action={<AddButton onClick={() => setEditCondition(null)} />}>{t("Conditions")}</SectionTitle>
      {conditions.length === 0 ? (
        <Card className="text-sm text-ink/55">{t("No conditions recorded.")}</Card>
      ) : (
        <Card className="divide-y divide-ink/5 p-0">
          {[...activeConditions, ...pastConditions].map((c) => (
            <Row
              key={c.id}
              source={src(c)}
              onClick={() => setEditCondition(c)}
              icon={<Activity className="h-4 w-4 text-violet-600" />}
              title={c.name}
              subtitle={c.onsetDate ? t("Since {{date}}", { date: fmt.date(c.onsetDate, { month: "short", year: "numeric" }) }) : undefined}
            >
              {c.status === "active" ? c.chronic ? <Badge tone="purple">{t("Long-term")}</Badge> : <Badge tone="amber">{t("Active")}</Badge> : <Badge>{t("Resolved")}</Badge>}
            </Row>
          ))}
        </Card>
      )}

      <div id="medications" className="scroll-mt-20" />
      <SectionTitle action={<AddButton onClick={() => setEditMed(null)} />}>{t("Medicines")}</SectionTitle>
      {currentMeds.length === 0 ? (
        <Card className="text-sm text-ink/55">{t("No current medicines.")}</Card>
      ) : (
        <Card className="divide-y divide-ink/5 p-0">
          {currentMeds.map((m) => (
            <Row key={m.id} source={src(m)} onClick={() => setEditMed(m)} icon={<Pill className="h-4 w-4 text-sky-600" />} title={`${m.name} ${m.dose}`} subtitle={m.frequency}>
              <Badge tone={m.type === "repeat" ? "blue" : "slate"}>{t(m.type === "repeat" ? "Repeat" : "Acute")}</Badge>
            </Row>
          ))}
        </Card>
      )}
      {meds.some((m) => m.status === "stopped") && (
        <details className="text-sm">
          <summary className="cursor-pointer px-1 text-ink/55">{t("Past medicines")}</summary>
          <Card className="mt-2 divide-y divide-ink/5 p-0">
            {meds
              .filter((m) => m.status === "stopped")
              .map((m) => (
                <Row key={m.id} onClick={() => setEditMed(m)} icon={<Pill className="h-4 w-4 text-ink/40" />} title={`${m.name} ${m.dose}`} subtitle={t("Stopped")} />
              ))}
          </Card>
        </details>
      )}

      <SectionTitle action={<Link to="/results" className="text-sm font-medium text-brand-700">{t("All results")}</Link>}>{t("Recent lab results")}</SectionTitle>
      {!latestLabs || latestLabs.length === 0 ? (
        <Card className="text-sm text-ink/55">{t("No lab results yet.")}</Card>
      ) : (
        <Card className="divide-y divide-ink/5 p-0">
          {latestLabs.map((r) => {
            const flag = flagFor(r);
            return (
              <Row key={r.id} icon={<FlaskConical className="h-4 w-4 text-emerald-600" />} title={r.analyte} subtitle={fmt.date(r.date)}>
                <span className={flag === "high" || flag === "low" ? "font-semibold text-red-600" : "font-medium"}>
                  {r.value} {r.unit} {flag === "high" ? "↑" : flag === "low" ? "↓" : ""}
                </span>
              </Row>
            );
          })}
        </Card>
      )}

      <SectionTitle action={<Link to="/immunisations" className="text-sm font-medium text-brand-700">{t("All")}</Link>}>{t("Immunisations")}</SectionTitle>
      {immunisations.length === 0 ? (
        <Card className="text-sm text-ink/55">{t("No vaccines recorded.")}</Card>
      ) : (
        <Card className="divide-y divide-ink/5 p-0">
          {immunisations.slice(0, 5).map((i) => {
            const st = immunisationState(i, tk);
            return (
              <Row key={i.id} source={src(i)} icon={<Syringe className="h-4 w-4 text-amber-600" />} title={`${i.vaccine}`} subtitle={`${t("Dose {{n}} of {{total}}", { n: i.doseNumber, total: i.seriesTotal })} · ${fmt.date(i.dateGiven ?? i.dueDate)}`}>
                <Badge tone={st === "given" ? "green" : st === "overdue" ? "red" : "amber"}>{t(st === "given" ? "Given" : st === "overdue" ? "Overdue" : st === "due" ? "Due" : "Scheduled")}</Badge>
              </Row>
            );
          })}
        </Card>
      )}

      <p className="px-1 pt-2 text-xs text-ink/40">{t("This summary is based on information you and your care providers have added. It doesn't replace a clinician's assessment.")}</p>

      <ConditionSheet open={editCondition !== undefined} item={editCondition ?? undefined} onClose={() => setEditCondition(undefined)} />
      <AllergySheet open={editAllergy !== undefined} item={editAllergy ?? undefined} onClose={() => setEditAllergy(undefined)} />
      <MedicationSheet open={editMed !== undefined} item={editMed ?? undefined} onClose={() => setEditMed(undefined)} />
    </>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700">
      <Plus className="h-4 w-4" />
      {t("Add")}
    </button>
  );
}

function Row({
  icon,
  title,
  subtitle,
  children,
  onClick,
  source,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  /** Where the item came from: a verified document, an unverified one, or typed in. */
  source?: "verified" | "unverified";
}) {
  const { t } = useTranslation();
  const Comp = onClick ? "button" : "div";
  return (
    <Comp type={onClick ? "button" : undefined} onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left">
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm font-medium">
          <span className="truncate">{title}</span>
          {source === "verified" && <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-label={t("From a verified document")} />}
        </span>
        {source && <span className="block text-[11px] font-semibold text-ink/45">{source === "verified" ? t("From a verified document") : t("From an unverified document")}</span>}
        {subtitle && <span className="block truncate text-xs text-ink/55">{subtitle}</span>}
      </span>
      {children}
      {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-ink/25" />}
    </Comp>
  );
}

function ShareHistory({ onShare }: { onShare: () => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const shares = useLiveQuery(() => db.shares.orderBy("createdAt").reverse().toArray(), []);
  const access = useLiveQuery(() => db.shareAccess.orderBy("at").reverse().toArray(), []) ?? [];
  const [revoking, setRevoking] = useState<string | null>(null);

  if (!shares) return null;
  if (shares.length === 0)
    return (
      <EmptyState
        icon={<Share2 className="h-6 w-6" />}
        title={t("You haven't shared your summary yet")}
        body={t("When you share, you'll see who it went to, when it expires, and every time it was opened.")}
        action={<Button onClick={onShare}>{t("Share my summary")}</Button>}
      />
    );

  return (
    <>
      {shares.map((s) => {
        const state = shareState(s);
        const views = access.filter((a) => a.shareId === s.id);
        return (
          <Card key={s.id} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{s.recipientLabel}</p>
                <p className="text-xs text-ink/55">{s.purpose}</p>
              </div>
              <Badge tone={state === "active" ? "green" : state === "revoked" ? "red" : "slate"}>{t(state === "active" ? "Active" : state === "revoked" ? "Stopped" : "Expired")}</Badge>
            </div>
            <p className="text-xs text-ink/65">{s.sections.map((x) => t(SECTION_LABELS[x])).join(" · ")}</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-ink/55">
              <span>
                {t("Shared")}: {fmt.dateTime(s.createdAt)}
              </span>
              <span>
                {state === "revoked" ? t("Stopped") : t("Ends")}: {fmt.dateTime(s.revokedAt ?? s.expiresAt)}
              </span>
            </div>
            <details>
              <summary className="flex cursor-pointer items-center gap-1 text-xs font-medium text-brand-700">
                <Eye className="h-3.5 w-3.5" />
                {t("Opened {{count}} time(s)", { count: views.length })}
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-ink/65">
                {views.length === 0 && <li>{t("Not opened yet")}</li>}
                {views.map((v) => (
                  <li key={v.id}>
                    {fmt.dateTime(v.at)} — {v.viewer}
                  </li>
                ))}
              </ul>
            </details>
            {state === "active" && (
              <Button size="sm" variant="outline" className="text-red-600" onClick={() => setRevoking(s.id)}>
                <ShieldOff className="h-4 w-4" />
                {t("Stop sharing")}
              </Button>
            )}
          </Card>
        );
      })}
      <ConfirmDialog
        open={!!revoking}
        title={t("Stop sharing?")}
        message={t("The recipient will no longer be able to open your summary.")}
        confirmLabel={t("Stop sharing")}
        danger
        onCancel={() => setRevoking(null)}
        onConfirm={async () => {
          await revokeShare(revoking!);
          setRevoking(null);
        }}
      />
    </>
  );
}
