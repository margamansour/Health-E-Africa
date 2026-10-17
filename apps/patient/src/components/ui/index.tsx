import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

// ---------- Button ----------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        {
          primary: "bg-ink text-white hover:bg-brand-800",
          secondary: "bg-lavender text-ink hover:bg-brand-200",
          ghost: "text-ink/80 hover:bg-ink/5",
          danger: "bg-red-600 text-white hover:bg-red-700",
          outline: "bg-white text-ink shadow-[0_1px_0_rgba(35,32,47,0.06)] ring-1 ring-ink/10 hover:bg-cream",
        }[variant],
        {
          sm: "h-9 px-4 text-sm",
          md: "h-12 px-5 text-[15px]",
          lg: "h-14 px-6 text-base",
          icon: "h-11 w-11",
        }[size],
        className,
      )}
      {...props}
    />
  );
}

// ---------- Card ----------

export type CardTone = "white" | "butter" | "peach" | "lavender" | "mint" | "coral" | "rose" | "sage" | "sky" | "ink";

export const TONE_BG: Record<CardTone, string> = {
  white: "bg-white",
  butter: "bg-butter",
  peach: "bg-peach",
  lavender: "bg-lavender",
  mint: "bg-mint",
  coral: "bg-coral",
  rose: "bg-rose",
  sage: "bg-sage",
  sky: "bg-sky",
  ink: "bg-ink text-white",
};

export function Card({ className, children, onClick, tone = "white" }: { className?: string; children: ReactNode; onClick?: () => void; tone?: CardTone }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "block w-full rounded-[28px] p-4 text-left",
        TONE_BG[tone],
        tone === "white" && "shadow-[0_2px_12px_-6px_rgba(35,32,47,0.12)]",
        onClick && "transition hover:brightness-[0.98] active:scale-[0.985]",
        className,
      )}
    >
      {children}
    </Comp>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-1 mt-5 flex items-center justify-between first:mt-0">
      <h2 className="text-lg font-bold text-ink">{children}</h2>
      {action}
    </div>
  );
}

// ---------- Badge ----------

type Tone = "slate" | "green" | "amber" | "red" | "blue" | "brand" | "purple";

export function Badge({ tone = "slate", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        {
          slate: "bg-ink/[0.06] text-ink/75",
          green: "bg-emerald-100 text-emerald-800",
          amber: "bg-amber-100 text-amber-800",
          red: "bg-red-100 text-red-700",
          blue: "bg-sky-100 text-sky-800",
          brand: "bg-lavender text-ink",
          purple: "bg-violet-100 text-violet-800",
        }[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------- Form controls ----------

export function Field({ label, hint, children, required }: { label: string; hint?: string; children: (id: string) => ReactNode; required?: boolean }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-ink/80">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-ink/55">{hint}</p>}
    </div>
  );
}

const control =
  "w-full rounded-2xl border-0 bg-white px-4 text-[15px] text-ink ring-1 ring-ink/10 placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-cream";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 py-2.5", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "h-12 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2364748b%22><path d=%22M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z%22/></svg>')] bg-[length:1.25rem] bg-[right_0.6rem_center] bg-no-repeat pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <label htmlFor={id} className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-ink/55">{description}</span>}
      </label>
      <button
        id={id}
        role="switch"
        type="button"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-ink" : "bg-ink/15")}
      >
        <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-ink/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded accent-ink"
      />
      <span>{children}</span>
    </label>
  );
}

// ---------- Segmented tabs ----------

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex gap-1 rounded-full bg-white p-1 shadow-[0_2px_12px_-6px_rgba(35,32,47,0.12)]" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-full px-2 py-2 text-sm font-semibold transition",
            value === o.value ? "bg-ink text-white" : "text-ink/60 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition",
            value === o.value ? "bg-ink text-white" : "bg-white text-ink/70 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Sheet (bottom drawer) ----------

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="animate-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[32px] bg-white shadow-xl">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-ink/15" />
        <div className="flex items-center justify-between px-5 pb-2 pt-2">
          <h2 className="text-xl font-bold">{title}</h2>
          <Button variant="outline" size="icon" onClick={onClose} aria-label={t("Close")}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="pb-safe px-5 pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------- Confirm dialog ----------

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-ink/40" onClick={onCancel} />
      <div className="animate-fade relative w-full max-w-sm rounded-[28px] bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="mt-2 text-sm text-ink/70">{message}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t("Cancel")}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------- Misc ----------

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[28px] bg-white px-6 py-10 text-center shadow-[0_2px_12px_-6px_rgba(35,32,47,0.12)]">
      <div className="shape-flower mb-4 flex h-16 w-16 items-center justify-center bg-butter text-ink">{icon}</div>
      <p className="text-lg font-bold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-xs text-sm text-ink/60">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "blue", children, icon }: { tone?: "blue" | "amber" | "red" | "green"; children: ReactNode; icon?: ReactNode }) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-2xl p-3.5 text-sm",
        {
          blue: "bg-sky/60 text-ink",
          amber: "bg-butter/60 text-ink",
          red: "bg-coral/40 text-red-950",
          green: "bg-mint text-ink",
        }[tone],
      )}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function KeyValue({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-ink/55">{label}</span>
      <span className="text-right font-semibold text-ink">{value || "—"}</span>
    </div>
  );
}
