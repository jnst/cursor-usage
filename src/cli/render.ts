import type { BucketStat, Summary, UsageEvent } from "../core/types.ts";

import {
  byDailyWindow,
  byHour,
  byKind,
  byModel,
  byUser,
  eventsInDailyWindow,
  orderedHours,
  summarize,
  topEvents,
} from "../core/aggregate.ts";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

const ansi = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const bold = ansi("1");
export const dim = ansi("2");
export const cyan = ansi("36");
export const green = ansi("32");
export const yellow = ansi("33");

/**
 * Formats Cost for terminal output.
 *
 * Terminal tables preserve cents because Cost comes from the Usage Export and
 * should not be visually rounded away in textual summaries.
 */
export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

/**
 * Formats token counts for compact human-readable terminal output.
 *
 * This is a display helper only. Machine-readable JSON output should keep the
 * original numeric token counts.
 */
export function formatTokens(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}

/**
 * Renders a horizontal terminal bar with 1/8-block resolution.
 *
 * The bar is relative to the supplied maximum, so it should only be compared
 * within the same rendered section.
 */
export function bar(value: number, max: number, width: number): string {
  if (max <= 0 || value <= 0) return "";
  const eighths = Math.round((value / max) * width * 8);
  const full = Math.floor(eighths / 8);
  const rem = eighths % 8;
  const partials = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];
  return "█".repeat(full) + (partials[rem] ?? "");
}

