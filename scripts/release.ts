import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const VERSION_BUMPS = new Set(["patch", "minor", "major"]);

interface Options {
  bump: string;
  dryRun: boolean;
}

function usage(): never {
  console.error(`Usage: bun run scripts/release.ts <patch|minor|major|x.y.z> [options]

Options:
  --dry-run              Print commands without running mutating steps
`);
  process.exit(1);
}

function parseArgs(argv: string[]): Options {
  const [bump, ...flags] = argv;
  if (!bump) usage();

  let dryRun = false;

  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i];
    if (flag === "--dry-run") {
      dryRun = true;
      continue;
    }
    usage();
  }

  const isExactVersion = /^\d+\.\d+\.\d+(-[0-9A-Za-z-.]+)?$/.test(bump);
  if (!VERSION_BUMPS.has(bump) && !isExactVersion) usage();

  return {
    bump,
    dryRun,
  };
}

function run(command: string, args: string[], options: { mutate?: boolean } = {}) {
  const display = [command, ...args].join(" ");
  console.log(`\n$ ${display}`);

  if (release.dryRun && options.mutate) {
    console.log("(dry-run: skipped)");
    return;
  }

  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function output(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout.trim();
}

function status(command: string, args: string[]): number {
  return spawnSync(command, args, { stdio: "ignore" }).status ?? 1;
}

function ensureNpmAuth() {
  if (status("npm", ["whoami"]) === 0) return;

  console.log("\nnpm is not authenticated. Starting npm login...");
  run("npm", ["login"], { mutate: true });
  run("npm", ["whoami"]);
}

function ensureCleanWorkingTree() {
  const status = output("git", ["status", "--porcelain"]);
  if (status) {
    console.error("Working tree is not clean. Commit or stash changes before releasing.");
    console.error(status);
    process.exit(1);
  }
}

function readPackage(): { name: string; version: string } {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  return { name: pkg.name, version: pkg.version };
}

function headVersionTag(): string | null {
  const tags = output("git", ["tag", "--points-at", "HEAD", "--list", "v*"])
    .split("\n")
    .map((tag) => tag.trim())
    .filter((tag) => /^v\d+\.\d+\.\d+/.test(tag));
  return tags[0] ?? null;
}

function tagVersion(tag: string): string {
  return tag.replace(/^v/, "");
}

function npmPackageExists(name: string, version: string): boolean {
  return status("npm", ["view", `${name}@${version}`, "version"]) === 0;
}

function githubReleaseExists(tag: string): boolean {
  return status("gh", ["release", "view", tag]) === 0;
}

const release = parseArgs(process.argv.slice(2));

ensureCleanWorkingTree();

ensureNpmAuth();
run("gh", ["auth", "status"]);
run("bun", ["run", "fix"]);
ensureCleanWorkingTree();
run("bun", ["run", "prepush"]);

let tag = headVersionTag();

if (tag) {
  console.log(`\nHEAD is already tagged as ${tag}; skipping npm version.`);
} else {
  run("npm", ["version", release.bump], { mutate: true });
  tag = release.dryRun ? `v${readPackage().version}` : headVersionTag();
}

if (!tag) {
  console.error("Could not determine release tag from HEAD.");
  process.exit(1);
}

const { name } = readPackage();
const version = tagVersion(tag);

if (npmPackageExists(name, version)) {
  console.log(`\n${name}@${version} is already published; skipping npm publish.`);
} else {
  run("npm", ["publish", "--access", "public"], { mutate: true });
}

run("git", ["push", "--follow-tags"], { mutate: true });

if (githubReleaseExists(tag)) {
  console.log(`\nGitHub Release ${tag} already exists; skipping release create.`);
} else {
  const args = ["release", "create", tag, "--title", tag, "--generate-notes"];
  run("gh", args, { mutate: true });
}

console.log(`\nrelease ${tag} complete`);
