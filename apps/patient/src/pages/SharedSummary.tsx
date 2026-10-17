import { useEffect, useRef, useState } from "react";
import iconUrl from "@/assets/icon.svg";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Clock, FileText, ShieldAlert, ShieldCheck } from "lucide-react";
import { db } from "@/db/db";
import type { Allergy, Condition, HealthRecord, Immunisation, LabResult, Medication, Profile, SummaryShare } from "@/db/types";
import { recordShareAccess } from "@/db/actions";
import { shareState } from "@/domain/share";
import { flagFor } from "@/domain/labs";
import { useFormat } from "@/lib/hooks";
import { ageOn } from "@/lib/utils";

interface Payload {
  share: SummaryShare;
  profile?: Profile;
  conditions: Condition[];
  allergies: Allergy[];
  medications: Medication[];
  labs: LabResult[];
  immunisations: Immunisation[];
  records: HealthRecord[];
}

/**
 * What a clinic sees when it opens a shared link. Only the sections the patient chose are loaded.
 * In production this is served by the server, which checks the token and expiry.
 */
export function SharedSummaryPage() {
  const { token } = useParams();
  const { t } = useTranslation();
  const fmt = useFormat();
  const [state, setState] = useState<"loading" | "invalid" | "expired" | "revoked" | "ok">("loading");
  const [data, setData] = useState<Payload | null>(null);
  const logged = useRef(false);

  useEffect(() => {
    void (async () => {
      const share = token ? await db.shares.where("token").equals(token).first() : undefined;
      if (!share) return setState("invalid");
      const st = shareState(share);
      if (st !== "active") return setState(st);
      const has = (s: SummaryShare["sections"][number]) => share.sections.includes(s);
      const live = <T extends { archivedAt?: string }>(rows: T[]) => rows.filter((r) => !r.archivedAt);
      const payload: Payload = {
        share,
        profile: await db.profile.get("me"),
        conditions: has("conditions") ? live(await db.conditions.toArray()).filter((c) => c.status === "active") : [],
        allergies: has("allergies") ? live(await db.allergies.toArray()).filter((a) => a.status === "active") : [],
        medications: has("medications") ? live(await db.medications.toArray()).filter((m) => m.status === "active") : [],
        labs: has("labs") ? await db.labResults.orderBy("date").reverse().limit(30).toArray() : [],
        immunisations: has("immunisations") ? live(await db.immunisations.toArray()).filter((i) => i.dateGiven) : [],
        records: has("records") ? (await db.records.bulkGet(share.recordIds)).filter((r): r is HealthRecord => !!r && !r.archivedAt) : [],
      };
      setData(payload);
      setState("ok");
      if (!logged.current) {
        logged.current = true;
        await recordShareAccess(share.id, share.recipientLabel);
      }
    })();
  }, [token]);

  const openFile = async (r: HealthRecord) => {
    if (!r.fileId) return;
    const f = await db.files.get(r.fileId);
    if (f) window.open(URL.createObjectURL(f.blob), "_blank");
  };

  if (state === "loading") return null;
  if (state !== "ok" || !data)
    return (
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-6 text-center">
        <ShieldAlert className="h-10 w-10 text-ink/40" />
        <h1 className="mt-3 text-xl font-bold">
          {state === "expired" ? t("This link has expired") : state === "revoked" ? t("The patient stopped sharing this summary") : t("This link isn't valid")}
        </h1>
        <p className="mt-2 text-sm text-ink/55">{t("Ask the patient to share their summary again.")}</p>
      </div>
    );

  const { share, profile } = data;
  const has = (s: SummaryShare["sections"][number]) => share.sections.includes(s);

  return (
    <div className="min-h-dvh bg-ink/5">
      <header className="bg-brand-800 px-4 py-3 text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <img src={iconUrl} alt="" className="h-7 w-7 rounded-lg" />
          <span className="font-semibold">Health-e Africa</span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-brand-100">
            <ShieldCheck className="h-4 w-4" />
            {t("Shared by the patient")}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <Clock className="h-4 w-4 shrink-0" />
          {t("Access ends {{date}}. This view is recorded and the patient can see it.", { date: fmt.dateTime(share.expiresAt) })}
        </div>

        {has("identity") && profile && (
          <Section title={t("Patient")}>
            <p className="text-lg font-semibold">{profile.fullName}</p>
            <p className="text-sm text-ink/65">
              {t(profile.sex === "female" ? "Female" : "Male")} · {t("{{age}} years", { age: ageOn(profile.dob) })} · {t("Born")} {fmt.date(profile.dob)}
            </p>
            <p className="text-sm text-ink/65">
              {t("Blood group")}: <strong>{profile.bloodGroup ?? "—"}</strong>
            </p>
          </Section>
        )}
        {has("emergency") && profile?.emergencyName && (
          <Section title={t("Emergency contact")}>
            <p className="text-sm">
              {profile.emergencyName} ({profile.emergencyRelation}) — <a href={`tel:${profile.emergencyPhone}`} className="text-brand-700">{profile.emergencyPhone}</a>
            </p>
          </Section>
        )}
        {has("allergies") && (
          <Section title={t("Allergies")} tone="red">
            {data.allergies.length === 0 ? (
              <p className="text-sm text-ink/55">{t("No known allergies recorded")}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {data.allergies.map((a) => (
                  <li key={a.id}>
                    <strong>{a.substance}</strong> — {a.reaction ?? ""} ({t(a.severity === "severe" ? "Severe" : a.severity === "moderate" ? "Moderate" : "Mild")})
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
        {has("conditions") && (
          <Section title={t("Conditions")}>
            <ul className="list-inside list-disc text-sm">{data.conditions.length ? data.conditions.map((c) => <li key={c.id}>{c.name}</li>) : <li>{t("None recorded")}</li>}</ul>
          </Section>
        )}
        {has("medications") && (
          <Section title={t("Current medicines")}>
            <ul className="space-y-1 text-sm">
              {data.medications.length ? (
                data.medications.map((m) => (
                  <li key={m.id}>
                    <strong>
                      {m.name} {m.dose}
                    </strong>{" "}
                    — {m.frequency}
                  </li>
                ))
              ) : (
                <li>{t("None recorded")}</li>
              )}
            </ul>
          </Section>
        )}
        {has("labs") && data.labs.length > 0 && (
          <Section title={t("Lab results")}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink/55">
                  <th className="py-1">{t("Test")}</th>
                  <th>{t("Result")}</th>
                  <th>{t("Date")}</th>
                </tr>
              </thead>
              <tbody>
                {data.labs.map((r) => {
                  const f = flagFor(r);
                  return (
                    <tr key={r.id} className="border-t border-ink/10">
                      <td className="py-1.5">{r.analyte}</td>
                      <td className={f === "high" || f === "low" ? "font-semibold text-red-600" : ""}>
                        {r.value} {r.unit}
                      </td>
                      <td className="text-ink/55">{fmt.date(r.date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>
        )}
        {has("immunisations") && (
          <Section title={t("Immunisations")}>
            <ul className="space-y-1 text-sm">
              {data.immunisations.map((i) => (
                <li key={i.id}>
                  {i.vaccine} ({t("Dose {{n}} of {{total}}", { n: i.doseNumber, total: i.seriesTotal })}) — {fmt.date(i.dateGiven)}
                </li>
              ))}
            </ul>
          </Section>
        )}
        {has("records") && data.records.length > 0 && (
          <Section title={t("Documents")}>
            <ul className="space-y-2 text-sm">
              {data.records.map((r) => (
                <li key={r.id} className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 text-ink/40" />
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-ink/55">
                      {fmt.date(r.date)} {r.facilityName && `· ${r.facilityName}`}
                    </p>
                    {r.notes && <p className="text-xs text-ink/65">{r.notes}</p>}
                    {r.fileId && (
                      <button type="button" className="text-xs font-medium text-brand-700" onClick={() => void openFile(r)}>
                        {t("Open file")}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <p className="text-center text-xs text-ink/40">{t("Patient-held record. Verify clinically important information with the patient.")}</p>
      </main>
    </div>
  );
}

function Section({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "red" }) {
  return (
    <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${tone === "red" ? "ring-red-200" : "ring-ink/10"}`}>
      <h2 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${tone === "red" ? "text-red-700" : "text-ink/55"}`}>{title}</h2>
      {children}
    </section>
  );
}
