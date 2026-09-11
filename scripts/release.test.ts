import { expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "release.ts");

function attemptRelease(checkout: string, dryRun: boolean) {
  const root = mkdtempSync(join(tmpdir(), "cursor-release-guard-"));
  const repo = join(root, "repo");
  const bin = join(root, "bin");
  mkdirSync(repo);
  mkdirSync(bin);
  // Stop at the first npm invocation; no authentication, publication or pushing is possible.
  writeFileSync(join(bin, "npm"), '#!/bin/sh\necho "npm sentinel" >&2\nexit 42\n', { mode: 0o755 });
  const git = (args: string[]) => {
    const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr);
  };
  try {
    git(["init", "-b", checkout === "detached" ? "main" : checkout]);
    git([
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "-m",
      "fixture",
    ]);
    if (checkout === "detached") git(["checkout", "--detach"]);
    return spawnSync(process.execPath, [script, "minor", ...(dryRun ? ["--dry-run"] : [])], {
      cwd: repo,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      encoding: "utf8",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

for (const checkout of ["codex/feature", "detached"]) {
  for (const dryRun of [false, true]) {
    it(`rejects ${checkout} before authentication (dry-run: ${dryRun})`, () => {
      const result = attemptRelease(checkout, dryRun);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Releases must run on main.");
      expect(result.stderr).toContain(checkout === "detached" ? "detached HEAD" : checkout);
      expect(result.stdout).toBe("");
      expect(result.stderr).not.toContain("npm sentinel");
    });
  }
}

it("allows main to reach the existing authentication step", () => {
  const result = attemptRelease("main", false);
  expect(result.status).toBe(42);
  expect(result.stderr).toContain("npm sentinel");
  expect(result.stderr).not.toContain("Releases must run on main.");
});
