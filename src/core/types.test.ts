import { describe, expect, it } from "bun:test";

import { isMetric } from "./types.ts";

describe("isMetric", () => {
  it("accepts cost and tokens", () => {
    expect(isMetric("cost")).toBe(true);
    expect(isMetric("tokens")).toBe(true);
  });

  it("rejects missing or unknown values", () => {
    expect(isMetric(null)).toBe(false);
    expect(isMetric(undefined)).toBe(false);
    expect(isMetric("")).toBe(false);
    expect(isMetric("tokens ")).toBe(false);
  });
});
