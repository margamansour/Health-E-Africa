/**
 * Scan an uploaded document on the device: read its text, find health information,
 * and check whether it carries the marks of a verified source.
 */
import type { Facility, Profile } from "@/db/types";
import { buildLines } from "@/domain/extract/lines";
import { detectSignature, detectStamp, type Box } from "@/domain/extract/marks";
import { extractFromText, type Extraction } from "@/domain/extract/parse";
import { letterIrregularity } from "@/domain/extract/handwriting";
import { assessVerification, type Verification } from "@/domain/extract/verify";
import { today } from "@/lib/utils";

export type ScanStage = "opening" | "reading" | "recognising" | "checking" | "extracting";

export interface ScanResult {
  extraction: Extraction;
  verification: Verification;
  text: string;
  thumbnail?: string;
  ocrConfidence?: number;
}

export interface ScanContext {
  facilities: Facility[];
  profile: Profile | null | undefined;
}

/** Typed PDFs are quick to read, so read long reports in full; photos/scans are slower to recognise. */
const MAX_PDF_PAGES = 20;
const MAX_OCR_PAGES = 4;
const SIGNATURE_LABEL = /^(signature|signed|sign)\b/i;

function pixels(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function thumb(canvas: HTMLCanvasElement) {
  const w = 360;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = Math.round((canvas.height / canvas.width) * w);
  c.getContext("2d")!.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.7);
}

async function imageToCanvas(file: Blob, maxWidth = 2000) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bmp.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas;
}

interface PageScan {
  lines: string[];
  stamp: boolean;
  signature: boolean;
  confidence?: number;
  wordCount: number;
  irregularity?: { baseline: number; height: number; samples: number };
}

/** OCR a page image, then look for a stamp and signature using the word positions. */
async function scanImagePage(canvas: HTMLCanvasElement, onProgress: (p: number) => void): Promise<PageScan> {
  const { recognise } = await import("./ocr");
  const ocr = await recognise(canvas, onProgress);
  const px = pixels(canvas);
  const printed = ocr.words.filter((w) => w.confidence >= 60).map((w) => w.box);
  const labels = ocr.words.filter((w) => SIGNATURE_LABEL.test(w.text)).map((w) => w.box);
  const irregularity = letterIrregularity(ocr.symbolLines);
  return {
    irregularity,
    lines: ocr.lines,
    stamp: detectStamp(px).found,
    signature: detectSignature(px, printed, labels).found,
    confidence: ocr.meanConfidence,
    wordCount: ocr.words.length,
  };
}

/**
 * Decide whether recognised text was handwritten. Printed letters share one baseline and height
 * and are read with high confidence; handwriting wobbles and is read with less confidence.
 * Measured on samples: print ≈ 0.05 baseline / 0.00 height, handwriting ≈ 0.17 / 0.09.
 * When unsure we lean towards "handwritten", which only means the document is saved as unverified.
 */
export function looksHandwritten(p: { confidence?: number; wordCount: number; irregularity?: { baseline: number; height: number; samples: number } }) {
  if (p.confidence === undefined || p.wordCount < 8 || p.confidence < 70) return true;
  const irr = p.irregularity;
  return !!irr && irr.samples >= 15 && (irr.baseline > 0.11 || irr.height > 0.06);
}

export async function scanDocument(file: File, ctx: ScanContext, onStage: (s: ScanStage, progress?: number) => void): Promise<ScanResult> {
  onStage("opening");
  const pages: PageScan[] = [];
  let method: Verification["method"] = "pdf-text";
  let thumbnail: string | undefined;

  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const { openPdf, renderPage } = await import("./pdf");
    const doc = await openPdf(file);
    const count = Math.min(doc.numPages, MAX_PDF_PAGES);
    let ocrPagesDone = 0;
    for (let n = 1; n <= count; n++) {
      onStage("reading", (n - 1) / count);
      const page = await renderPage(doc, n);
      if (n === 1) thumbnail = thumb(page.canvas);
      const chars = page.text.reduce((s, t) => s + t.str.trim().length, 0);
      // Real digital documents carry plenty of text. A scan may only have a stray
      // printed line (a footer or page number), so treat little text as a scanned image.
      if (chars > 150) {
        // A digital PDF: use its text layer directly.
        onStage("checking");
        const px = pixels(page.canvas);
        const boxes: Box[] = page.text.map((t) => ({ x0: t.x, y0: t.y, x1: t.x + t.w, y1: t.y + t.h }));
        const labels = page.text.filter((t) => SIGNATURE_LABEL.test(t.str.trim())).map((t) => ({ x0: t.x, y0: t.y, x1: t.x + t.w, y1: t.y + t.h }));
        pages.push({ lines: buildLines(page.text), stamp: detectStamp(px).found, signature: detectSignature(px, boxes, labels).found, wordCount: chars });
      } else if (ocrPagesDone++ < MAX_OCR_PAGES) {
        // A scanned PDF (just an image): recognise the text.
        method = "ocr";
        onStage("recognising", 0);
        const scanned = await scanImagePage(page.canvas, (p) => onStage("recognising", p));
        pages.push(scanned);
      }
    }
  } else if (file.type.startsWith("image/")) {
    method = "ocr";
    const canvas = await imageToCanvas(file);
    thumbnail = thumb(canvas);
    onStage("recognising", 0);
    pages.push(await scanImagePage(canvas, (p) => onStage("recognising", p)));
  } else {
    throw new Error("Only PDFs and photos can be scanned.");
  }

  onStage("extracting");
  const lines = pages.flatMap((p) => p.lines);
  const extraction = extractFromText(lines, { facilities: ctx.facilities, profile: ctx.profile });
  const ocrPages = pages.filter((p) => p.confidence !== undefined);
  const confidence = ocrPages.length ? ocrPages.reduce((s, p) => s + p.confidence!, 0) / ocrPages.length : undefined;
  const handwritten = ocrPages.some((p) => looksHandwritten(p));
  const facility = extraction.facilityId ? ctx.facilities.find((f) => f.id === extraction.facilityId) : undefined;

  const verification = assessVerification({
    extraction,
    facility,
    handwritten,
    stampFound: pages.some((p) => p.stamp),
    signatureFound: pages.some((p) => p.signature),
    method,
    today: today(),
  });

  return { extraction, verification, text: lines.join("\n"), thumbnail, ocrConfidence: confidence };
}
