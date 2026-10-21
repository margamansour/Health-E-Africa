import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ExternalLink, FileText, Inbox, PencilLine } from "lucide-react";
import { db } from "@/db/db";
import type { HealthRecord, LabPanel, LabResult } from "@/db/types";
import { Button, Notice, Sheet } from "./ui";
import { VerifiedBadge } from "./VerificationCard";
import { ANALYTES } from "@/domain/extract/dictionary";
import { useFormat } from "@/lib/hooks";
import { flagFor } from "@/domain/labs";
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

const asNumber = (s: string) => Number(s.replace(/[<>*\s]/g, "").replace(/^(\d{1,3}(?:,\d{3})+)$/, (m) => m.replace(/,/g, "")).replace(",", "."));

/** Words that identify the test on the page: its name and the names labs use for it. */
function analyteWords(analyte: string) {
  const def = ANALYTES.find((a) => a.name === analyte);
  return [analyte, ...(def?.aliases ?? [])].map((w) => w.toLowerCase());
}

/**
 * Render each page of the source PDF and find where this result is printed: a number equal to the
 * value on the same line as the test's name.
 */
async function renderWithHighlight(blob: Blob, result: LabResult): Promise<PageImage[]> {
  const { openPdf, renderPage } = await import("@/lib/scan/pdf");
  const doc = await openPdf(blob);
  const words = analyteWords(result.analyte);
  const pages: PageImage[] = [];
  let found = false;
  for (let n = 1; n <= Math.min(doc.numPages, 20); n++) {
    const page = await renderPage(doc, n, 900);
    const out: PageImage = { src: page.canvas.toDataURL("image/jpeg", 0.85), width: page.canvas.width, height: page.canvas.height };
    if (!found) {
      const values = page.text.filter((t) => {
        const v = asNumber(t.str.trim().split(/\s+/)[0] ?? "");
        return !Number.isNaN(v) && Math.abs(v - result.value) < 1e-9;
      });
      const onSameLine = (a: { y: number; h: number }, b: { y: number; h: number }) => Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) < Math.max(a.h, b.h) * 0.7;
      const match =
        values.find((v) =>
          page.text.some((t) => t !== v && onSameLine(t, v) && t.x < v.x && words.some((w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i").test(t.str))),
        ) ?? undefined;
      if (match) {
        // Highlight the whole row: from the test name to the reference range.
        const row = page.text.filter((t) => onSameLine(t, match));
        const x0 = Math.min(...row.map((t) => t.x));
        const x1 = Math.max(...row.map((t) => t.x + t.w));
        out.highlight = { x: x0 - 6, y: match.y - 4, w: x1 - x0 + 12, h: match.h + 8 };
        found = true;
        // Crop a band around the line (with the highlight drawn in) for the close-up.
        const pad = match.h * 3;
        const cx = Math.max(0, x0 - 20);
        const cy = Math.max(0, match.y - pad);
        const cw = Math.min(page.canvas.width - cx, x1 - x0 + 40);
        const ch = Math.min(page.canvas.height - cy, match.h + pad * 2);
        const crop = document.createElement("canvas");
        crop.width = cw;
        crop.height = ch;
        const g = crop.getContext("2d")!;
        g.drawImage(page.canvas, cx, cy, cw, ch, 0, 0, cw, ch);
        g.fillStyle = "rgba(245, 223, 122, 0.45)";
        g.strokeStyle = "#d97706";
        g.lineWidth = 2;
        const hx = out.highlight.x - cx;
        const hy = out.highlight.y - cy;
        g.fillRect(hx, hy, out.highlight.w, out.highlight.h);
        g.strokeRect(hx, hy, out.highlight.w, out.highlight.h);
        out.zoom = crop.toDataURL("image/png");
      }
    }
    pages.push(out);
  }
  return pages;
}

export function SourceDocumentSheet({ result, panel, onClose }: { result: LabResult | null; panel?: LabPanel; onClose: () => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const navigate = useNavigate();
  const [record, setRecord] = useState<HealthRecord | null | undefined>(undefined);
  const [pages, setPages] = useState<PageImage[] | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRecord(undefined);
    setPages(null);
    setImageUrl(null);
    setFileUrl(null);
    setError(null);
    if (!result) return;
    let cancelled = false;
    const urls: string[] = [];
    void (async () => {
      const rec = panel?.sourceRecordId ? await db.records.get(panel.sourceRecordId) : undefined;
      if (cancelled) return;
      setRecord(rec ?? null);
      const file = rec?.fileId ? await db.files.get(rec.fileId) : undefined;
      if (!file) return;
      const url = URL.createObjectURL(file.blob);
      urls.push(url);
      setFileUrl(url);
      if (file.type.startsWith("image/")) {
        setImageUrl(url);
      } else if (file.type === "application/pdf") {
        try {
          const p = await renderWithHighlight(file.blob, result);
          if (!cancelled) setPages(p);
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [result, panel]);

  // When there's no close-up (line not found), bring the first page into view; otherwise the close-up is at the top.
  useEffect(() => {
    if (pages && !pages.some((p) => p.zoom) && highlightRef.current) highlightRef.current.scrollIntoView({ block: "center" });
  }, [pages]);

  if (!result) return null;
  const flag = flagFor(result);
  const found = pages?.some((p) => p.highlight);

  return (
    <Sheet
      open={!!result}
      onClose={onClose}
      title={t("Where this result came from")}
      footer={
        record ? (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                onClose();
                navigate(`/records?open=${record.id}`);
              }}
            >
              <FileText className="h-4 w-4" />
              {t("Open record")}
            </Button>
            {fileUrl && (
              <a href={fileUrl} target="_blank" rel="noreferrer" className="flex flex-1">
                <Button variant="outline" className="flex-1">
                  <ExternalLink className="h-4 w-4" />
                  {t("Open file")}
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
            <p className="font-extrabold">{result.analyte}</p>
            <p className="text-xs text-ink/55">{fmt.date(result.date)}</p>
          </div>
          <p className={cn("shrink-0 text-2xl font-extrabold", flag === "high" || flag === "low" ? "text-red-600" : "")}>
            {result.value}
            <span className="ml-1 text-sm font-semibold text-ink/55">{result.unit}</span>
          </p>
        </div>

        {record === undefined && <p className="text-sm text-ink/55">{t("Loading…")}</p>}

        {record && (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold">{record.title}</p>
              <p className="text-xs text-ink/55">
                {fmt.date(record.date)}
                {record.facilityName && ` · ${record.facilityName}`}
              </p>
            </div>
            {(record.verification || record.source === "facility") && <VerifiedBadge verified={record.source === "facility" || record.verification?.status === "verified"} />}
          </div>
        )}

        {record === null && (
          <Notice tone="blue" icon={panel?.source === "facility" ? <Inbox className="h-4 w-4" /> : <PencilLine className="h-4 w-4" />}>
            {panel?.source === "facility"
              ? t("Sent by {{name}} through the app. There is no uploaded document for this result.", { name: panel.facilityName ?? t("your clinic") })
              : t("You typed this result in yourself, so there is no document to show.")}
          </Notice>
        )}

        {record && !record.fileId && <Notice tone="blue">{t("This record has no file attached.")}</Notice>}
        {error && <Notice tone="amber">{t("We couldn't show this document.")}</Notice>}
        {record?.fileId && !pages && !imageUrl && !error && <p className="text-sm text-ink/55">{t("Opening document…")}</p>}

        {pages?.find((p) => p.zoom) && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-ink/60">{t("Close-up")}</p>
            <div className="overflow-x-auto rounded-2xl bg-white p-2 ring-2 ring-amber-400">
              <img src={pages.find((p) => p.zoom)!.zoom} alt={t("Close-up of the result in the document")} className="block h-auto min-w-full max-w-none" style={{ width: "max(100%, 560px)" }} />
            </div>
          </div>
        )}

        {pages && (
          <>
            <p className="text-xs font-semibold text-ink/60">
              {found ? t("The highlighted line is where this result appears.") : t("We couldn't pinpoint the line, but the result is in this document.")}
            </p>
            <div className="space-y-3">
              {pages.map((p, i) => (
                <div key={i} className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-ink/10">
                  <img src={p.src} alt={t("Page {{n}}", { n: i + 1 })} className="block w-full" />
                  {p.highlight && (
                    <div
                      ref={highlightRef}
                      className="pointer-events-none absolute rounded-md bg-butter/50 ring-2 ring-amber-500"
                      style={{
                        left: `${(p.highlight.x / p.width) * 100}%`,
                        top: `${(p.highlight.y / p.height) * 100}%`,
                        width: `${(p.highlight.w / p.width) * 100}%`,
                        height: `${(p.highlight.h / p.height) * 100}%`,
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
            <p className="text-xs font-semibold text-ink/60">{t("Look for {{name}} on this page.", { name: result.analyte })}</p>
            <img src={imageUrl} alt={record?.title ?? ""} className="w-full rounded-2xl ring-1 ring-ink/10" />
          </>
        )}
      </div>
    </Sheet>
  );
}
