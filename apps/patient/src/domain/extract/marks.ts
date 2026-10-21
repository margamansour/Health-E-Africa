/**
 * Find a rubber stamp and a handwritten signature on a rendered page.
 * Works on raw RGBA pixels so it runs anywhere (and in tests). Sizes are relative to page width.
 */

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

function hsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max / 255 };
}

/** Stamp ink: saturated blue, violet or red. Black text and pale paper are excluded. */
function isStampInk(r: number, g: number, b: number) {
  const { h, s, v } = hsv(r, g, b);
  if (s < 0.35 || v < 0.25 || v > 0.98) return false;
  return (h >= 195 && h <= 320) || h <= 12 || h >= 345;
}

/** Pen ink: dark strokes of any colour, or saturated blue. */
function isPenInk(r: number, g: number, b: number) {
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  if (luma < 120) return true;
  const { h, s, v } = hsv(r, g, b);
  return s > 0.4 && v < 0.75 && h >= 200 && h <= 260;
}

interface Grid {
  cols: number;
  rows: number;
  cell: number;
  on: Uint8Array;
}

function inkGrid(px: Pixels, test: (r: number, g: number, b: number) => boolean, region?: Box, mask?: Box[]): Grid {
  const cell = Math.max(2, Math.round(px.width / 250));
  const cols = Math.ceil(px.width / cell);
  const rows = Math.ceil(px.height / cell);
  const counts = new Uint16Array(cols * rows);
  const x0 = Math.max(0, Math.floor(region?.x0 ?? 0));
  const y0 = Math.max(0, Math.floor(region?.y0 ?? 0));
  const x1 = Math.min(px.width, Math.ceil(region?.x1 ?? px.width));
  const y1 = Math.min(px.height, Math.ceil(region?.y1 ?? px.height));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * px.width + x) * 4;
      if (px.data[i + 3]! < 128) continue;
      if (!test(px.data[i]!, px.data[i + 1]!, px.data[i + 2]!)) continue;
      if (mask && mask.some((m) => x >= m.x0 && x <= m.x1 && y >= m.y0 && y <= m.y1)) continue;
      counts[Math.floor(y / cell) * cols + Math.floor(x / cell)]!++;
    }
  }
  const min = Math.max(2, Math.round((cell * cell) / 8));
  const on = new Uint8Array(cols * rows);
  for (let i = 0; i < on.length; i++) on[i] = counts[i]! >= min ? 1 : 0;
  return { cols, rows, cell, on };
}

interface Component {
  box: Box;
  cells: number;
}

/** Connected groups of ink cells. `gap` lets nearby strokes join (a stamp's letters and rings). */
function components(g: Grid, gap = 1): Component[] {
  const seen = new Uint8Array(g.on.length);
  const out: Component[] = [];
  const stack: number[] = [];
  for (let start = 0; start < g.on.length; start++) {
    if (!g.on[start] || seen[start]) continue;
    let minX = Infinity,
      minY = Infinity,
      maxX = -1,
      maxY = -1,
      n = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const idx = stack.pop()!;
      const cx = idx % g.cols;
      const cy = (idx - cx) / g.cols;
      n++;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;
      for (let dy = -gap; dy <= gap; dy++) {
        for (let dx = -gap; dx <= gap; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows) continue;
          const ni = ny * g.cols + nx;
          if (g.on[ni] && !seen[ni]) {
            seen[ni] = 1;
            stack.push(ni);
          }
        }
      }
    }
    out.push({ box: { x0: minX * g.cell, y0: minY * g.cell, x1: (maxX + 1) * g.cell, y1: (maxY + 1) * g.cell }, cells: n });
  }
  return out;
}

export function detectStamp(px: Pixels): { found: boolean; box?: Box } {
  const g = inkGrid(px, isStampInk);
  const W = px.width;
  for (const c of components(g, 2)) {
    const w = c.box.x1 - c.box.x0;
    const h = c.box.y1 - c.box.y0;
    const aspect = w / h;
    const fill = c.cells / ((w / g.cell) * (h / g.cell));
    // Round or rectangular stamps: a sizeable, roughly square block of ink that isn't solid.
    if (w >= W * 0.06 && h >= W * 0.06 && w <= W * 0.5 && h <= W * 0.5 && aspect > 0.45 && aspect < 2.2 && fill > 0.08 && fill < 0.75 && c.cells >= 30) {
      return { found: true, box: c.box };
    }
  }
  return { found: false };
}

/**
 * Look for pen strokes near a "Signature" / "Signed" label, ignoring printed text.
 * `textBoxes` are the boxes of printed words; `labels` are the boxes of signature labels.
 */
export function detectSignature(px: Pixels, textBoxes: Box[], labels: Box[]): { found: boolean; box?: Box } {
  const W = px.width;
  const pad = Math.max(2, W / 400);
  const mask = textBoxes.map((b) => ({ x0: b.x0 - pad, y0: b.y0 - pad, x1: b.x1 + pad, y1: b.y1 + pad }));
  for (const l of labels) {
    const lh = Math.max(8, l.y1 - l.y0);
    const regions: Box[] = [
      // To the right of the label
      { x0: l.x1 + 1, y0: l.y0 - lh * 2.5, x1: l.x1 + W * 0.4, y1: l.y1 + lh * 1.2 },
      // Above the label (signature over a printed name)
      { x0: l.x0 - W * 0.02, y0: l.y0 - lh * 7, x1: l.x0 + W * 0.4, y1: l.y0 },
    ];
    for (const region of regions) {
      const g = inkGrid(px, isPenInk, region, mask);
      for (const c of components(g, 2)) {
        const w = c.box.x1 - c.box.x0;
        const h = c.box.y1 - c.box.y0;
        // A signature is a wide scribble with some height (a ruled line has none).
        if (w >= W * 0.05 && h >= W * 0.012 && c.cells >= 12) return { found: true, box: c.box };
      }
    }
  }
  return { found: false };
}
