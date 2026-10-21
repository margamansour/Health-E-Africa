import type { Box } from "./marks";

export interface OcrSymbol {
  ch: string;
  box: Box;
}

/** Lower-case letters without ascenders or descenders: in print they all share one height and baseline. */
const X_HEIGHT = /^[acemnorsuvwxz]$/;

function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * How irregular the letters are. Printed text sits on a straight baseline with letters of one
 * height; handwriting wobbles. Returns the typical baseline wobble and height variation, each as a
 * fraction of the letter height (printed text is usually under ~0.06).
 */
export function letterIrregularity(lines: OcrSymbol[][]): { baseline: number; height: number; samples: number } {
  const wobble: number[] = [];
  const heightVar: number[] = [];
  let samples = 0;
  for (const line of lines) {
    const xs = line.filter((s) => X_HEIGHT.test(s.ch)).map((s) => ({ x: (s.box.x0 + s.box.x1) / 2, bottom: s.box.y1, h: s.box.y1 - s.box.y0 }));
    if (xs.length < 5) continue;
    samples += xs.length;
    const medH = median(xs.map((s) => s.h)) || 1;
    // Straight-line fit of the baseline (handles a tilted photo).
    const n = xs.length;
    const mx = xs.reduce((a, s) => a + s.x, 0) / n;
    const my = xs.reduce((a, s) => a + s.bottom, 0) / n;
    const sxx = xs.reduce((a, s) => a + (s.x - mx) ** 2, 0) || 1;
    const slope = xs.reduce((a, s) => a + (s.x - mx) * (s.bottom - my), 0) / sxx;
    const resid = xs.map((s) => Math.abs(s.bottom - (my + slope * (s.x - mx))) / medH);
    wobble.push(median(resid));
    heightVar.push(median(xs.map((s) => Math.abs(s.h / medH - 1))));
  }
  return { baseline: median(wobble), height: median(heightVar), samples };
}
