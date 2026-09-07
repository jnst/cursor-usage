import type { UsageEvent } from "./types.ts";

import { expect, test } from "bun:test";

import { statsJson, dailyWindowViewJson, renderStats } from "../cli/render.ts";
import { analyzeCloudAgents } from "./cloud-agent.ts";
import { eventsInDailyWindow } from "./time.ts";

const ctx = { timeZone: "UTC", startHour: 0 };
function event(
  cloudAgentId: string | null,
  cost: number,
  overrides: Partial<UsageEvent> = {},
): UsageEvent {
  return {
    cloudAgentId,
    cost,
    date: new Date("2026-06-04T10:00:00Z"),
    user: "alice",
    automationId: null,
    kind: "On-Demand",
    model: "gpt-5.5",
    maxMode: false,
    inputWithCacheWrite: 0,
    inputWithoutCacheWrite: 10,
    cacheRead: 0,
    outputTokens: 10,
    totalTokens: 20,
    ...overrides,
  };
}
test("groups repeated IDs across users and dates, excluding missing IDs and No Charge", () => {
  const rows = [
    event(" shared ", 2),
    event("shared", 4, { user: "bob", date: new Date("2026-06-05T10:00:00Z"), model: "opus" }),
    event("zero", 0),
    event(null, 100),
    event("  ", 100),
    event("shared", 100, { kind: "Errored, No Charge" }),
  ];
  const result = analyzeCloudAgents(rows);
  expect(result.summary).toEqual({
    agentCount: 2,
    totalCost: 6,
    totalTokens: 60,
    eventCount: 3,
    meanCost: 3,
    medianCost: 3,
    maxCost: 6,
    top10CostShare: 100,
  });
  expect(result.agents[0]).toMatchObject({
    key: "shared",
    cost: 6,
    eventCount: 2,
    users: ["alice", "bob"],
    firstObserved: "2026-06-04T10:00:00.000Z",
    lastObserved: "2026-06-05T10:00:00.000Z",
  });
  expect(result.agents[0]!.models).toHaveLength(2);
  expect(result.byUser).toEqual([
    { key: "alice", agentCount: 2 },
    { key: "bob", agentCount: 1 },
  ]);
  expect(analyzeCloudAgents(eventsInDailyWindow(rows, "2026-06-05", ctx)).summary.totalCost).toBe(
    4,
  );
});
test("median, top ten concentration, ties and empty input have defined results", () => {
  const rows = Array.from({ length: 11 }, (_, i) => event(String(i).padStart(2, "0"), i));
  expect(analyzeCloudAgents(rows).summary.medianCost).toBe(5);
  expect(
    analyzeCloudAgents(rows.map((row) => ({ ...row, cost: 1 }))).summary.top10CostShare,
  ).toBeCloseTo(1000 / 11);
  expect(analyzeCloudAgents([event("b", 1), event("a", 1)]).agents.map((a) => a.key)).toEqual([
    "a",
    "b",
  ]);
  expect(analyzeCloudAgents([]).summary).toEqual({
    agentCount: 0,
    totalCost: 0,
    totalTokens: 0,
    eventCount: 0,
    meanCost: 0,
    medianCost: 0,
    maxCost: 0,
    top10CostShare: 0,
  });
});
test("CLI JSON and terminal expose the same scoped analysis", () => {
  const rows = [event("one", 2), event("one", 5, { date: new Date("2026-06-05T10:00:00Z") })];
  expect(JSON.parse(statsJson(rows, ctx)).cloudAgentAnalysis.summary.totalCost).toBe(7);
  expect(
    JSON.parse(dailyWindowViewJson(rows, "2026-06-05", ctx)).cloudAgentAnalysis.summary.totalCost,
  ).toBe(5);
  expect(renderStats(rows, "cloud-agent", ctx)).toContain("1 IDs · 2 events");
});
