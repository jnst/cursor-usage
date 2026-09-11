import { expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

it("sanitizes through the CLI and refuses to overwrite existing input or output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cursor-sanitize-"));
  const input = join(dir, "usage.csv");
  const original = "User,Cost\nsecret@company.invalid,0.5\n";
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ["src/cli/index.ts", "sanitize", ...args], { encoding: "utf8" });
  try {
    await writeFile(input, original);
    expect(run(input).status).toBe(0);
    expect(await readFile(join(dir, "usage-sanitized.csv"), "utf8")).toBe(
      "User,Cost\nsato@example.jp,0\n",
    );
    expect(run(input).status).toBe(1);
    expect(run(input, "--out", input).status).toBe(1);
    expect(await readFile(input, "utf8")).toBe(original);
    expect(run(input, "--out", join(dir, "custom.csv")).status).toBe(0);
    await writeFile(input, "User,Cost\nprivate-secret,1\n");
    const invalid = run(input, "--out", join(dir, "invalid.csv"));
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).not.toContain("private-secret");
    expect(invalid.stdout).toBe("");
    expect(await readFile(join(dir, "invalid.csv"), "utf8").catch(() => null)).toBeNull();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
