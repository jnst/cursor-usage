import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { screenshotViewHash } from "../src/cli/screenshot.ts";

const root = join(import.meta.dir, "..");
const cli = join(root, "src/cli/index.ts");

const CSV = [
  "Date,User,Cloud Agent ID,Automation ID,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost",
  '"2026-06-01T10:00:00.000Z","volume@example.com","","","On-Demand","voluminous","No","0","0","0","0","1000000","0.10"',
  '"2026-06-01T11:00:00.000Z","pricey@example.com","","","On-Demand","expensive","No","0","0","0","0","1000","5.00"',
].join("\n");

let fixtureDir: string;
let fixture: string;

beforeAll(async () => {
  fixtureDir = await mkdtemp(join(tmpdir(), "cursor-usage-metric-"));
  fixture = join(fixtureDir, "metric-order.csv");
  await writeFile(fixture, CSV);
});

afterAll(async () => {
  await rm(fixtureDir, { recursive: true, force: true });
});

async function runStats(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const proc = Bun.spawn(["bun", cli, "stats", fixture, "--timezone", "UTC", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1" },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

describe("stats --metric", () => {
  it("defaults to Cost as the primary summary value and ranking", async () => {
    const { stdout, exitCode } = await runStats([]);
    expect(exitCode).toBe(0);
    expect(stdout.indexOf("Total Cost")).toBeLessThan(stdout.indexOf("Total Tokens"));
    const users = stdout.slice(stdout.indexOf("By User"));
    expect(users.indexOf("pricey@example.com")).toBeLessThan(users.indexOf("volume@example.com"));
    const models = stdout.slice(stdout.indexOf("By Model Family"));
    expect(models.indexOf("expensive")).toBeLessThan(models.indexOf("voluminous"));
  });

  it("uses Token Count as the primary value and sorts User / Model by tokens", async () => {
    const { stdout, exitCode } = await runStats(["--metric", "tokens"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("metric tokens");
    expect(stdout.indexOf("Total Tokens")).toBeLessThan(stdout.indexOf("Total Cost"));
    const users = stdout.slice(stdout.indexOf("By User"));
    expect(users.indexOf("volume@example.com")).toBeLessThan(users.indexOf("pricey@example.com"));
    const models = stdout.slice(stdout.indexOf("By Model Family"));
    expect(models.indexOf("voluminous")).toBeLessThan(models.indexOf("expensive"));
  });

  it("includes the selected Metric in JSON and orders breakdowns by it", async () => {
    const { stdout, exitCode } = await runStats(["--metric", "tokens", "--json"]);
    expect(exitCode).toBe(0);
    const json = JSON.parse(stdout) as {
      metric: string;
      byUser: { key: string }[];
      byModel: { key: string }[];
    };
    expect(json.metric).toBe("tokens");
    expect(json.byUser[0]?.key).toBe("volume@example.com");
    expect(json.byModel[0]?.key).toBe("voluminous");
  });

  it("orders Daily Window events and rank by Token Count", async () => {
    const { stdout, exitCode } = await runStats([
      "--metric",
      "tokens",
      "--daily-window",
      "2026-06-01",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("rank 1/1 by token count");
    expect(stdout.indexOf("Token Count")).toBeLessThan(stdout.indexOf("Cost"));
    const events = stdout.slice(stdout.indexOf("Top Events"));
    expect(events.indexOf("volume@example.com")).toBeLessThan(events.indexOf("pricey@example.com"));
  });

  it("rejects an unknown Metric", async () => {
    const { stderr, exitCode } = await runStats(["--metric", "bananas"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("invalid --metric value: bananas");
  });
});

describe("screenshot URL hash", () => {
  it("includes the selected Metric", () => {
    const hash = screenshotViewHash({
      ctx: { timeZone: "Asia/Tokyo", startHour: 5 },
      metric: "tokens",
      dailyWindow: "2026-06-01",
    });
    expect(hash).toContain("metric=tokens");
    expect(hash).toContain("timezone=Asia%2FTokyo");
    expect(hash).toContain("daily-window=2026-06-01");
    expect(hash).toContain("start-hour=5");
  });
});
