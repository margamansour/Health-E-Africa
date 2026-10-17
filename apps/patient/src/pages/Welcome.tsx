import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { ArrowRight, ClipboardList, Lock, Share2, Bell, ShieldCheck } from "lucide-react";
import { Button, Checkbox, Field, Input, Notice, Select } from "@/components/ui";
import { COUNTIES } from "@/data/kenya";
import { LANGUAGES } from "@/i18n";
import { createAccount, resetDevice, signIn, syncReminders } from "@/db/actions";
import { loadSampleHealthData } from "@/db/seed";
import { ACCOUNT_CONSENT, POLICY_VERSION } from "@/lib/policy";
import { useSession } from "@/lib/hooks";
import type { Sex } from "@/db/types";
import { cn } from "@/lib/utils";

type Step = "intro" | "details" | "consent";

export function Welcome() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const session = useSession();
  const [step, setStep] = useState<Step>("intro");
  const [sample, setSample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);
  const [form, setForm] = useState({ fullName: "", dob: "", sex: "" as Sex | "", phone: "+254", county: "Nairobi", email: "" });

  const existing = session?.profile;

  const startSample = () => {
    setSample(true);
    setForm({ fullName: "Amina Wanjiru", dob: "1974-03-12", sex: "female", phone: "+254712345678", county: "Nairobi", email: "" });
    setStep("details");
  };

  const detailsValid = form.fullName.trim().length > 1 && form.dob && form.sex && /^\+?\d{9,13}$/.test(form.phone.replace(/\s/g, "")) && form.county;

  const finish = async () => {
    setBusy(true);
    try {
      await createAccount(
        {
          fullName: form.fullName.trim(),
          dob: form.dob,
          sex: form.sex as Sex,
          phone: form.phone.replace(/\s/g, ""),
          email: form.email || undefined,
          county: form.county,
        },
        t(ACCOUNT_CONSENT),
        i18n.language,
      );
      if (sample) await loadSampleHealthData();
      await syncReminders();
      navigate("/", { replace: true });
      // Signing in last means the app only opens once everything is ready.
      await signIn();
      toast.success(t("Your health passport is ready"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-cream">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-10 w-10 rounded-2xl" />
          <span className="text-lg font-extrabold">Health-e Africa</span>
        </div>
        <div className="flex rounded-full bg-white p-1 text-xs font-bold shadow-[0_2px_12px_-6px_rgba(35,32,47,0.15)]">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => void i18n.changeLanguage(l.code)}
              className={cn("rounded-full px-3 py-1.5", i18n.language === l.code ? "bg-ink text-white" : "text-ink/60")}
            >
              {l.code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {step === "intro" ? (
        <div className="px-5 pt-6">
          <h1 className="text-[42px] font-extrabold leading-[1.02] tracking-tight">
            {t("Your health passport,")}{" "}
            <span className="font-semibold italic">{t("in your pocket")}</span>
          </h1>
          {/* Floating colour blocks, each a part of the passport */}
          <div className="relative mx-auto mt-4 h-72 max-w-sm" aria-hidden="true">
            <div className="shape-flower animate-float absolute left-0 top-2 flex h-36 w-36 items-center justify-center bg-rose" style={{ ["--r" as string]: "-12deg", animationDelay: "60ms" }}>
              <span className="text-center text-sm font-extrabold leading-tight">
                {t("Records")}
                <br />
                <span className="font-semibold">{t("Clinic letter")}</span>
              </span>
            </div>
            <div className="animate-float absolute right-2 top-0 flex h-36 w-36 flex-col items-center justify-center rounded-[28px] bg-butter" style={{ ["--r" as string]: "-10deg", animationDelay: "160ms" }}>
              <span className="text-lg font-extrabold">{t("Results")}</span>
              <span className="text-sm font-semibold">HbA1c 6.9%</span>
            </div>
            <div className="animate-float absolute bottom-0 left-8 flex h-40 w-40 flex-col items-center justify-center rounded-full bg-sky" style={{ ["--r" as string]: "14deg", animationDelay: "260ms" }}>
              <span className="text-lg font-extrabold">{t("Vaccines")}</span>
              <span className="text-sm font-semibold">{t("Due {{date}}", { date: "20/11" })}</span>
            </div>
            <div className="animate-float absolute bottom-6 right-4 flex h-24 w-24 items-center justify-center rounded-full bg-mint" style={{ ["--r" as string]: "0deg", animationDelay: "360ms" }}>
              <span className="text-center text-xs font-extrabold leading-tight">{t("Share")}
                <br />QR</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex-1 px-5 pb-8 pt-6">
        {step === "intro" && (
          <div className="space-y-5">
            <ul className="space-y-3 text-sm font-medium text-ink/80">
              {[
                { icon: ClipboardList, text: "Clinic letters, scans, blood results and prescriptions in one place" },
                { icon: Share2, text: "Share your summary with a clinic — you choose what and for how long" },
                { icon: Bell, text: "Reminders for check-ups, screenings, vaccines and medicines" },
                { icon: Lock, text: "You control who sees your information, and you can see every access" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-ink" />
                  {t(text)}
                </li>
              ))}
            </ul>
            <Notice tone="amber" icon={<ShieldCheck className="h-4 w-4" />}>
              {t("This is a demo version. Please use sample data, not your real medical information. Everything is saved only on this device.")}
            </Notice>
            {existing && existing.status === "active" ? (
              <Button size="lg" className="w-full" onClick={() => void signIn()}>
                {t("Continue as {{name}}", { name: existing.fullName })}
              </Button>
            ) : existing && existing.status === "closed" ? (
              <Notice tone="blue">
                {t("This account was closed. Health records are kept securely for 20 years as required by law.")}
                <Button variant="outline" size="sm" className="mt-2" onClick={() => void resetDevice()}>
                  {t("Clear this device and start again (demo)")}
                </Button>
              </Notice>
            ) : (
              <div className="space-y-2">
                <Button size="lg" className="w-full" onClick={() => setStep("details")}>
                  {t("Create my health passport")}
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Button size="lg" variant="secondary" className="w-full" onClick={startSample}>
                  {t("Try it with a sample patient")}
                </Button>
              </div>
            )}
          </div>
        )}

        {step === "details" && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (detailsValid) setStep("consent");
            }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ink/50">{t("Step {{n}} of {{total}}", { n: 1, total: 2 })}</p>
              <h2 className="text-3xl font-extrabold">{t("About you")}</h2>
            </div>
            <Field label={t("Full name")} required>
              {(id) => <Input id={id} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} autoComplete="name" />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Date of birth")} required>
                {(id) => <Input id={id} type="date" max={new Date().toISOString().slice(0, 10)} value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />}
              </Field>
              <Field label={t("Sex")} required hint={t("Used for screening reminders")}>
                {(id) => (
                  <Select id={id} value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value as Sex })}>
                    <option value="">{t("Select")}</option>
                    <option value="female">{t("Female")}</option>
                    <option value="male">{t("Male")}</option>
                  </Select>
                )}
              </Field>
            </div>
            <Field label={t("Phone number")} required>
              {(id) => <Input id={id} type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />}
            </Field>
            <Field label={t("County")} required>
              {(id) => (
                <Select id={id} value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })}>
                  {COUNTIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t("Email (optional)")}>
              {(id) => <Input id={id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />}
            </Field>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep("intro")}>
                {t("Back")}
              </Button>
              <Button type="submit" className="flex-1" disabled={!detailsValid}>
                {t("Continue")}
              </Button>
            </div>
          </form>
        )}

        {step === "consent" && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ink/50">{t("Step {{n}} of {{total}}", { n: 2, total: 2 })}</p>
              <h2 className="text-3xl font-extrabold">{t("Your consent")}</h2>
            </div>
            <div className="rounded-[24px] bg-white p-5 text-sm leading-relaxed text-ink/80">{t(ACCOUNT_CONSENT)}</div>
            <p className="text-xs text-ink/55">
              {t("Privacy notice version")} {POLICY_VERSION}
            </p>
            <Checkbox checked={agree} onChange={setAgree}>
              {t("I have read this and I agree")}
            </Checkbox>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep("details")}>
                {t("Back")}
              </Button>
              <Button className="flex-1" disabled={!agree || busy} onClick={() => void finish()}>
                {busy ? t("Setting up…") : t("Create my health passport")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
