import type { UsageEvent } from "./types.ts";

import { describe, expect, it } from "bun:test";

import {
  billable,
  byDailyWindow,
  byDailyWindowAndModelFamily,
  byHour,
  byKind,
  byModel,
  byModelFamily,
  byUser,
  eventsInModelFamily,
  filterEvents,
  summarize,
  topEvents,
} from "./aggregate.ts";
import { eventsInDailyWindow } from "./time.ts";

function event(overrides: Partial<UsageEvent>): UsageEvent {
  return {
    date: new Date("2026-06-04T10:00:00Z"),
    user: "a@example.com",
    cloudAgentId: null,
    automationId: null,
    kind: "On-Demand",
    model: "gpt-5.5-medium",
    maxMode: false,
    inputWithCacheWrite: 100,
    inputWithoutCacheWrite: 200,
    cacheRead: 1000,
    outputTokens: 50,
    totalTokens: 1350,
    cost: 0.1,
    ...overrides,
  };
}

const events: UsageEvent[] = [
  event({ cost: 0.1, maxMode: true }),
  event({
    date: new Date("2026-06-05T10:00:00Z"),
    model: "claude-opus",
    user: "b@example.com",
    cost: 0.4,
  }),
  event({
    date: new Date("2026-06-05T23:59:59Z"),
    cost: 0.2,
  }),
  event({ kind: "Errored, No Charge", cost: 0 }),
];

describe("billable", () => {
  it("filters out no-charge events", () => {
    expect(billable(events)).toHaveLength(3);
  });
});

describe("filterEvents", () => {
  it("keeps billable events by default and can narrow by user and family", () => {
    expect(filterEvents(events)).toHaveLength(3);
    expect(filterEvents(events, { includeNoCharge: true })).toHaveLength(4);
    expect(filterEvents(events, { user: "b@example.com" }).map((e) => e.user)).toEqual([
      "b@example.com",
    ]);
    expect(
      filterEvents(events, { modelFamily: "GPT-5.5" }).every((e) => e.model.startsWith("gpt-5.5")),
    ).toBe(true);
  });

  it("combines user and model-family filters", () => {
    const filtered = filterEvents(events, { user: "a@example.com", modelFamily: "GPT-5.5" });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.user === "a@example.com")).toBe(true);
  });

  it("keeps a user's no-charge events when includeNoCharge is set", () => {
    const filtered = filterEvents(events, { user: "a@example.com", includeNoCharge: true });
    expect(filtered).toHaveLength(3);
    expect(filtered.some((e) => e.kind === "Errored, No Charge")).toBe(true);
  });

  it("returns an empty set for an unknown user", () => {
    expect(filterEvents(events, { user: "nobody@example.com" })).toEqual([]);
  });
});

describe("summarize", () => {
  it("computes totals over billable events", () => {
    const s = summarize(billable(events));
    expect(s.totalCost).toBeCloseTo(0.7);
    expect(s.eventCount).toBe(3);
    expect(s.firstDailyWindow).toBe("2026-06-04");
    expect(s.lastDailyWindow).toBe("2026-06-05");
    expect(s.dailyWindowCount).toBe(2);
    expect(s.avgCostPerActiveDailyWindow).toBeCloseTo(0.35);
    expect(s.maxModeRatio).toBeCloseTo(1 / 3);
    expect(s.userCount).toBe(2);
    expect(s.modelCount).toBe(2);
  });

  it("handles empty input", () => {
    const s = summarize([]);
    expect(s.totalCost).toBe(0);
    expect(s.firstDailyWindow).toBeNull();
    expect(s.avgCostPerActiveDailyWindow).toBe(0);
  });

  it("groups Daily Windows in the selected analysis time zone", () => {
    const lateUtc = event({ date: new Date("2026-06-05T23:59:59Z") });
    const s = summarize([lateUtc], { timeZone: "Asia/Tokyo" });
    expect(s.firstDailyWindow).toBe("2026-06-06");
    expect(s.lastDailyWindow).toBe("2026-06-06");
    expect(s.dailyWindowCount).toBe(1);
  });
});

