import type { AnalysisContext, UsageEvent } from "../src/core/types.ts";

import { describe, expect, it } from "bun:test";

import {
  dailyWindowViewJson,
  renderDailyWindowView,
  renderStats,
  statsJson,
} from "../src/cli/render.ts";

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

describe("CLI Effective Rate ranking", () => {
  it("supports explicit user order in terminal and both JSON views", () => {
    const text = renderStats(
      events,
      "user-effective-rate",
      ctx,
      undefined,
      undefined,
      "cost",
      "desc",
    );
    expect(text).toContain("highest first");
    expect(text.indexOf("alice@example.com")).toBeLessThan(text.indexOf("bob@example.com"));
    const overview = JSON.parse(statsJson(events, ctx, undefined, undefined, "cost", "asc"));
    expect(overview.byUser[0].key).toBe("bob@example.com");
    const sameDay = events.map((e) => ({ ...e, date: events[0]!.date }));
    const daily = JSON.parse(
      dailyWindowViewJson(sameDay, "2026-06-04", ctx, undefined, undefined, "cost", "desc"),
    );
    expect(daily.topUsersByEffectiveRate[0].key).toBe("alice@example.com");
    expect(daily.userRankingOrder.effectiveRate).toBe("desc");
  });
  it("renders lowest rates first with cost and token totals", () => {
    const text = renderStats(events, "user-effective-rate", ctx);
    expect(text).toContain("Top 10, lowest first");
    expect(text.indexOf("bob@example.com")).toBeLessThan(text.indexOf("alice@example.com"));
    expect(text).toContain("$20.00 / MTok");
    expect(text).toContain("50.0K tokens");
  });
  it("includes the same ranking in overview and Daily Window JSON", () => {
    const overview = JSON.parse(statsJson(events, ctx));
    expect(overview.topUsersByEffectiveRate.map((r: { key: string }) => r.key)).toEqual([
      "bob@example.com",
      "alice@example.com",
    ]);
    const daily = JSON.parse(dailyWindowViewJson(events, "2026-06-04", ctx));
    expect(daily.topUsersByEffectiveRate.map((r: { key: string }) => r.key)).toEqual([
      "alice@example.com",
    ]);
  });
});
