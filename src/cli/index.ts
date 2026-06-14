#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import {
  billable,
  defaultAnalysisTimeZone,
  isValidStartHour,
  isValidTimeZone,
  latestDailyWindowKey,
} from "../core/aggregate.ts";
import { parseUsageCsv } from "../core/parse.ts";
import { serve } from "../server/index.ts";
import {
  dailyWindowViewJson,
  renderDailyWindowView,
  renderStats,
  type StatsAxis,
  statsJson,
} from "./render.ts";
import { writeScreenshot } from "./screenshot.ts";

const HELP = `cursor-usage — visualize Cursor usage-events CSV

Usage:
  cursor-usage [serve] [--port <n>] [--no-open]   Start the drag & drop dashboard (default)
  cursor-usage stats <csv> [options]              Show usage statistics in the terminal
  cursor-usage screenshot <csv> [options]         Capture the dashboard as a PNG
  cursor-usage daily-report <csv>                 Capture a shareable daily report PNG

Stats options:
  --by <daily-window|user|model>  Show a single breakdown axis (default: all)
  --daily-window <YYYY-MM-DD>     Drill into a single Daily Window
  --start-hour <0-23>             Daily Window start hour (default: 0)
  --user <identifier>             Filter analysis to a single User
  --timezone <iana-tz>            Analysis time zone (default: current environment)
  --json                          Output aggregated stats as JSON
  --include-no-charge             Include "Errored, No Charge" events

Screenshot options:
  --daily-window <YYYY-MM-DD>     Capture a Daily Window detail view
  --start-hour <0-23>             Daily Window start hour (default: 0)
  --event-limit <n>               Limit Daily Window event table rows
  --out <path>                    Output path
  --user <identifier>             Filter screenshot to a single User
  --timezone <iana-tz>            Analysis time zone (default: current environment)
  --include-no-charge             Include "Errored, No Charge" events

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

function parseStartHour(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const startHour = Number(value);
  if (!isValidStartHour(startHour)) {
    fail(`invalid --start-hour value: ${value} (expected 0-23)`);
  }
  return startHour;
}

function parseEventLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const eventLimit = Number(value);
  if (!Number.isInteger(eventLimit) || eventLimit <= 0) {
    fail(`invalid --event-limit value: ${value} (expected a positive integer)`);
  }
  return eventLimit;
}

async function readUsageEvents(
  csvPath: string,
  includeNoCharge: boolean,
  user: string | undefined,
  emptyMessage = "No usage events found for the requested filters.",
): Promise<ReturnType<typeof parseUsageCsv>> {
  let text: string;
  try {
    text = await readFile(csvPath, "utf8");
  } catch {
    fail(`file not found: ${csvPath}`);
  }

  let events = parseUsageCsv(text);
  if (!includeNoCharge) events = billable(events);
  if (user) events = events.filter((e) => e.user === user);
  if (events.length === 0) {
    fail(emptyMessage);
  }
  return events;
}

async function runStats(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      by: { type: "string" },
      "daily-window": { type: "string" },
      "start-hour": { type: "string" },
      user: { type: "string" },
      timezone: { type: "string" },
      json: { type: "boolean", default: false },
      "include-no-charge": { type: "boolean", default: false },
    },
  });

  const csvPath = positionals[0];
  if (!csvPath) fail("stats requires a path to a CSV file");

  const axis = values.by as StatsAxis | undefined;
  if (axis && !["daily-window", "user", "model"].includes(axis)) {
    fail(`invalid --by value: ${axis} (expected daily-window, user or model)`);
  }

  const dailyWindow = values["daily-window"];
  if (dailyWindow !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(dailyWindow)) {
    fail(`invalid --daily-window value: ${dailyWindow} (expected YYYY-MM-DD)`);
  }

  const timeZone = values.timezone ?? defaultAnalysisTimeZone();
  if (!isValidTimeZone(timeZone)) {
    fail(`invalid --timezone value: ${timeZone}`);
  }
  const startHour = parseStartHour(values["start-hour"], 0);

  const user = values.user;
  const events = await readUsageEvents(csvPath, values["include-no-charge"], user);

  if (dailyWindow) {
    console.log(
      values.json
        ? dailyWindowViewJson(events, dailyWindow, timeZone, user, startHour)
        : renderDailyWindowView(events, dailyWindow, timeZone, user, startHour),
    );
    return;
  }

  console.log(
    values.json
      ? statsJson(events, timeZone, user, startHour)
      : renderStats(events, axis, timeZone, user, startHour),
  );
}

async function runScreenshot(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      "daily-window": { type: "string" },
      "start-hour": { type: "string" },
      "event-limit": { type: "string" },
      out: { type: "string" },
      user: { type: "string" },
      timezone: { type: "string" },
      "include-no-charge": { type: "boolean", default: false },
    },
  });

  const csvPath = positionals[0];
  if (!csvPath) fail("screenshot requires a path to a CSV file");

  const timeZone = values.timezone ?? defaultAnalysisTimeZone();
  if (!isValidTimeZone(timeZone)) {
    fail(`invalid --timezone value: ${timeZone}`);
  }
  const dailyWindow = values["daily-window"];
  if (dailyWindow !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(dailyWindow)) {
    fail(`invalid --daily-window value: ${dailyWindow} (expected YYYY-MM-DD)`);
  }
  const startHour = parseStartHour(values["start-hour"], 0);
  const eventLimit = parseEventLimit(values["event-limit"]);

  const events = await readUsageEvents(csvPath, values["include-no-charge"], values.user);
  const path = await writeScreenshot({
    csvPath,
    events,
    timeZone,
    dailyWindow,
    startHour,
    eventLimit,
    dailyReport: false,
    out: values.out,
    user: values.user,
  });
  console.log(`wrote ${path}`);
}

async function runDailyReport(args: string[]): Promise<void> {
  const { positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {},
  });

  const csvPath = positionals[0];
  if (!csvPath) fail("daily-report requires a path to a CSV file");
  if (positionals.length > 1) fail(`unexpected argument: ${positionals[1]}`);

  const timeZone = defaultAnalysisTimeZone();
  const startHour = 5;
  const events = await readUsageEvents(
    csvPath,
    false,
    undefined,
    "No billable usage events found in the Usage Export.",
  );
  const dailyWindow = latestDailyWindowKey(events, timeZone, startHour);
  if (!dailyWindow) fail("No billable usage events found in the Usage Export.");

  const path = await writeScreenshot({
    csvPath,
    events,
    timeZone,
    dailyWindow,
    startHour,
    eventLimit: 10,
    dailyReport: true,
  });
  console.log(`wrote ${path}`);
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
    case "screenshot":
      await runScreenshot(rest);
      break;
    case "daily-report":
      await runDailyReport(rest);
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
