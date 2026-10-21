/** Read PDFs on the device with pdf.js: text with positions, and pages rendered to images. */
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PositionedText } from "@/domain/extract/lines";
type PdfLib = typeof import("pdfjs-dist");
let ready: Promise<PdfLib> | null = null;

async function pdfjs() {
  ready ??= (async () => {
    // The "legacy" build includes compatibility code for older phone browsers.
    const lib = (await import("pdfjs-dist/legacy/build/pdf.min.mjs")) as unknown as PdfLib;
    if (import.meta.env.MODE === "offline") {
      // Single-file demo: opened from a phone's files, the browser won't start module workers,
      // so pdf.js runs on the page itself (fine for documents of a few pages).
      (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
    } else {
      // Run pdf.js's worker from a blob so it works however the app is hosted.
      const { default: workerUrl } = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
      const src = await (await fetch(workerUrl)).text();
      const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
      lib.GlobalWorkerOptions.workerPort = new Worker(url, { type: "module" });
    }
    return lib;
  })();
  return ready;
}

export async function openPdf(file: Blob): Promise<PDFDocumentProxy> {
  const lib = await pdfjs();
  return lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
}

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  text: PositionedText[]; // in canvas pixels
}

/** Render a page at a fixed width and return its text positioned in the same pixel space. */
export async function renderPage(doc: PDFDocumentProxy, n: number, width = 1200): Promise<RenderedPage> {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  const tc = await page.getTextContent();
  const text: PositionedText[] = [];
  for (const raw of tc.items) {
    const it = raw as { str?: string; transform?: number[]; width?: number; height?: number };
    if (!it.str || !it.transform) continue;
    const fontH = (it.height || Math.hypot(it.transform[2]!, it.transform[3]!)) * viewport.scale;
    const [x, yBase] = viewport.convertToViewportPoint(it.transform[4]!, it.transform[5]!);
    text.push({ str: it.str, x: x!, y: yBase! - fontH, w: (it.width ?? 0) * viewport.scale, h: fontH });
  }
  return { canvas, text };
}
