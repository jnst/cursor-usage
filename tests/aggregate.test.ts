import { describe, expect, test } from "bun:test";
import {
  billable,
  byDay,
  byDayAndModel,
  byHour,
  byKind,
  byModel,
  byUser,
  dayOf,
  hourOf,
  onDay,
  summarize,
  topEvents,
} from "../src/core/aggregate.ts";
import type { UsageEvent } from "../src/core/types.ts";

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
  test("filters out no-charge events", () => {
    expect(billable(events)).toHaveLength(3);
  });
});

describe("summarize", () => {
  test("computes totals over billable events", () => {
    const s = summarize(billable(events));
    expect(s.totalCost).toBeCloseTo(0.7);
    expect(s.eventCount).toBe(3);
    expect(s.firstDay).toBe("2026-06-04");
    expect(s.lastDay).toBe("2026-06-05");
    expect(s.dayCount).toBe(2);
    expect(s.avgCostPerActiveDay).toBeCloseTo(0.35);
    expect(s.maxModeRatio).toBeCloseTo(1 / 3);
    expect(s.userCount).toBe(2);
    expect(s.modelCount).toBe(2);
  });

  test("handles empty input", () => {
    const s = summarize([]);
    expect(s.totalCost).toBe(0);
    expect(s.firstDay).toBeNull();
    expect(s.avgCostPerActiveDay).toBe(0);
  });
});

describe("buckets", () => {
  const b = billable(events);

  test("byDay is chronological", () => {
    const days = byDay(b);
    expect(days.map((d) => d.key)).toEqual(["2026-06-04", "2026-06-05"]);
    expect(days[1]!.cost).toBeCloseTo(0.6);
    expect(days[1]!.eventCount).toBe(2);
  });

  test("byUser is sorted by cost desc", () => {
    const users = byUser(b);
    expect(users[0]!.key).toBe("b@example.com");
    expect(users[0]!.cost).toBeCloseTo(0.4);
  });

  test("byModel aggregates tokens", () => {
    const models = byModel(b);
    expect(models[0]!.key).toBe("claude-opus");
    const gpt = models.find((m) => m.key === "gpt-5.5-medium")!;
    expect(gpt.inputTokens).toBe(600);
    expect(gpt.outputTokens).toBe(100);
  });

  test("byKind is sorted by cost desc", () => {
    const kinds = byKind([
      event({ kind: "Low Cost", cost: 0.1 }),
      event({ kind: "High Cost", cost: 0.4 }),
      event({ kind: "Low Cost", cost: 0.1 }),
    ]);
    expect(kinds.map((k) => k.key)).toEqual(["High Cost", "Low Cost"]);
  });

  test("byDayAndModel builds stacked data", () => {
    const stacked = byDayAndModel(b);
    expect(stacked[1]!.costByModel).toEqual({
      "claude-opus": 0.4,
      "gpt-5.5-medium": 0.2,
    });
    expect(stacked[1]!.totalCost).toBeCloseTo(0.6);
  });

  test("topEvents returns most expensive first", () => {
    const top = topEvents(b, 2);
    expect(top.map((e) => e.cost)).toEqual([0.4, 0.2]);
  });

  test("onDay filters to a single UTC day", () => {
    const day = onDay(b, "2026-06-05");
    expect(day).toHaveLength(2);
    expect(day.every((e) => e.date.toISOString().startsWith("2026-06-05"))).toBe(
      true,
    );
  });

  test("byHour buckets by UTC hour, chronological", () => {
    const hours = byHour(onDay(b, "2026-06-05"));
    expect(hours.map((h) => h.key)).toEqual(["10", "23"]);
    expect(hours[0]!.cost).toBeCloseTo(0.4);
    expect(hours[1]!.cost).toBeCloseTo(0.2);
  });

  test("day and hour can be grouped in an analysis time zone", () => {
    const lateUtc = event({ date: new Date("2026-06-05T23:59:59Z") });

    expect(dayOf(lateUtc.date)).toBe("2026-06-05");
    expect(hourOf(lateUtc.date)).toBe("23");
    expect(dayOf(lateUtc.date, "Asia/Tokyo")).toBe("2026-06-06");
    expect(hourOf(lateUtc.date, "Asia/Tokyo")).toBe("08");
  });

  test("onDay uses the selected analysis time zone", () => {
    const tokyoDay = onDay(b, "2026-06-06", "Asia/Tokyo");
    expect(tokyoDay).toHaveLength(1);
    expect(tokyoDay[0]!.date.toISOString()).toBe("2026-06-05T23:59:59.000Z");
  });
});
