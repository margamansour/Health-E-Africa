/** A piece of text with its position (top-left origin, any unit). */
export interface PositionedText {
  str: string;
  x: number;
  y: number; // top of the text
  w: number;
  h: number;
}

/**
 * Rebuild reading-order lines from positioned text. Wide gaps become " | " so table
 * columns ("Haemoglobin | 11.4 | g/dL | 12.0 - 17.0") and side-by-side fields stay apart.
 */
export function buildLines(items: PositionedText[]): string[] {
  const words = items.filter((i) => i.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: PositionedText[][] = [];
  for (const it of words) {
    const mid = it.y + it.h / 2;
    const row = rows.find((r) => {
      const ref = r[0]!;
      return Math.abs(ref.y + ref.h / 2 - mid) < Math.max(ref.h, it.h) * 0.5;
    });
    if (row) row.push(it);
    else rows.push([it]);
  }
  return rows
    .sort((a, b) => a[0]!.y - b[0]!.y)
    .map((row) => {
      row.sort((a, b) => a.x - b.x);
      let out = "";
      let prevEnd = -Infinity;
      for (const it of row) {
        const gap = it.x - prevEnd;
        if (out) out += gap > Math.max(it.h * 1.6, 14) ? " | " : gap > it.h * 0.12 || /\s$/.test(out) ? " " : "";
        out += it.str.trim();
        prevEnd = it.x + it.w;
      }
      return out.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
}
