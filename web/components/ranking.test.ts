import { expect, it } from "bun:test";

import { topRankingRows } from "./ranking.ts";

it("selects each metric's leaders from the full set before preparing display rows", () => {
  const rows = Object.freeze(
    Array.from({ length: 15 }, (_, i) => ({
      key: `agent-${String(i).padStart(2, "0")}`,
      cost: i,
      tokens: 14 - i,
    })),
  );
  const spend = topRankingRows(rows, (row) => row.cost);
  const tokens = topRankingRows(rows, (row) => row.tokens);
  expect(spend.map((row) => row.cost)).toEqual([14, 13, 12, 11, 10, 9, 8, 7, 6, 5]);
  expect(tokens.map((row) => row.tokens)).toEqual([14, 13, 12, 11, 10, 9, 8, 7, 6, 5]);
  expect(spend[0]).toBe(rows[14]);
  expect(tokens[0]).toBe(rows[0]);
  expect(rows[0]?.cost).toBe(0);
});

it("preserves deterministic ID ordering for ties and handles empty rankings", () => {
  expect(topRankingRows([{ key: "b" }, { key: "a" }], () => 1).map((row) => row.key)).toEqual([
    "a",
    "b",
  ]);
  expect(topRankingRows([], () => 0)).toEqual([]);
});
