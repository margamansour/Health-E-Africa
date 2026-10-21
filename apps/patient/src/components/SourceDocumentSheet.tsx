import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { BadgeCheck, CircleAlert, ExternalLink, FileText, Inbox, Pencil, PencilLine, Upload } from "lucide-react";
import { db } from "@/db/db";
import type { LabPanel, LabResult } from "@/db/types";
import { Button, Notice, Sheet } from "./ui";
import { VerificationCard, VerifiedBadge } from "./VerificationCard";
import { ANALYTES, CONDITIONS, VACCINES } from "@/domain/extract/dictionary";
import type { Provenance } from "@/domain/provenance";
import { useFormat, useProvenance } from "@/lib/hooks";
import { flagFor, formatValue } from "@/domain/labs";
import { cn } from "@/lib/utils";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PageImage {
  src: string;
  width: number;
  height: number;
  highlight?: Box;
  /** Close-up of the highlighted line and the lines around it, readable on a phone. */
  zoom?: string;
}

/** What to look for on the page: the item's names, and for a lab result its value on the same line. */
export interface FindSpec {
  words: string[];
  value?: number;
  /** Extra words that make a line a better match (e.g. the dose of a medicine). */
  prefer?: string[];
}

/** One item to trace back to where it came from. */
export interface SourceTarget {
  title: string;
  detail?: string;
  date?: string;
  value?: ReactNode;
  provenance: Provenance;
  find: FindSpec;
  /** Shown under the header, e.g. a unit conversion note. */
  notice?: ReactNode;
}

const asNumber = (s: string) => Number(s.replace(/[<>*\s]/g, "").replace(/^(\d{1,3}(?:,\d{3})+)$/, (m) => m.replace(/,/g, "")).replace(",", "."));
const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (w: string) => new RegExp(`(^|[^a-z0-9])${escape(w.toLowerCase())}([^a-z0-9]|$)`, "i");

/** Words that identify an item on the page: its name and the other names documents use for it. */
export function wordsFor(kind: "lab" | "condition" | "vaccine" | "other", name: string): string[] {
  const extra =
    kind === "lab"
      ? (ANALYTES.find((a) => a.name === name)?.aliases ?? [])
      : kind === "condition"
        ? (CONDITIONS.find((c) => c.name === name)?.keywords ?? [])
        : kind === "vaccine"
          ? (VACCINES.find((v) => v.name === name)?.keywords ?? [])
          : [];
  return [...new Set([name, ...extra].map((w) => w.toLowerCase()))];
}

type TextItem = { str: string; x: number; y: number; w: number; h: number };
const onSameLine = (a: { y: number; h: number }, b: { y: number; h: number }) => Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) < Math.max(a.h, b.h) * 0.7;

/** Find the printed line for the item: the anchor text item and the whole row it sits on. */
function locate(text: TextItem[], find: FindSpec): { anchor: TextItem; row: TextItem[] } | undefined {
  if (find.value != null) {
    // Lab result: a number equal to the value, on the same line as (and right of) the test's name.
    const values = text.filter((t) => {
      const v = asNumber(t.str.trim().split(/\s+/)[0] ?? "");
      return !Number.isNaN(v) && Math.abs(v - find.value!) < 1e-9;
    });
    const anchor = values.find((v) => text.some((t) => t !== v && onSameLine(t, v) && t.x < v.x && find.words.some((w) => wordRe(w).test(t.str))));
    return anchor ? { anchor, row: text.filter((t) => onSameLine(t, anchor)) } : undefined;
  }
  // Other items: the line whose text mentions the item, preferring lines with extra detail (e.g. the dose).
  const used = new Set<TextItem>();
  let best: { anchor: TextItem; row: TextItem[]; score: number } | undefined;
  for (const t of [...text].sort((a, b) => a.y - b.y || a.x - b.x)) {
    if (used.has(t)) continue;
    const row = text.filter((u) => onSameLine(u, t)).sort((a, b) => a.x - b.x);
    row.forEach((u) => used.add(u));
    const line = row.map((u) => u.str).join(" ");
    const hit = find.words.find((w) => wordRe(w).test(line));
    if (!hit) continue;
    const score = 10 + (find.prefer ?? []).filter((p) => p && line.toLowerCase().includes(p.toLowerCase())).length;
    if (!best || score > best.score) {
      const anchor = row.find((u) => wordRe(hit).test(u.str)) ?? row[0]!;
      best = { anchor, row, score };
    }
  }
  return best;
}

