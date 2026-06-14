import { describe, expect, test } from "bun:test";

import { parseCsv, parseUsageCsv } from "../src/core/parse.ts";

const HEADER =
  "Date,User,Cloud Agent ID,Automation ID,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost";

describe("parseCsv", () => {
  test("parses quoted fields with commas and escaped quotes", () => {
    const rows = parseCsv('a,"b,c","d""e"\n1,2,3');
    expect(rows).toEqual([
      ["a", "b,c", 'd"e'],
      ["1", "2", "3"],
    ]);
  });

  test("handles CRLF and trailing newline", () => {
    const rows = parseCsv("a,b\r\nc,d\r\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("parseUsageCsv", () => {
  test("parses a usage event row", () => {
    const csv = [
      HEADER,
      '"2026-06-10T14:19:26.869Z","j@example.com","bc-123","auto-1","On-Demand","composer-2.5","Yes","0","21174","98521","3728","123423","0.07"',
    ].join("\n");
    const events = parseUsageCsv(csv);
    expect(events).toHaveLength(1);
    const e = events[0]!;
    expect(e.user).toBe("j@example.com");
    expect(e.cloudAgentId).toBe("bc-123");
    expect(e.automationId).toBe("auto-1");
    expect(e.kind).toBe("On-Demand");
    expect(e.model).toBe("composer-2.5");
    expect(e.maxMode).toBe(true);
    expect(e.inputWithCacheWrite).toBe(0);
    expect(e.inputWithoutCacheWrite).toBe(21174);
    expect(e.cacheRead).toBe(98521);
    expect(e.outputTokens).toBe(3728);
    expect(e.totalTokens).toBe(123423);
    expect(e.cost).toBeCloseTo(0.07);
    expect(e.date.toISOString()).toBe("2026-06-10T14:19:26.869Z");
  });

  test("empty agent/automation ids become null", () => {
    const csv = [
      HEADER,
      '"2026-06-10T12:55:01.730Z","j@example.com","","","On-Demand","gpt-5.5-medium","No","1615","2","187200","1506","190323","0.33"',
    ].join("\n");
    const e = parseUsageCsv(csv)[0]!;
    expect(e.cloudAgentId).toBeNull();
    expect(e.automationId).toBeNull();
    expect(e.maxMode).toBe(false);
  });

  test("throws on a non-usage CSV", () => {
    expect(() => parseUsageCsv("foo,bar\n1,2")).toThrow(/missing column/);
  });

  test("returns empty array for empty input", () => {
    expect(parseUsageCsv("")).toEqual([]);
  });

  test("skips rows with invalid dates", () => {
    const csv = [
      HEADER,
      '"not-a-date","j@example.com","","","On-Demand","m","No","0","0","0","0","0","0.01"',
    ].join("\n");
    expect(parseUsageCsv(csv)).toEqual([]);
  });
});
