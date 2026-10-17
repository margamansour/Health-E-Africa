import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, ShieldCheck } from "lucide-react";
import { db } from "@/db/db";
import type { ShareSection, SummaryShare } from "@/db/types";
import { Button, Checkbox, Field, Input, Notice, Select, Sheet } from "./ui";
import { ALL_SECTIONS, EXPIRY_OPTIONS, SUMMARY_TYPES, shareUrl } from "@/domain/share";
import { createShare } from "@/db/actions";
import { SHARE_CONSENT } from "@/lib/policy";
import { active, useFormat } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export const SECTION_LABELS: Record<ShareSection, string> = {
  identity: "Name, date of birth, blood group",
  emergency: "Emergency contact",
  conditions: "Conditions",
  allergies: "Allergies",
  medications: "Medicines",
  labs: "Lab results",
  immunisations: "Immunisations",
  records: "Selected documents",
};

type Step = "what" | "who" | "consent" | "done";

export function ShareSheet({ open, onClose, facilityId }: { open: boolean; onClose: () => void; facilityId?: string }) {
  const { t, i18n } = useTranslation();
  const fmt = useFormat();
  const facilities = useLiveQuery(() => db.facilities.orderBy("county").toArray(), []) ?? [];
  const records = active(useLiveQuery(() => db.records.orderBy("date").reverse().toArray(), []));
  const [step, setStep] = useState<Step>("what");
  const [type, setType] = useState<SummaryShare["summaryType"]>("full");
  const [sections, setSections] = useState<ShareSection[]>(SUMMARY_TYPES.full.sections);
  const [recordIds, setRecordIds] = useState<string[]>([]);
  const [recipient, setRecipient] = useState<string>("link");
  const [linkLabel, setLinkLabel] = useState("");
  const [purpose, setPurpose] = useState("");
  const [hours, setHours] = useState(24 * 7);
  const [agree, setAgree] = useState(false);
  const [result, setResult] = useState<SummaryShare | null>(null);
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep("what");
    setType("full");
    setSections(SUMMARY_TYPES.full.sections);
    setRecordIds([]);
    setRecipient(facilityId ?? "link");
    setLinkLabel("");
    setPurpose("");
    setHours(24 * 7);
    setAgree(false);
    setResult(null);
    setQr("");
  }, [open, facilityId]);

  const pickType = (v: SummaryShare["summaryType"]) => {
    setType(v);
    if (v !== "custom") setSections(SUMMARY_TYPES[v].sections);
  };
  const toggle = (s: ShareSection) => {
    setType("custom");
    setSections((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  };

  const facility = facilities.find((f) => f.id === recipient);
  const recipientLabel = facility ? facility.name : linkLabel.trim() || t("Anyone with the link");
  const effectiveSections = sections.filter((s) => s !== "records" || recordIds.length > 0);

  const confirm = async () => {
    const share = await createShare({
      summaryType: type,
      sections: effectiveSections,
      recordIds: sections.includes("records") ? recordIds : [],
      facilityId: facility?.id,
      recipientLabel,
      purpose: purpose.trim() || t("Medical care"),
      hours,
      consentWording: t(SHARE_CONSENT),
      language: i18n.language,
    });
    setResult(share);
    setQr(await QRCode.toDataURL(shareUrl(share.token), { margin: 1, width: 220 }));
    setStep("done");
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(shareUrl(result.token));
      toast.success(t("Link copied"));
    } catch {
      toast.error(t("Couldn't copy — select and copy the link manually"));
    }
  };

  const footer =
    step === "what" ? (
      <Button className="w-full" disabled={effectiveSections.length === 0} onClick={() => setStep("who")}>
        {t("Continue")}
      </Button>
    ) : step === "who" ? (
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setStep("what")}>
          {t("Back")}
        </Button>
        <Button className="flex-1" onClick={() => setStep("consent")}>
          {t("Continue")}
        </Button>
      </div>
    ) : step === "consent" ? (
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setStep("who")}>
          {t("Back")}
        </Button>
        <Button className="flex-1" disabled={!agree} onClick={() => void confirm()}>
          <ShieldCheck className="h-4 w-4" />
          {t("Agree and share")}
        </Button>
      </div>
    ) : (
      <Button className="w-full" onClick={onClose}>
        {t("Done")}
      </Button>
    );

  return (
    <Sheet open={open} onClose={onClose} title={t("Share my summary")} footer={footer}>
      {step === "what" && (
        <div className="space-y-4">
          <p className="text-sm text-ink/65">{t("What would you like to share?")}</p>
          <div className="space-y-2">
            {(Object.keys(SUMMARY_TYPES) as SummaryShare["summaryType"][]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => pickType(k)}
                className={cn("w-full rounded-2xl border p-3 text-left", type === k ? "border-brand-600 bg-brand-50" : "border-ink/10")}
              >
                <span className="block text-sm font-semibold">{t(SUMMARY_TYPES[k].label)}</span>
                <span className="block text-xs text-ink/55">{t(SUMMARY_TYPES[k].description)}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2 rounded-2xl bg-cream p-3">
            <p className="text-xs font-semibold uppercase text-ink/55">{t("Included")}</p>
            {ALL_SECTIONS.map((s) => (
              <Checkbox key={s} checked={sections.includes(s)} onChange={() => toggle(s)}>
                {t(SECTION_LABELS[s])}
              </Checkbox>
            ))}
          </div>
          {sections.includes("records") && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("Choose documents")}</p>
              {records.length === 0 && <p className="text-xs text-ink/55">{t("You haven't uploaded any records yet.")}</p>}
              {records.map((r) => (
                <Checkbox key={r.id} checked={recordIds.includes(r.id)} onChange={(v) => setRecordIds((cur) => (v ? [...cur, r.id] : cur.filter((x) => x !== r.id)))}>
                  {r.title} <span className="text-ink/40">· {fmt.date(r.date)}</span>
                </Checkbox>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "who" && (
        <div className="space-y-4">
          <Field label={t("Share with")}>
            {(id) => (
              <Select id={id} value={recipient} onChange={(e) => setRecipient(e.target.value)}>
                <option value="link">{t("Anyone with the link (e.g. show a doctor)")}</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} — {f.town}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {recipient === "link" && (
            <Field label={t("Who is it for? (for your records)")}>
              {(id) => <Input id={id} value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder={t("e.g. Dr. Kamau, A&E")} />}
            </Field>
          )}
          <Field label={t("Reason")}>{(id) => <Input id={id} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t("e.g. Second opinion, new clinic")} />}</Field>
          <Field label={t("Access ends after")}>
            {(id) => (
              <Select id={id} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.hours} value={o.hours}>
                    {t(o.label)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      )}

      {step === "consent" && (
        <div className="space-y-4">
          <div className="space-y-1 rounded-2xl bg-cream p-4 text-sm ring-1 ring-ink/10">
            <p>
              <span className="text-ink/55">{t("Recipient")}:</span> <strong>{recipientLabel}</strong>
            </p>
            <p>
              <span className="text-ink/55">{t("Includes")}:</span> {effectiveSections.map((s) => t(SECTION_LABELS[s])).join(", ")}
              {recordIds.length > 0 && ` (${recordIds.length})`}
            </p>
            <p>
              <span className="text-ink/55">{t("Reason")}:</span> {purpose || t("Medical care")}
            </p>
            <p>
              <span className="text-ink/55">{t("Access ends")}:</span> {fmt.dateTime(new Date(Date.now() + hours * 3600_000).toISOString())}
            </p>
          </div>
          <p className="text-sm leading-relaxed text-ink/80">{t(SHARE_CONSENT)}</p>
          <Checkbox checked={agree} onChange={setAgree}>
            {t("I agree")}
          </Checkbox>
        </div>
      )}

      {step === "done" && result && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold">{t("Summary shared")}</p>
            <p className="text-sm text-ink/55">{t("Access ends {{date}}", { date: fmt.dateTime(result.expiresAt) })}</p>
          </div>
          {qr && <img src={qr} alt={t("QR code for the shared summary")} className="mx-auto rounded-2xl ring-1 ring-ink/10" />}
          <p className="text-xs text-ink/55">{t("The clinic can scan this code or open the link.")}</p>
          <div className="flex gap-2">
            <Input readOnly value={shareUrl(result.token)} onFocus={(e) => e.target.select()} className="text-xs" />
            <Button variant="outline" size="icon" onClick={() => void copy()} aria-label={t("Copy link")}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <a href={shareUrl(result.token)} target={import.meta.env.VITE_HASH_ROUTER === "1" ? undefined : "_blank"} rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700">
            <ExternalLink className="h-4 w-4" />
            {t("Preview what they will see")}
          </a>
          <Notice tone="amber">{t("Demo: links only open on this device until the secure server is set up.")}</Notice>
        </div>
      )}
    </Sheet>
  );
}