describe("buckets", () => {
  const b = billable(events);

  it("byDailyWindow is chronological", () => {
    const dailyWindows = byDailyWindow(b);
    expect(dailyWindows.map((d) => d.key)).toEqual(["2026-06-04", "2026-06-05"]);
    expect(dailyWindows[1]!.cost).toBeCloseTo(0.6);
    expect(dailyWindows[1]!.eventCount).toBe(2);
  });

  it("byUser is sorted by cost desc", () => {
    const users = byUser(b);
    expect(users[0]!.key).toBe("b@example.com");
    expect(users[0]!.cost).toBeCloseTo(0.4);
  });

  it("byUser can sort by tokens", () => {
    const cheapVolume = event({ user: "volume@example.com", cost: 0.01, totalTokens: 50_000 });
    const users = byUser([cheapVolume, ...b], "tokens");
    expect(users[0]!.key).toBe("volume@example.com");
  });

  it("byModel aggregates tokens", () => {
    const models = byModel(b);
    expect(models[0]!.key).toBe("claude-opus");
    const gpt = models.find((m) => m.key === "gpt-5.5-medium")!;
    expect(gpt.inputTokens).toBe(600);
    expect(gpt.outputTokens).toBe(100);
  });

  it("byKind is sorted by cost desc", () => {
    const kinds = byKind([
      event({ kind: "Low Cost", cost: 0.1 }),
      event({ kind: "High Cost", cost: 0.4 }),
      event({ kind: "Low Cost", cost: 0.1 }),
    ]);
    expect(kinds.map((k) => k.key)).toEqual(["High Cost", "Low Cost"]);
  });

  it("byKind can sort by tokens", () => {
    const kinds = byKind(
      [
        event({ kind: "Cheap Volume", cost: 0.01, totalTokens: 50_000 }),
        event({ kind: "Expensive", cost: 0.4, totalTokens: 10 }),
      ],
      "tokens",
    );
    expect(kinds.map((k) => k.key)).toEqual(["Cheap Volume", "Expensive"]);
  });

  it("byModelFamily collapses variants and Auto routing into families", () => {
    const families = byModelFamily([
      event({ model: "claude-fable-5-thinking-high", cost: 0.3 }),
      event({ model: "claude-fable-5-high", cost: 0.2 }),
      event({ model: "Opus 5 (Auto Balanced)", cost: 0.4 }),
      event({ model: "Cursor Grok 4.5 (Auto Intelligence)", cost: 0.3 }),
    ]);
    expect(families.map((f) => f.key)).toEqual(["Auto", "Fable 5"]);
    expect(families[0]!.cost).toBeCloseTo(0.7);
    expect(families[1]!.eventCount).toBe(2);
  });

  it("eventsInModelFamily keeps the Models routed by Auto visible", () => {
    const routed = eventsInModelFamily(
      [
        event({ model: "Opus 5 (Auto Balanced)" }),
        event({ model: "Cursor Grok 4.5 (Auto Intelligence)" }),
        event({ model: "claude-fable-5-thinking-high" }),
      ],
      "Auto",
    );
    expect(routed.map((e) => e.model)).toEqual([
      "Opus 5 (Auto Balanced)",
      "Cursor Grok 4.5 (Auto Intelligence)",
    ]);
  });

  it("byDailyWindowAndModelFamily stacks costs and tokens by family", () => {
    const stacked = byDailyWindowAndModelFamily([
      event({ model: "claude-fable-5-thinking-high", cost: 0.25, totalTokens: 100 }),
      event({ model: "claude-fable-5-high", cost: 0.25, totalTokens: 200 }),
      event({ model: "Opus 5 (Auto Balanced)", cost: 0.5, totalTokens: 50 }),
    ]);
    expect(stacked[0]!.costByKey).toEqual({ "Fable 5": 0.5, Auto: 0.5 });
    expect(stacked[0]!.tokensByKey).toEqual({ "Fable 5": 300, Auto: 50 });
    expect(stacked[0]!.totalCost).toBeCloseTo(1.0);
    expect(stacked[0]!.totalTokens).toBe(350);
  });

  it("topEvents returns most expensive first", () => {
    const top = topEvents(b, 2);
    expect(top.map((e) => e.cost)).toEqual([0.4, 0.2]);
  });

  it("topEvents can sort by tokens", () => {
    const cheapVolume = event({ cost: 0.01, totalTokens: 50_000 });
    const top = topEvents([cheapVolume, ...b], 1, "tokens");
    expect(top[0]!.totalTokens).toBe(50_000);
  });

  it("byHour buckets by UTC hour, chronological", () => {
    const hours = byHour(eventsInDailyWindow(b, "2026-06-05"));
    expect(hours.map((h) => h.key)).toEqual(["10", "23"]);
    expect(hours[0]!.cost).toBeCloseTo(0.4);
    expect(hours[1]!.cost).toBeCloseTo(0.2);
  });

  it("byDailyWindow uses the selected analysis time zone and start hour", () => {
    const earlyTokyo = event({ date: new Date("2026-06-05T19:30:00Z"), cost: 0.1 });
    const morningTokyo = event({ date: new Date("2026-06-05T20:30:00Z"), cost: 0.2 });
    const ctx = { timeZone: "Asia/Tokyo", startHour: 5 };
    const dailyWindows = byDailyWindow([earlyTokyo, morningTokyo], ctx);
    expect(dailyWindows.map((d) => d.key)).toEqual(["2026-06-05", "2026-06-06"]);
    expect(dailyWindows[0]!.cost).toBeCloseTo(0.1);
    expect(dailyWindows[1]!.cost).toBeCloseTo(0.2);
  });

  it("byHour uses the selected analysis time zone", () => {
    const lateUtc = event({ date: new Date("2026-06-05T23:59:59Z") });
    expect(byHour([lateUtc], { timeZone: "Asia/Tokyo" }).map((h) => h.key)).toEqual(["08"]);
  });

  it("topEvents returns the full set when the limit exceeds the length", () => {
    expect(topEvents(b, 10)).toHaveLength(3);
    expect(topEvents([], 5)).toEqual([]);
  });
});