function padEndDisplay(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function dateTimePart(
  date: Date,
  timeZone: string,
  part: "year" | "month" | "day" | "hour" | "minute" | "second",
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return parts.find((p) => p.type === part)?.value ?? "";
}

function formatTime(date: Date, timeZone: string): string {
  return [
    dateTimePart(date, timeZone, "hour"),
    dateTimePart(date, timeZone, "minute"),
    dateTimePart(date, timeZone, "second"),
  ].join(":");
}

function renderSummaryBlock(
  summary: Summary,
  timeZone: string,
  user: string | undefined,
  startHour: number,
): string[] {
  const period =
    summary.firstDailyWindow && summary.lastDailyWindow
      ? `${summary.firstDailyWindow} – ${summary.lastDailyWindow}`
      : "no data";
  const scope = user
    ? `${timeZone}, start ${startHour}:00, user ${user}`
    : `${timeZone}, start ${startHour}:00`;
  const label = (s: string) => dim(padEndDisplay(s, 14));
  const value = (s: string) => bold(padEndDisplay(s, 12));
  return [
    `${bold("Cursor Usage")}  ${period}  ${dim(`(${summary.eventCount} events, ${summary.dailyWindowCount} daily windows, ${scope})`)}`,
    "",
    `  ${label("Total Cost")}${value(formatUsd(summary.totalCost))}  ${label("Total Tokens")}${value(formatTokens(summary.totalTokens))}`,
    `  ${label("Avg/Active")}${value(formatUsd(summary.avgCostPerActiveDailyWindow))}  ${label("Max Mode")}${value(`${Math.round(summary.maxModeRatio * 100)}%`)}`,
    `  ${label("Users")}${value(String(summary.userCount))}  ${label("Models")}${value(String(summary.modelCount))}`,
  ];
}

function renderBucketChart(
  title: string,
  buckets: BucketStat[],
  options: { totalCost: number; barWidth?: number; maxRows?: number } = {
    totalCost: 0,
  },
): string[] {
  const { totalCost, barWidth = 28, maxRows = 15 } = options;
  const rows = buckets.slice(0, maxRows);
  const keyWidth = Math.max(...rows.map((b) => b.key.length), 4);
  const maxCost = Math.max(...rows.map((b) => b.cost), 0);

  const lines = [bold(title)];
  for (const b of rows) {
    const share = totalCost > 0 ? ` ${dim(`${Math.round((b.cost / totalCost) * 100)}%`)}` : "";
    lines.push(
      `  ${padEndDisplay(b.key, keyWidth)}  ${padEndDisplay(formatUsd(b.cost), 8)} ${cyan(padEndDisplay(bar(b.cost, maxCost, barWidth), barWidth))}${share} ${dim(`${formatTokens(b.totalTokens)} tok, ${b.eventCount} ev`)}`,
    );
  }
  if (buckets.length > maxRows) {
    lines.push(dim(`  … and ${buckets.length - maxRows} more`));
  }
  return lines;
}

export type StatsAxis = "daily-window" | "user" | "model";

/**
 * Renders the overview analysis for terminal display.
 *
 * The input events should already reflect CLI filters such as Billable Events
 * only, selected User, and No Charge inclusion.
 */
export function renderStats(
  events: UsageEvent[],
  axis: StatsAxis | undefined,
  timeZone: string,
  user?: string,
  startHour = 0,
): string {
  const summary = summarize(events, timeZone, startHour);
  const sections: string[][] = [renderSummaryBlock(summary, timeZone, user, startHour)];

  const charts: Record<StatsAxis, () => string[]> = {
    "daily-window": () =>
      renderBucketChart("Daily Window Cost", byDailyWindow(events, timeZone, startHour), {
        totalCost: summary.totalCost,
        maxRows: 31,
      }),
    model: () =>
      renderBucketChart("By Model", byModel(events), {
        totalCost: summary.totalCost,
      }),
    user: () =>
      renderBucketChart("By User", byUser(events), {
        totalCost: summary.totalCost,
      }),
  };

  if (axis) {
    sections.push(charts[axis]());
  } else {
    sections.push(charts["daily-window"](), charts.model(), charts.user());
  }

  return sections.map((s) => s.join("\n")).join("\n\n") + "\n";
}

/**
 * Serializes the overview analysis as JSON for scripting.
 *
 * Unlike terminal rendering, this keeps numeric values as numbers and includes
 * the active view filters so downstream tools can interpret the result.
 */
export function statsJson(
  events: UsageEvent[],
  timeZone: string,
  user?: string,
  startHour = 0,
): string {
  return JSON.stringify(
    {
      timeZone,
      startHour,
      filters: { user: user ?? null },
      summary: summarize(events, timeZone, startHour),
      byDailyWindow: byDailyWindow(events, timeZone, startHour),
      byModel: byModel(events),
      byUser: byUser(events),
    },
    null,
    2,
  );
}

function renderDailyWindowSummaryBlock(
  dailyWindow: string,
  dailyWindowEvents: UsageEvent[],
  timeZone: string,
  startHour: number,
  totalCost: number,
  rank: number,
  dailyWindowCount: number,
): string[] {
  const s = summarize(dailyWindowEvents, timeZone, startHour);
  const share = totalCost > 0 ? Math.round((s.totalCost / totalCost) * 100) : 0;
  const label = (str: string) => dim(padEndDisplay(str, 14));
  const value = (str: string) => bold(padEndDisplay(str, 12));
  return [
    `${bold(`Daily Window ${dailyWindow}`)}  ${dim(`(${s.eventCount} events, rank ${rank}/${dailyWindowCount} by cost, ${timeZone}, start ${startHour}:00)`)}`,
    "",
    `  ${label("Cost")}${value(formatUsd(s.totalCost))}  ${label("of period")}${value(`${share}%`)}`,
    `  ${label("Total Tokens")}${value(formatTokens(s.totalTokens))}  ${label("Max Mode")}${value(`${Math.round(s.maxModeRatio * 100)}%`)}`,
    `  ${label("Users")}${value(String(s.userCount))}  ${label("Models")}${value(String(s.modelCount))}`,
  ];
}

function renderHourlyChart(
  dailyWindowEvents: UsageEvent[],
  timeZone: string,
  startHour: number,
): string[] {
  const byHourMap = new Map(byHour(dailyWindowEvents, timeZone).map((b) => [b.key, b]));
  const maxCost = Math.max(...[...byHourMap.values()].map((b) => b.cost), 0);
  const lines = [bold(`By Hour (${timeZone})`)];
  for (const key of orderedHours(startHour)) {
    const b = byHourMap.get(key);
    const cost = b?.cost ?? 0;
    const events = b?.eventCount ?? 0;
    const meta = events > 0 ? dim(` ${events} ev`) : "";
    lines.push(
      `  ${key}  ${padEndDisplay(cost > 0 ? formatUsd(cost) : "", 8)} ${cyan(padEndDisplay(bar(cost, maxCost, 24), 24))}${meta}`,
    );
  }
  return lines;
}

function renderDailyWindowEvents(
  dailyWindowEvents: UsageEvent[],
  limit: number,
  timeZone: string,
): string[] {
  const top = topEvents(dailyWindowEvents, limit);
  const lines = [bold(`Top Events (${top.length} of ${dailyWindowEvents.length})`)];
  const userWidth = Math.max(...top.map((e) => e.user.length), 4);
  const modelWidth = Math.max(...top.map((e) => e.model.length), 5);
  for (const e of top) {
    const time = formatTime(e.date, timeZone);
    lines.push(
      `  ${dim(time)}  ${padEndDisplay(e.user, userWidth)}  ${padEndDisplay(e.model, modelWidth)}  ${padEndDisplay(formatUsd(e.cost), 8)} ${dim(`${formatTokens(e.totalTokens)} tok`)}`,
    );
  }
  return lines;
}

/**
 * Renders one Daily Window detail view for terminal display.
 *
 * The Daily Window Key is interpreted in the provided Analysis Time Zone and
 * start hour. The input events should already include any User or No Charge filtering.
 */
export function renderDailyWindowView(
  events: UsageEvent[],
  dailyWindow: string,
  timeZone: string,
  user?: string,
  startHour = 0,
): string {
  const dailyWindows = byDailyWindow(events, timeZone, startHour);
  const dailyWindowEvents = eventsInDailyWindow(events, dailyWindow, timeZone, startHour);
  if (dailyWindowEvents.length === 0) {
    const known = dailyWindows.map((d) => d.key);
    const hint =
      known.length > 0 ? `\nAvailable Daily Windows: ${known[0]} – ${known[known.length - 1]}` : "";
    return `No billable events in Daily Window ${dailyWindow}.${hint}\n`;
  }

  const totalCost = events.reduce((sum, e) => sum + e.cost, 0);
  const rank =
    [...dailyWindows].sort((a, b) => b.cost - a.cost).findIndex((d) => d.key === dailyWindow) + 1;
  const dailyWindowTotal = summarize(dailyWindowEvents, timeZone, startHour).totalCost;

  const sections: string[][] = [
    renderDailyWindowSummaryBlock(
      dailyWindow,
      dailyWindowEvents,
      timeZone,
      startHour,
      totalCost,
      rank,
      dailyWindows.length,
    ),
    ...(user ? [[dim(`Filtered to user: ${user}`)]] : []),
    renderHourlyChart(dailyWindowEvents, timeZone, startHour),
    renderBucketChart("By Model", byModel(dailyWindowEvents), {
      totalCost: dailyWindowTotal,
    }),
    renderBucketChart("By User", byUser(dailyWindowEvents), {
      totalCost: dailyWindowTotal,
    }),
    renderBucketChart("By Kind", byKind(dailyWindowEvents), { totalCost: dailyWindowTotal }),
    renderDailyWindowEvents(dailyWindowEvents, 20, timeZone),
  ];

  return sections.map((s) => s.join("\n")).join("\n\n") + "\n";
}

/**
 * Serializes one Daily Window detail view as JSON for scripting.
 *
 * The returned object includes the selected Daily Window, Analysis Time Zone,
 * start hour, filters, and the same breakdowns shown in terminal output.
 */
export function dailyWindowViewJson(
  events: UsageEvent[],
  dailyWindow: string,
  timeZone: string,
  user?: string,
  startHour = 0,
): string {
  const dailyWindowEvents = eventsInDailyWindow(events, dailyWindow, timeZone, startHour);
  return JSON.stringify(
    {
      dailyWindow,
      timeZone,
      startHour,
      filters: { user: user ?? null },
      summary: summarize(dailyWindowEvents, timeZone, startHour),
      byHour: byHour(dailyWindowEvents, timeZone),
      byModel: byModel(dailyWindowEvents),
      byUser: byUser(dailyWindowEvents),
      byKind: byKind(dailyWindowEvents),
    },
    null,
    2,
  );
}
