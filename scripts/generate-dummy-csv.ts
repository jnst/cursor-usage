// Generates an anonymized dummy usage-events CSV for README screenshots:
//   bun scripts/generate-dummy-csv.ts > dummy-usage.csv
// Model mix mirrors a real team export; emails and IDs are fake.

// Deterministic PRNG so the output is reproducible.
let seed = 20260610;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function pick<T>(weighted: [T, number][]): T {
  const total = weighted.reduce((sum, [, w]) => sum + w, 0);
  let r = rand() * total;
  for (const [value, w] of weighted) {
    r -= w;
    if (r <= 0) return value;
  }
  return weighted[weighted.length - 1]![0];
}

function between(min: number, max: number): number {
  return min + rand() * (max - min);
}

// [model, share of events, cost multiplier]
const MODELS: [string, number, number][] = [
  ["gpt-5.5-medium", 76, 1.0],
  ["claude-opus-4-8-thinking-high", 13, 2.2],
  ["composer-2.5", 3.5, 0.1],
  ["claude-fable-5-thinking-high", 3, 1.0],
  ["claude-4.6-opus-high-thinking", 2.2, 1.3],
  ["gpt-5.5-high", 1.6, 1.4],
  ["claude-opus-4-7-thinking-high", 0.6, 1.6],
  ["composer-2.5-fast", 0.2, 0.1],
];

const USERS: [string, number][] = [
  ["jnst@example.jp", 45],
  ["sato@example.jp", 25],
  ["suzuki@example.jp", 18],
  ["tanaka@example.jp", 12],
];

const DAYS = [
  "2026-06-01",
  "2026-06-02",
  "2026-06-03",
  "2026-06-04",
  "2026-06-05",
  "2026-06-06",
  "2026-06-07",
  "2026-06-08",
  "2026-06-09",
  "2026-06-10",
];
// Weekday-ish rhythm: lighter on 06-06/06-07 (weekend)
const DAY_WEIGHTS = [1.0, 1.3, 0.9, 1.6, 1.1, 0.3, 0.15, 1.2, 1.4, 0.8];

function hex(n: number): string {
  return Math.floor(rand() * 16 ** n)
    .toString(16)
    .padStart(n, "0");
}

function uuid(): string {
  return `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(8)}${hex(4)}`;
}

const rows: string[] = [
  "Date,User,Cloud Agent ID,Automation ID,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost",
];

const EVENT_COUNT = 620;
for (let i = 0; i < EVENT_COUNT; i++) {
  const dayIndex = pick(DAYS.map((d, j) => [j, DAY_WEIGHTS[j]!] as [number, number]));
  const day = DAYS[dayIndex]!;
  const hour = String(Math.floor(between(0, 24))).padStart(2, "0");
  const minute = String(Math.floor(between(0, 60))).padStart(2, "0");
  const second = String(Math.floor(between(0, 60))).padStart(2, "0");
  const ms = String(Math.floor(between(0, 1000))).padStart(3, "0");
  const date = `${day}T${hour}:${minute}:${second}.${ms}Z`;

  const user = pick(USERS);
  const [model, , costMul] = pick(
    MODELS.map((m) => [m, m[1]] as [(typeof MODELS)[number], number]),
  );

  const errored = rand() < 0.015;
  const kind = errored ? "Errored, No Charge" : "On-Demand";
  const maxMode = rand() < 0.97 ? "Yes" : "No";

  const isAgent = rand() < 0.06;
  const cloudAgentId = isAgent ? `bc-${uuid()}` : "";
  const automationId = isAgent && rand() < 0.5 ? uuid() : "";

  // Heavy tail: a few large sessions dominate cost, like real usage.
  const scale = rand() < 0.08 ? between(8, 30) : between(0.2, 4);
  const cacheRead = Math.floor(scale * between(200_000, 900_000));
  const inputWithCacheWrite = rand() < 0.4 ? Math.floor(scale * between(1_000, 60_000)) : 0;
  const inputWithoutCacheWrite = Math.floor(scale * between(500, 40_000));
  const outputTokens = Math.floor(scale * between(500, 6_000));
  const totalTokens = inputWithCacheWrite + inputWithoutCacheWrite + cacheRead + outputTokens;

  const cost = errored ? 0 : (totalTokens / 1_000_000) * costMul * between(0.8, 1.6);

  rows.push(
    [
      date,
      user,
      cloudAgentId,
      automationId,
      kind,
      model,
      maxMode,
      inputWithCacheWrite,
      inputWithoutCacheWrite,
      cacheRead,
      outputTokens,
      totalTokens,
      cost.toFixed(2),
    ]
      .map((v) => `"${v}"`)
      .join(","),
  );
}

console.log(rows.join("\n"));