/** Render each page of the source PDF and highlight the line where the item is printed. */
async function renderWithHighlight(blob: Blob, find: FindSpec): Promise<PageImage[]> {
  const { openPdf, renderPage } = await import("@/lib/scan/pdf");
  const doc = await openPdf(blob);
  const pages: PageImage[] = [];
  let found = false;
  for (let n = 1; n <= Math.min(doc.numPages, 20); n++) {
    const page = await renderPage(doc, n, 900);
    const out: PageImage = { src: page.canvas.toDataURL("image/jpeg", 0.85), width: page.canvas.width, height: page.canvas.height };
    const hit = found ? undefined : locate(page.text, find);
    if (hit) {
      const { anchor, row } = hit;
      const x0 = Math.min(...row.map((t) => t.x));
      const x1 = Math.max(...row.map((t) => t.x + t.w));
      out.highlight = { x: x0 - 6, y: anchor.y - 4, w: x1 - x0 + 12, h: anchor.h + 8 };
      found = true;
      // Crop a band around the line (with the highlight drawn in) for the close-up,
      // from a sharper render of the same page so it stays readable when enlarged.
      const k = 2;
      const sharp = await renderPage(doc, n, 900 * k);
      const pad = anchor.h * 3;
      const cx = Math.max(0, x0 - 20);
      const cy = Math.max(0, anchor.y - pad);
      const cw = Math.min(page.canvas.width - cx, x1 - x0 + 40);
      const ch = Math.min(page.canvas.height - cy, anchor.h + pad * 2);
      const crop = document.createElement("canvas");
      crop.width = cw * k;
      crop.height = ch * k;
      const g = crop.getContext("2d")!;
      g.drawImage(sharp.canvas, cx * k, cy * k, cw * k, ch * k, 0, 0, cw * k, ch * k);
      g.fillStyle = "rgba(245, 223, 122, 0.45)";
      g.strokeStyle = "#d97706";
      g.lineWidth = 2 * k;
      const hl = out.highlight;
      g.fillRect((hl.x - cx) * k, (hl.y - cy) * k, hl.w * k, hl.h * k);
      g.strokeRect((hl.x - cx) * k, (hl.y - cy) * k, hl.w * k, hl.h * k);
      out.zoom = crop.toDataURL("image/png");
    }
    pages.push(out);
  }
  return pages;
}

/** Small label for lists: verified document, unverified document, from a clinic, or added by you. */
export function SourceLabel({ p, className }: { p: Provenance; className?: string }) {
  const { t } = useTranslation();
  const text =
    p.kind === "facility"
      ? p.edited
        ? t("From {{name}} · edited by you", { name: p.name || t("your clinic") })
        : t("From {{name}}", { name: p.name || t("your clinic") })
      : p.kind === "document"
        ? p.edited
          ? t("From a document · edited by you")
          : p.verified
            ? t("Verified document")
            : t("Unverified document")
        : p.kind === "missing"
          ? t("Source document removed")
          : t("Added by you · not verified");
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", p.verified ? "text-emerald-700" : "text-ink/50", className)}>
      {p.verified ? <BadgeCheck className="h-3.5 w-3.5 shrink-0" /> : p.kind === "self" ? <PencilLine className="h-3 w-3 shrink-0" /> : <CircleAlert className="h-3 w-3 shrink-0" />}
      <span className="truncate">{text}</span>
    </span>
  );
}

/**
 * Sheet that traces an item back to where it came from: the document (with the line highlighted),
 * the clinic that sent it, or the patient who typed it in, and whether it is verified.
 */
