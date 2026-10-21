import { describe, expect, it } from "vitest";
import { letterIrregularity, type OcrSymbol } from "./handwriting";
import { editDistance, nearlySame } from "./fuzzy";

function line(chars: string, wobble: (i: number) => number, height: (i: number) => number): OcrSymbol[] {
  return [...chars].map((ch, i) => {
    const h = height(i);
    const bottom = 100 + i * 0.2 + wobble(i); // slightly tilted page
    return { ch, box: { x0: i * 12, y0: bottom - h, x1: i * 12 + 10, y1: bottom } };
  });
}

describe("handwriting measure", () => {
  it("sees printed text as regular, even when tilted", () => {
    const r = letterIrregularity([line("amoxicillin some more", () => 0, () => 20)]);
    expect(r.baseline).toBeLessThan(0.02);
    expect(r.height).toBeLessThan(0.02);
  });
  it("sees wobbly letters as irregular", () => {
    const r = letterIrregularity([line("amoxicillin some more", (i) => (i % 3) * 3 - 3, (i) => 16 + (i % 4) * 2.5)]);
    expect(r.baseline > 0.11 || r.height > 0.06).toBe(true);
  });
});

describe("fuzzy matching", () => {
  it("allows small OCR slips on longer words only", () => {
    expect(editDistance("wanjiru", "warjiru")).toBe(1);
    expect(nearlySame("Wanjiru", "Warjiru")).toBe(true);
    expect(nearlySame("amina", "anima")).toBe(false);
    expect(nearlySame("tds", "7ds")).toBe(false);
  });
});
