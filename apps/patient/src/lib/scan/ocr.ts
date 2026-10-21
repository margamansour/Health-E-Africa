/**
 * On-device text recognition (Tesseract). Nothing is uploaded: the engine and English
 * language data ship with the app and are loaded only the first time a photo is scanned.
 */
import type { Worker as TesseractWorker } from "tesseract.js";
import workerUrl from "tesseract.js/dist/worker.min.js?url";
import coreUrl from "tesseract.js-core/tesseract-core-simd-lstm.js?url";
import wasmUrl from "tesseract.js-core/tesseract-core-simd-lstm.wasm?url";
import langUrl from "@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?url";
import type { Box } from "@/domain/extract/marks";
import type { OcrSymbol } from "@/domain/extract/handwriting";

export interface OcrWord {
  text: string;
  confidence: number;
  box: Box;
}

export interface OcrResult {
  lines: string[];
  words: OcrWord[];
  meanConfidence: number;
  /** Letters with positions, grouped by line (used to tell handwriting from print). */
  symbolLines: OcrSymbol[][];
}

let workerPromise: Promise<TesseractWorker> | null = null;
let progressCb: ((p: number) => void) | null = null;

const abs = (u: string) => new URL(u, document.baseURI).href;

async function text(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Couldn't load ${url}`);
  return r.text();
}

function simdSupported() {
  // Smallest module using a SIMD instruction (from wasm-feature-detect).
  const bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
  try {
    return WebAssembly.validate(bytes);
  } catch {
    return false;
  }
}

async function getWorker(): Promise<TesseractWorker> {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    if (!simdSupported()) throw new Error("This device can't read photos yet. Please type the details in instead.");
    const { createWorker } = await import("tesseract.js");
    const [workerSrc, coreSrc] = await Promise.all([text(workerUrl), text(coreUrl)]);
    // Build one worker script: the engine, then a shim that points it at our bundled
    // .wasm and language files (instead of a CDN), then Tesseract's worker code.
    const shim = `
;(function(){
  var WASM=${JSON.stringify(abs(wasmUrl))}, LANG=${JSON.stringify(abs(langUrl))};
  var core=self.TesseractCore;
  self.TesseractCore=function(a){a=a||{};a.locateFile=function(p){return /\\.wasm$/.test(p)?WASM:p};return core(a)};
  var f=self.fetch.bind(self);
  self.fetch=function(u,o){return /traineddata/.test(String(u))?f(LANG,o):f(u,o)};
})();
`;
    const blob = new Blob([coreSrc, shim, workerSrc], { type: "text/javascript" });
    return createWorker("eng", 1, {
      workerPath: URL.createObjectURL(blob),
      workerBlobURL: false,
      corePath: "bundled-core.js",
      langPath: "https://bundled.local",
      cacheMethod: "none",
      gzip: true,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") progressCb?.(m.progress);
      },
    });
  })();
  workerPromise.catch(() => {
    workerPromise = null;
  });
  return workerPromise;
}

interface TWord {
  text: string;
  confidence: number;
  bbox: Box;
  symbols?: { text: string; bbox: Box }[];
}
interface TLine {
  text: string;
  words: TWord[];
}
interface TBlock {
  paragraphs: { lines: TLine[] }[];
}

export async function recognise(image: HTMLCanvasElement, onProgress?: (p: number) => void): Promise<OcrResult> {
  const worker = await getWorker();
  progressCb = onProgress ?? null;
  const { data } = await worker.recognize(image, {}, { blocks: true, text: true });
  progressCb = null;
  const blocks = ((data as unknown as { blocks?: TBlock[] }).blocks ?? []) as TBlock[];
  const lines: string[] = [];
  const words: OcrWord[] = [];
  const symbolLines: OcrSymbol[][] = [];
  for (const b of blocks)
    for (const p of b.paragraphs)
      for (const l of p.lines) {
        const t = l.text.replace(/\s+/g, " ").trim();
        if (t) lines.push(t);
        const syms: OcrSymbol[] = [];
        for (const w of l.words) {
          if (w.text.trim()) words.push({ text: w.text, confidence: w.confidence, box: w.bbox });
          for (const s of w.symbols ?? []) syms.push({ ch: s.text, box: s.bbox });
        }
        symbolLines.push(syms);
      }
  const real = words.filter((w) => /[a-z0-9]{2,}/i.test(w.text));
  const meanConfidence = real.length ? real.reduce((s, w) => s + w.confidence, 0) / real.length : 0;
  return { lines, words, meanConfidence, symbolLines };
}