export function SourceSheet({ target, onClose, onEdit }: { target: SourceTarget | null; onClose: () => void; onEdit?: () => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const navigate = useNavigate();
  const [pages, setPages] = useState<PageImage[] | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const p = target?.provenance;
  const record = p && (p.kind === "document" || p.kind === "facility") ? p.record : undefined;
  const findKey = target ? JSON.stringify(target.find) : "";

  useEffect(() => {
    setPages(null);
    setImageUrl(null);
    setFileUrl(null);
    setError(null);
    setLoading(false);
    if (!target || !record?.fileId) return;
    let cancelled = false;
    const urls: string[] = [];
    setLoading(true);
    void (async () => {
      const file = await db.files.get(record.fileId!);
      if (cancelled) return;
      if (!file) return setLoading(false);
      const url = URL.createObjectURL(file.blob);
      urls.push(url);
      setFileUrl(url);
      if (file.type.startsWith("image/")) setImageUrl(url);
      else if (file.type === "application/pdf") {
        try {
          const pg = await renderWithHighlight(file.blob, target.find);
          if (!cancelled) setPages(pg);
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // The target object is rebuilt on every render; only re-run when the record or search changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id, record?.fileId, findKey, !!target]);

  // When there's no close-up (line not found), bring the first page into view; otherwise the close-up is at the top.
  useEffect(() => {
    if (pages && !pages.some((pg) => pg.zoom) && highlightRef.current) highlightRef.current.scrollIntoView({ block: "center" });
  }, [pages]);

  if (!target || !p) return null;
  const found = pages?.some((pg) => pg.highlight);

  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      title={t("Where this came from")}
      footer={
        onEdit || record ? (
          <div className="flex gap-2">
            {onEdit && (
              <Button variant="secondary" className="flex-1" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                {t("Edit")}
              </Button>
            )}
            {record && (
              <Button
                variant={onEdit ? "outline" : "secondary"}
                className="flex-1"
                onClick={() => {
                  onClose();
                  navigate(`/records?open=${record.id}`);
                }}
              >
                <FileText className="h-4 w-4" />
                <span className="whitespace-nowrap">{onEdit && fileUrl ? t("Record") : t("Open record")}</span>
              </Button>
            )}
            {fileUrl && (
              <a href={fileUrl} target="_blank" rel="noreferrer" className="flex flex-1">
                <Button variant="outline" className="flex-1">
                  <ExternalLink className="h-4 w-4" />
                  <span className="whitespace-nowrap">{onEdit ? t("File") : t("Open file")}</span>
                </Button>
              </a>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-[24px] bg-cream p-4">
          <div className="min-w-0">
            <p className="font-extrabold">{target.title}</p>
            {target.detail && <p className="text-xs text-ink/65">{target.detail}</p>}
            {target.date && <p className="text-xs text-ink/55">{fmt.date(target.date)}</p>}
          </div>
          {target.value && <div className="shrink-0">{target.value}</div>}
        </div>

        {target.notice}

        {p.edited && (
          <Notice tone="amber" icon={<PencilLine className="h-4 w-4" />}>
            {t("You changed this after it was added, so it's no longer marked as verified. The original document is shown below.")}
          </Notice>
        )}

        {record && (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold">{t(record.title)}</p>
              <p className="text-xs text-ink/55">
                {fmt.date(record.date)}
                {record.facilityName && ` · ${record.facilityName}`}
              </p>
            </div>
            {!(p.kind === "document" && record.verification && !p.edited) && <VerifiedBadge verified={p.verified} className="shrink-0" />}
          </div>
        )}
        {p.kind === "document" && record?.verification && !p.edited && <VerificationCard v={record.verification} compact />}

        {p.kind === "facility" && (
          <Notice tone="green" icon={<Inbox className="h-4 w-4" />}>
            {record?.fileId
              ? t("Sent by {{name}} through the app.", { name: p.name || t("your clinic") })
              : t("Sent by {{name}} through the app. There is no uploaded document for this item.", { name: p.name || t("your clinic") })}
            {record?.notes && <span className="mt-1 block text-xs text-ink/65">“{t(record.notes)}”</span>}
          </Notice>
        )}

        {p.kind === "self" && (
          <Notice tone="blue" icon={<PencilLine className="h-4 w-4" />}>
            <span className="block">{t("You added this yourself, so it isn't verified.")}</span>
            <span className="mt-1 block text-xs text-ink/65">{t("Upload a letter, prescription or report from your clinic to back it up.")}</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate("/records?add=1");
              }}
              className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-ink underline underline-offset-4"
            >
              <Upload className="h-3.5 w-3.5" />
              {t("Upload a document")}
            </button>
          </Notice>
        )}

        {p.kind === "missing" && <Notice tone="amber">{t("The document this came from is no longer available.")}</Notice>}

        {p.kind === "document" && record && !record.fileId && <Notice tone="blue">{t("This record has no file attached.")}</Notice>}
        {error && <Notice tone="amber">{t("We couldn't show this document.")}</Notice>}
        {loading && !pages && !imageUrl && !error && <p className="text-sm text-ink/55">{t("Opening document…")}</p>}

        {pages?.find((pg) => pg.zoom) && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-ink/60">{t("Close-up")}</p>
            <div className="overflow-x-auto rounded-2xl bg-white p-2 ring-2 ring-amber-400">
              <img src={pages.find((pg) => pg.zoom)!.zoom} alt={t("Close-up of the item in the document")} className="block h-auto min-w-full max-w-none" style={{ width: "max(100%, 560px)" }} />
            </div>
          </div>
        )}

        {pages && (
          <>
            <p className="text-xs font-semibold text-ink/60">
              {found ? t("The highlighted line is where this appears.") : t("We couldn't pinpoint the line, but it is in this document.")}
            </p>
            <div className="space-y-3">
              {pages.map((pg, i) => (
                <div key={i} className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-ink/10">
                  <img src={pg.src} alt={t("Page {{n}}", { n: i + 1 })} className="block w-full" />
                  {pg.highlight && (
                    <div
                      ref={highlightRef}
                      className="pointer-events-none absolute rounded-md bg-butter/50 ring-2 ring-amber-500"
                      style={{
                        left: `${(pg.highlight.x / pg.width) * 100}%`,
                        top: `${(pg.highlight.y / pg.height) * 100}%`,
                        width: `${(pg.highlight.w / pg.width) * 100}%`,
                        height: `${(pg.highlight.h / pg.height) * 100}%`,
                      }}
                    />
                  )}
                  <span className="absolute right-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-bold text-white">{i + 1}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {imageUrl && (
          <>
            <p className="text-xs font-semibold text-ink/60">{t("Look for {{name}} on this page.", { name: target.title })}</p>
            <img src={imageUrl} alt={record?.title ?? ""} className="w-full rounded-2xl ring-1 ring-ink/10" />
          </>
        )}
      </div>
    </Sheet>
  );
}

/** Where a lab result's panel came from (a scanned report, a clinic sending it, or typed in). */
export function useLabProvenance() {
  const provenance = useProvenance();
  return (panel?: LabPanel) =>
    provenance(panel ? (panel.sourceRecordId ? panel : panel.source === "facility" ? { sourceFacility: panel.facilityName ?? "" } : {}) : {});
}

/** Source sheet for a lab result: highlights the printed value and explains any unit conversion. */
export function SourceDocumentSheet({ result, panel, onClose }: { result: LabResult | null; panel?: LabPanel; onClose: () => void }) {
  const { t } = useTranslation();
  const labProvenance = useLabProvenance();
  if (!result) return <SourceSheet target={null} onClose={onClose} />;
  const flag = flagFor(result);
  const target: SourceTarget = {
    title: result.analyte,
    date: result.date,
    provenance: labProvenance(panel),
    find: { words: wordsFor("lab", result.analyte), value: result.originalValue ?? result.value },
    value: (
      <p className={cn("text-2xl font-extrabold", flag === "high" || flag === "low" ? "text-red-600" : "")}>
        {formatValue(result.value)}
        <span className="ml-1 text-sm font-semibold text-ink/55">{result.unit}</span>
      </p>
    ),
    notice: result.originalUnit ? (
      <Notice tone="blue">
        {t("The report shows {{value}} {{unit}}. We converted it to {{std}} so all your results use the same unit.", {
          value: result.originalValue,
          unit: result.originalUnit,
          std: result.unit,
        })}
      </Notice>
    ) : undefined,
  };
  return <SourceSheet target={target} onClose={onClose} />;
}
