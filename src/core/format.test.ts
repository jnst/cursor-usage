import { describe, expect, it } from "bun:test";

import {
  formatDailyWindowAxis,
  formatDailyWindowRange,
  formatDateTime,
  formatMetric,
  formatTime,
  formatTokens,
  formatUsd,
  formatUsdPerMTok,
} from "./format.ts";

describe("formatUsd", () => {
  it("keeps cents by default", () => {
    expect(formatUsd(0.07)).toBe("$0.07");
    expect(formatUsd(180)).toBe("$180.00");
    expect(formatUsd(0)).toBe("$0.00");
  });

  it("can drop trailing zero cents for axis labels", () => {
    expect(formatUsd(180, { trimZeroCents: true })).toBe("$180");
    expect(formatUsd(180.5, { trimZeroCents: true })).toBe("$180.50");
    expect(formatUsd(0, { trimZeroCents: true })).toBe("$0");
  });
});

describe("formatTokens", () => {
  it("uses compact suffixes for dense labels", () => {
    expect(formatTokens(1_500_000_000)).toBe("1.5B");
    expect(formatTokens(1_000_000)).toBe("1.0M");
    expect(formatTokens(1500)).toBe("1.5K");
    expect(formatTokens(999)).toBe("999");
    expect(formatTokens(0)).toBe("0");
  });
});

describe("formatUsdPerMTok", () => {
  it("formats cost per million tokens", () => {
    expect(formatUsdPerMTok(2, 1_000_000)).toBe("$2.00 / MTok");
    expect(formatUsdPerMTok(0, 500_000)).toBe("$0.00 / MTok");
  });

  it("returns an em dash when token count is 0", () => {
    expect(formatUsdPerMTok(1.5, 0)).toBe("—");
  });
});

describe("formatMetric", () => {
  it("formats Cost as USD and Token Count compactly", () => {
    expect(formatMetric(12.5, "cost")).toBe("$12.50");
    expect(formatMetric(1_500_000, "tokens")).toBe("1.5M");
  });
});

describe("formatDailyWindowAxis", () => {
  it("drops leading zeros and names the Japanese weekday", () => {
    expect(formatDailyWindowAxis("2026-08-14")).toEqual({ date: "8/14", weekday: "金" });
    expect(formatDailyWindowAxis("2026-01-01")).toEqual({ date: "1/1", weekday: "木" });
  });
});

describe("formatDailyWindowRange", () => {
  it("uses compact month/day bounds without year", () => {
    expect(formatDailyWindowRange("2026-07-29", "2026-08-24")).toBe("7/29 - 8/24");
    expect(formatDailyWindowRange("2026-08-14", "2026-08-14")).toBe("8/14");
  });
});

describe("formatDateTime", () => {
  const date = new Date("2026-06-05T23:59:59Z");

  it("renders the local calendar date and clock time", () => {
    expect(formatDateTime(date, "UTC")).toBe("2026-06-05 23:59");
    expect(formatDateTime(date, "Asia/Tokyo")).toBe("2026-06-06 08:59");
  });
});

describe("formatTime", () => {
  const date = new Date("2026-06-05T23:59:59Z");

  it("renders only the local clock time", () => {
    expect(formatTime(date, "UTC")).toBe("23:59:59");
    expect(formatTime(date, "Asia/Tokyo")).toBe("08:59:59");
  });
});
