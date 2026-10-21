import { useTranslation } from "react-i18next";
import { BadgeCheck, Check, CircleAlert, X } from "lucide-react";
import type { Verification, CheckKey } from "@/domain/extract/verify";
import { cn } from "@/lib/utils";
import { useFormat } from "@/lib/hooks";

const LABELS: Record<CheckKey, { ok: string; no: string }> = {
  printed: { ok: "Printed document", no: "Handwritten or unclear" },
  clinic: { ok: "Known licensed clinic", no: "Clinic not recognised" },
  date: { ok: "Dated", no: "No date found" },
  stamp: { ok: "Clinic stamp found", no: "No stamp found" },
  signature: { ok: "Signed", no: "No signature found" },
  patient: { ok: "Your name on the document", no: "Your name not confirmed" },
};

export function VerifiedBadge({ verified, className }: { verified: boolean; className?: string }) {
  const { t } = useTranslation();
  return verified ? (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-xs font-bold text-emerald-900", className)}>
      <BadgeCheck className="h-3.5 w-3.5" />
      {t("Verified source")}
    </span>
  ) : (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-butter px-2.5 py-1 text-xs font-bold text-ink", className)}>
      <CircleAlert className="h-3.5 w-3.5" />
      {t("Unverified")}
    </span>
  );
}

export function VerificationCard({ v, compact }: { v: Verification; compact?: boolean }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const verified = v.status === "verified";
  return (
    <div className={cn("space-y-3 rounded-[24px] p-4", verified ? "bg-mint" : "bg-butter/70")}>
      <div className="flex items-start gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", verified ? "bg-white/70 text-emerald-800" : "bg-white/70 text-ink")}>
          {verified ? <BadgeCheck className="h-5 w-5" /> : <CircleAlert className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p className="text-base font-extrabold">{verified ? t("Verified source") : t("Saved as unverified")}</p>
          <p className="text-xs text-ink/70">
            {verified ? t("Printed by a licensed clinic, dated, and stamped or signed.") : t(v.reasons[0] ?? "Some checks didn't pass.")}
          </p>
        </div>
      </div>
      {!compact && (
        <ul className="grid grid-cols-1 gap-1.5 text-sm">
          {v.checks.map((c) => (
            <li key={c.key} className="flex items-start gap-2 rounded-2xl bg-white/60 px-3 py-2">
              <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", c.ok ? "bg-emerald-600 text-white" : "bg-ink/15 text-ink/60")}>
                {c.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{t(c.ok ? LABELS[c.key].ok : LABELS[c.key].no)}</span>
                {c.detail && <span className="block truncate text-xs text-ink/60">{c.key === "date" ? fmt.date(c.detail) : c.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!verified && v.reasons.length > 1 && !compact && (
        <ul className="list-inside list-disc text-xs text-ink/70">
          {v.reasons.slice(1).map((r) => (
            <li key={r}>{t(r)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
