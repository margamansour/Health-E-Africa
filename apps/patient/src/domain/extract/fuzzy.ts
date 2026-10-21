/** Edit distance (insertions, deletions, substitutions) between two short strings. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n]!;
}

/** True when two words are the same apart from a misread letter or two (OCR errors). Short words must match exactly. */
export function nearlySame(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x === y) return true;
  const len = Math.min(x.length, y.length);
  if (len < 5) return false;
  return editDistance(x, y) <= (len >= 9 ? 2 : 1);
}
