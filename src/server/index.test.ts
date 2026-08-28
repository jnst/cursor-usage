import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { dashboardBanner, packageVersion } from "./index.ts";

describe("dashboardBanner", () => {
  it("prints version, dashboard URL, and the Usage Export download link", () => {
    expect(dashboardBanner("0.10.0", "http://localhost:4321")).toBe(
      [
        "     ▂█  cursor-usage v0.10.0",
        "   ▂▄██  dashboard · http://localhost:4321",
        "  ▂▄███  CSV · https://cursor.com/dashboard/usage",
        "         drop the file onto the page · Ctrl+C to stop",
      ].join("\n"),
    );
  });
});

describe("packageVersion", () => {
  it("reads the version from the nearest package.json", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string };
    expect(packageVersion()).toBe(pkg.version);
  });
});
