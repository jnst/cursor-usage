import type { UsageEvent } from "../src/core/types.ts";

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
} from "../src/core/aggregate.ts";
import {
  dailyWindowKeyOf,
  eventsInDailyWindow,
  hourOf,
  latestDailyWindowKey,
  orderedHours,
} from "../src/core/time.ts";

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

  it("byDailyWindowAndModelFamily stacks costs by family", () => {
    const stacked = byDailyWindowAndModelFamily([
      event({ model: "claude-fable-5-thinking-high", cost: 0.25 }),
      event({ model: "claude-fable-5-high", cost: 0.25 }),
      event({ model: "Opus 5 (Auto Balanced)", cost: 0.5 }),
    ]);
    expect(stacked[0]!.costByKey).toEqual({ "Fable 5": 0.5, Auto: 0.5 });
    expect(stacked[0]!.totalCost).toBeCloseTo(1.0);
  });

  it("topEvents returns most expensive first", () => {
    const top = topEvents(b, 2);
    expect(top.map((e) => e.cost)).toEqual([0.4, 0.2]);
  });

  it("eventsInDailyWindow filters to a single UTC daily window", () => {
    const dailyWindow = eventsInDailyWindow(b, "2026-06-05");
    expect(dailyWindow).toHaveLength(2);
    expect(dailyWindow.every((e) => e.date.toISOString().startsWith("2026-06-05"))).toBe(true);
  });

  it("byHour buckets by UTC hour, chronological", () => {
    const hours = byHour(eventsInDailyWindow(b, "2026-06-05"));
    expect(hours.map((h) => h.key)).toEqual(["10", "23"]);
    expect(hours[0]!.cost).toBeCloseTo(0.4);
    expect(hours[1]!.cost).toBeCloseTo(0.2);
  });

  it("daily window and hour can be grouped in an analysis time zone", () => {
    const lateUtc = event({ date: new Date("2026-06-05T23:59:59Z") });

    expect(dailyWindowKeyOf(lateUtc.date)).toBe("2026-06-05");
    expect(hourOf(lateUtc.date)).toBe("23");
    expect(dailyWindowKeyOf(lateUtc.date, { timeZone: "Asia/Tokyo" })).toBe("2026-06-06");
    expect(hourOf(lateUtc.date, { timeZone: "Asia/Tokyo" })).toBe("08");
  });

  it("eventsInDailyWindow uses the selected analysis time zone", () => {
    const tokyoDailyWindow = eventsInDailyWindow(b, "2026-06-06", { timeZone: "Asia/Tokyo" });
    expect(tokyoDailyWindow).toHaveLength(1);
    expect(tokyoDailyWindow[0]!.date.toISOString()).toBe("2026-06-05T23:59:59.000Z");
  });

  it("daily windows can start after midnight", () => {
    const earlyTokyo = event({ date: new Date("2026-06-05T19:30:00Z") }); // 04:30 JST
    const morningTokyo = event({ date: new Date("2026-06-05T20:30:00Z") }); // 05:30 JST

    expect(dailyWindowKeyOf(earlyTokyo.date, { timeZone: "Asia/Tokyo", startHour: 5 })).toBe(
      "2026-06-05",
    );
    expect(dailyWindowKeyOf(morningTokyo.date, { timeZone: "Asia/Tokyo", startHour: 5 })).toBe(
      "2026-06-06",
    );
    expect(
      latestDailyWindowKey([earlyTokyo, morningTokyo], { timeZone: "Asia/Tokyo", startHour: 5 }),
    ).toBe("2026-06-06");
    expect(orderedHours({ startHour: 5 }).slice(0, 5)).toEqual(["05", "06", "07", "08", "09"]);
    expect(orderedHours({ startHour: 5 }).slice(-5)).toEqual(["00", "01", "02", "03", "04"]);
  });
});
