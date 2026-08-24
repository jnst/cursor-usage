import type { AnalysisContext, UsageEvent } from "../src/core/types.ts";

import { describe, expect, it } from "bun:test";

import { renderDailyWindowView, renderStats, statsJson } from "../src/cli/render.ts";

function event(overrides: Partial<UsageEvent>): UsageEvent {
  return {
    date: new Date("2026-06-04T10:00:00Z"),
    user: "alice@example.com",
    cloudAgentId: null,
    automationId: null,
    kind: "On-Demand",
    model: "gpt-expensive",
    maxMode: false,
    inputWithCacheWrite: 100,
    inputWithoutCacheWrite: 200,
    cacheRead: 1000,
    outputTokens: 50,
    totalTokens: 100,
    cost: 10,
    ...overrides,
  };
}

const ctx: AnalysisContext = { timeZone: "UTC", startHour: 0 };

const events: UsageEvent[] = [
  event({
    user: "alice@example.com",
    model: "gpt-expensive",
    cost: 10,
    totalTokens: 100,
  }),
  event({
    date: new Date("2026-06-05T10:00:00Z"),
    user: "bob@example.com",
    model: "gpt-cheap",
    cost: 1,
    totalTokens: 50_000,
  }),
];

describe("CLI Selected Metric", () => {
  it("uses Token Count as the summary primary value and ranks Users by tokens", () => {
    const text = renderStats(events, "user", ctx, undefined, undefined, "tokens");
    expect(text).toContain("metric tokens");
    expect(text.indexOf("Total Tokens")).toBeGreaterThan(-1);
    expect(text.indexOf("Total Tokens")).toBeLessThan(text.indexOf("Total Cost"));
    expect(text.indexOf("bob@example.com")).toBeLessThan(text.indexOf("alice@example.com"));
  });

  it("keeps Cost as the default ranking", () => {
    const text = renderStats(events, "user", ctx);
    expect(text).toContain("metric cost");
    expect(text.indexOf("alice@example.com")).toBeLessThan(text.indexOf("bob@example.com"));
  });

  it("includes the Selected Metric in JSON and sorts breakdowns by it", () => {
    const parsed = JSON.parse(statsJson(events, ctx, undefined, undefined, "tokens")) as {
      metric: string;
      byUser: { key: string }[];
      byModel: { key: string }[];
    };
    expect(parsed.metric).toBe("tokens");
    expect(parsed.byUser.map((row) => row.key)).toEqual(["bob@example.com", "alice@example.com"]);
    expect(parsed.byModel.map((row) => row.key)).toEqual(["gpt-cheap", "gpt-expensive"]);
  });

  it("ranks Daily Windows by the Selected Metric", () => {
    const byCost = renderDailyWindowView(events, "2026-06-04", ctx, undefined, undefined, "cost");
    const byTokens = renderDailyWindowView(
      events,
      "2026-06-04",
      ctx,
      undefined,
      undefined,
      "tokens",
    );
    expect(byCost).toContain("rank 1/2 by cost");
    expect(byTokens).toContain("rank 2/2 by tokens");
    expect(byTokens).toContain("Effective");
  });
});
