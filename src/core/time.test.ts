import type { UsageEvent } from "./types.ts";

import { describe, expect, it } from "bun:test";

import {
  dailyWindowKeyOf,
  dailyWindowKeysInRange,
  eventsInDailyWindow,
  hourOf,
  isValidDailyWindowKey,
  isValidStartHour,
  isValidTimeZone,
  latestDailyWindowKey,
  orderedHours,
  resolveAnalysisContext,
} from "./time.ts";

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

describe("Daily Window calendar", () => {
  const billable = events.filter((e) => e.kind !== "Errored, No Charge");

  it("eventsInDailyWindow filters to a single UTC daily window", () => {
    const dailyWindow = eventsInDailyWindow(billable, "2026-06-05");
    expect(dailyWindow).toHaveLength(2);
    expect(dailyWindow.every((e) => e.date.toISOString().startsWith("2026-06-05"))).toBe(true);
  });

  it("daily window and hour can be grouped in an analysis time zone", () => {
    const lateUtc = event({ date: new Date("2026-06-05T23:59:59Z") });

    expect(dailyWindowKeyOf(lateUtc.date)).toBe("2026-06-05");
    expect(hourOf(lateUtc.date)).toBe("23");
    expect(dailyWindowKeyOf(lateUtc.date, { timeZone: "Asia/Tokyo" })).toBe("2026-06-06");
    expect(hourOf(lateUtc.date, { timeZone: "Asia/Tokyo" })).toBe("08");
  });

  it("eventsInDailyWindow uses the selected analysis time zone", () => {
    const tokyoDailyWindow = eventsInDailyWindow(billable, "2026-06-06", {
      timeZone: "Asia/Tokyo",
    });
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

describe("resolveAnalysisContext", () => {
  it("fills omitted fields with UTC and a midnight start hour", () => {
    expect(resolveAnalysisContext()).toEqual({ timeZone: "UTC", startHour: 0 });
    expect(resolveAnalysisContext({ timeZone: "Asia/Tokyo" })).toEqual({
      timeZone: "Asia/Tokyo",
      startHour: 0,
    });
    expect(resolveAnalysisContext({ startHour: 5 })).toEqual({ timeZone: "UTC", startHour: 5 });
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects unknown identifiers", () => {
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Asia/Tokyo")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("isValidStartHour", () => {
  it("accepts integer clock hours only", () => {
    expect(isValidStartHour(0)).toBe(true);
    expect(isValidStartHour(23)).toBe(true);
    expect(isValidStartHour(-1)).toBe(false);
    expect(isValidStartHour(24)).toBe(false);
    expect(isValidStartHour(5.5)).toBe(false);
    expect(isValidStartHour(Number.NaN)).toBe(false);
  });
});

describe("isValidDailyWindowKey", () => {
  it("accepts YYYY-MM-DD and rejects other shapes", () => {
    expect(isValidDailyWindowKey("2026-06-05")).toBe(true);
    expect(isValidDailyWindowKey("2026-6-5")).toBe(false);
    expect(isValidDailyWindowKey("2026-06-05T00:00:00Z")).toBe(false);
    expect(isValidDailyWindowKey("")).toBe(false);
  });

  it("checks the key shape only, not calendar validity", () => {
    expect(isValidDailyWindowKey("2026-13-40")).toBe(true);
  });
});

describe("orderedHours", () => {
  it("starts at midnight by default and wraps a full clock", () => {
    expect(orderedHours()).toHaveLength(24);
    expect(orderedHours()[0]).toBe("00");
    expect(orderedHours().at(-1)).toBe("23");
  });

  it("throws on an invalid start hour", () => {
    expect(() => orderedHours({ startHour: 24 })).toThrow(/Invalid Daily Window start hour: 24/);
    expect(() => orderedHours({ startHour: -1 })).toThrow(/Invalid Daily Window start hour: -1/);
  });
});

describe("dailyWindowKeysInRange", () => {
  it("includes empty calendar days between the first and last key", () => {
    expect(dailyWindowKeysInRange("2026-08-01", "2026-08-03")).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ]);
  });

  it("returns an empty list when last is before first", () => {
    expect(dailyWindowKeysInRange("2026-08-03", "2026-08-01")).toEqual([]);
  });
});

describe("dailyWindowKeyOf", () => {
  it("throws on an invalid start hour", () => {
    expect(() => dailyWindowKeyOf(new Date("2026-06-05T10:00:00Z"), { startHour: 24 })).toThrow(
      /Invalid Daily Window start hour: 24/,
    );
  });
});

describe("latestDailyWindowKey", () => {
  it("returns null for an empty analysis set", () => {
    expect(latestDailyWindowKey([])).toBeNull();
  });
});
