import { describe, expect, it } from "bun:test";

import { parseCsv, parseUsageCsv } from "./parse.ts";

const HEADER =
  "Date,User,Cloud Agent ID,Automation ID,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost";

describe("parseCsv", () => {
  it("parses quoted fields with commas and escaped quotes", () => {
    const rows = parseCsv('a,"b,c","d""e"\n1,2,3');
    expect(rows).toEqual([
      ["a", "b,c", 'd"e'],
      ["1", "2", "3"],
    ]);
  });

  it("handles CRLF and trailing newline", () => {
    const rows = parseCsv("a,b\r\nc,d\r\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("keeps newlines inside quoted fields", () => {
    const rows = parseCsv('a,"b\nc",d\n1,2,3');
    expect(rows).toEqual([
      ["a", "b\nc", "d"],
      ["1", "2", "3"],
    ]);
  });
});

describe("parseUsageCsv", () => {
  it("parses a usage event row", () => {
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

  it("empty agent/automation ids become null", () => {
    const csv = [
      HEADER,
      '"2026-06-10T12:55:01.730Z","j@example.com","","","On-Demand","gpt-5.5-medium","No","1615","2","187200","1506","190323","0.33"',
    ].join("\n");
    const e = parseUsageCsv(csv)[0]!;
    expect(e.cloudAgentId).toBeNull();
    expect(e.automationId).toBeNull();
    expect(e.maxMode).toBe(false);
  });

  it("throws on a non-usage CSV", () => {
    expect(() => parseUsageCsv("foo,bar\n1,2")).toThrow(/missing column/);
  });

  it("returns empty array for empty input", () => {
    expect(parseUsageCsv("")).toEqual([]);
  });

  it("skips rows with invalid dates", () => {
    const csv = [
      HEADER,
      '"not-a-date","j@example.com","","","On-Demand","m","No","0","0","0","0","0","0.01"',
    ].join("\n");
    expect(parseUsageCsv(csv)).toEqual([]);
  });

  it("skips empty rows between events", () => {
    const csv = [
      HEADER,
      "",
      '"2026-06-10T14:19:26.869Z","j@example.com","","","On-Demand","m","No","0","0","0","0","0","0.01"',
      "",
    ].join("\n");
    expect(parseUsageCsv(csv)).toHaveLength(1);
  });

  it("throws when a required column is missing", () => {
    expect(() => parseUsageCsv("Date,User,Model\n2026-06-10T00:00:00Z,j@example.com,m")).toThrow(
      /missing column "Cost"/,
    );
  });

  it("parses extra columns and treats non-numeric token or cost fields as zero", () => {
    const csv = [
      `${HEADER},Notes`,
      '"2026-06-10T14:19:26.869Z","j@example.com","","","On-Demand","m","YES","n/a","","","x","y","?"',
    ].join("\n");
    const e = parseUsageCsv(csv)[0]!;
    expect(e.maxMode).toBe(true);
    expect(e.inputWithCacheWrite).toBe(0);
    expect(e.inputWithoutCacheWrite).toBe(0);
    expect(e.cacheRead).toBe(0);
    expect(e.outputTokens).toBe(0);
    expect(e.totalTokens).toBe(0);
    expect(e.cost).toBe(0);
  });
});
