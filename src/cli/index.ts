#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { billable, defaultAnalysisTimeZone, isValidTimeZone } from "../core/aggregate.ts";
import { parseUsageCsv } from "../core/parse.ts";
import { serve } from "../server/index.ts";
import { dayViewJson, renderDayView, renderStats, type StatsAxis, statsJson } from "./render.ts";

const HELP = `cursor-usage — visualize Cursor usage-events CSV

Usage:
  cursor-usage [serve] [--port <n>] [--no-open]   Start the drag & drop dashboard (default)
  cursor-usage stats <csv> [options]              Show usage statistics in the terminal

Stats options:
  --by <day|user|model>   Show a single breakdown axis (default: all)
  --day <YYYY-MM-DD>      Drill into a single day (hourly, model, user, kind, top events)
  --user <identifier>     Filter analysis to a single User
  --timezone <iana-tz>    Analysis time zone (default: current environment)
  --json                  Output aggregated stats as JSON
  --include-no-charge     Include "Errored, No Charge" events

Serve options:
  --port <n>              Fixed port to listen on
                          (default: 4321, falls back to a free port if busy)
  --no-open               Do not open the browser automatically

  -h, --help              Show this help
`;

function fail(message: string): never {
  console.error(`Error: ${message}\n`);
  console.error(HELP);
  process.exit(1);
}

async function runStats(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      by: { type: "string" },
      day: { type: "string" },
      user: { type: "string" },
      timezone: { type: "string" },
      json: { type: "boolean", default: false },
      "include-no-charge": { type: "boolean", default: false },
    },
  });

  const csvPath = positionals[0];
  if (!csvPath) fail("stats requires a path to a CSV file");

  let text: string;
  try {
    text = await readFile(csvPath, "utf8");
  } catch {
    fail(`file not found: ${csvPath}`);
  }

  const axis = values.by as StatsAxis | undefined;
  if (axis && !["day", "user", "model"].includes(axis)) {
    fail(`invalid --by value: ${axis} (expected day, user or model)`);
  }

  const day = values.day;
  if (day !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    fail(`invalid --day value: ${day} (expected YYYY-MM-DD)`);
  }

  const timeZone = values.timezone ?? defaultAnalysisTimeZone();
  if (!isValidTimeZone(timeZone)) {
    fail(`invalid --timezone value: ${timeZone}`);
  }

  let events = parseUsageCsv(text);
  if (!values["include-no-charge"]) events = billable(events);
  const user = values.user;
  if (user) events = events.filter((e) => e.user === user);

  if (events.length === 0) {
    console.error("No usage events found for the requested filters.");
    process.exit(1);
  }

  if (day) {
    console.log(
      values.json
        ? dayViewJson(events, day, timeZone, user)
        : renderDayView(events, day, timeZone, user),
    );
    return;
  }

  console.log(
    values.json ? statsJson(events, timeZone, user) : renderStats(events, axis, timeZone, user),
  );
}

function runServe(args: string[]): void {
  const { values } = parseArgs({
    args,
    allowPositionals: false,
    options: {
      port: { type: "string" },
      "no-open": { type: "boolean", default: false },
    },
  });

  let port: number | undefined;
  if (values.port !== undefined) {
    port = Number(values.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      fail(`invalid --port value: ${values.port}`);
    }
  }

  serve({ port, open: !values["no-open"] });
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(HELP);
    return;
  }

  const [command, ...rest] = argv;
  switch (command) {
    case "stats":
      await runStats(rest);
      break;
    case "serve":
      runServe(rest);
      break;
    case undefined:
      runServe([]);
      break;
    default:
      fail(`unknown command: ${command}`);
  }
}

await main();
