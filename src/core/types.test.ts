import { describe, expect, it } from "bun:test";

import { isDisplayMetric } from "./types.ts";

describe("isDisplayMetric", () => {
  it("accepts cost and tokens", () => {
    expect(isDisplayMetric("cost")).toBe(true);
    expect(isDisplayMetric("tokens")).toBe(true);
  });

  it("rejects missing or unknown values", () => {
    expect(isDisplayMetric(null)).toBe(false);
    expect(isDisplayMetric(undefined)).toBe(false);
    expect(isDisplayMetric("")).toBe(false);
    expect(isDisplayMetric("tokens ")).toBe(false);
  });
});
