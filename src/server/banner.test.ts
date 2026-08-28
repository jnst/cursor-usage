import { describe, expect, it } from "bun:test";

import { dashboardBanner } from "./banner.ts";

describe("dashboardBanner", () => {
  it("prints a published version, dashboard URL, and the Usage Export download link", () => {
    expect(dashboardBanner("v0.10.0", "http://localhost:4321")).toBe(
      [
        "     ▂█  cursor-usage v0.10.0",
        "   ▂▄██  dashboard · http://localhost:4321",
        "  ▂▄███  CSV · https://cursor.com/dashboard/usage",
        "         drop the file onto the page · Ctrl+C to stop",
      ].join("\n"),
    );
  });

  it("prints a development marker instead of a version", () => {
    expect(dashboardBanner("(dev)", "http://localhost:61050")).toBe(
      [
        "     ▂█  cursor-usage (dev)",
        "   ▂▄██  dashboard · http://localhost:61050",
        "  ▂▄███  CSV · https://cursor.com/dashboard/usage",
        "         drop the file onto the page · Ctrl+C to stop",
      ].join("\n"),
    );
  });
});
