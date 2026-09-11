/** Rank before formatting: invisible rows should not construct charts or tooltips. */
export function topRankingRows<T extends { key: string }>(
  rows: readonly T[],
  value: (row: T) => number,
): T[] {
  return [...rows].sort((a, b) => value(b) - value(a) || a.key.localeCompare(b.key)).slice(0, 10);
}
