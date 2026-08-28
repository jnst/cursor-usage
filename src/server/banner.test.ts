import { describe, expect, it } from "bun:test";

import { dashboardBanner, FAVICON_BLUE, FAVICON_GOLD, FAVICON_GREEN } from "./banner.ts";

describe("dashboardBanner", () => {
  it("prints a published version, dashboard URL, and the Usage Export download link", () => {
    expect(dashboardBanner("v0.10.0", "http://localhost:4321", { color: false })).toBe(
      [
        "      ██  cursor-usage v0.10.0",
        "   ██ ██  dashboard: http://localhost:4321",
        "██ ██ ██  csv download: https://cursor.com/dashboard/usage",
        "          drop the file onto the page. Ctrl+C to stop",
      ].join("\n"),
    );
  });

  it("prints a development marker instead of a version", () => {
    expect(dashboardBanner("(dev)", "http://localhost:61050", { color: false })).toBe(
      [
        "      ██  cursor-usage (dev)",
        "   ██ ██  dashboard: http://localhost:61050",
        "██ ██ ██  csv download: https://cursor.com/dashboard/usage",
        "          drop the file onto the page. Ctrl+C to stop",
      ].join("\n"),
    );
  });

  it("colors the three bars with the favicon palette", () => {
    const text = dashboardBanner("v0.10.0", "http://localhost:4321", { color: true });
    expect(text).toContain("\x1b[38;2;88;166;255m");
    expect(text).toContain("\x1b[38;2;63;185;80m");
    expect(text).toContain("\x1b[38;2;210;153;34m");
    expect(FAVICON_BLUE).toBe("#58a6ff");
    expect(FAVICON_GREEN).toBe("#3fb950");
    expect(FAVICON_GOLD).toBe("#d29922");
  });
});
