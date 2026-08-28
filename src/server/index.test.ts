import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { packageVersion } from "./index.ts";

describe("packageVersion", () => {
  it("reads the version from the nearest package.json", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string };
    expect(packageVersion()).toBe(pkg.version);
  });
});
