import type { AnalysisContext, BucketStat, Metric, Summary, UsageEvent } from "../core/types.ts";

import {
  bucketMetric,
  byDailyWindow,
  byHour,
  byKind,
  byModel,
  byModelFamily,
  byUser,
  eventMetric,
  summarize,
  topEvents,
} from "../core/aggregate.ts";
import {
  formatMetric,
  formatTime,
  formatTokens,
  formatUsd,
  formatUsdPerMTok,
} from "../core/format.ts";
import { eventsInDailyWindow, orderedHours } from "../core/time.ts";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

const ansi = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const bold = ansi("1");
export const dim = ansi("2");
export const cyan = ansi("36");
export const green = ansi("32");
export const yellow = ansi("33");

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

function metricTotal(summary: Summary, metric: Metric): number {
  return metric === "tokens" ? summary.totalTokens : summary.totalCost;
}

function renderSummaryBlock(
  summary: Summary,
  ctx: AnalysisContext,
  metric: Metric,
  user: string | undefined,
  modelFamily?: string,
): string[] {
  const period =
    summary.firstDailyWindow && summary.lastDailyWindow
      ? `${summary.firstDailyWindow} – ${summary.lastDailyWindow}`
      : "no data";
  const scope = [
    `${ctx.timeZone}, start ${ctx.startHour}:00`,
    `metric ${metric}`,
    ...(user ? [`user ${user}`] : []),
    ...(modelFamily ? [`model family ${modelFamily}`] : []),
  ].join(", ");
  const label = (s: string) => dim(padEndDisplay(s, 14));
  const value = (s: string) => bold(padEndDisplay(s, 12));
  const primary =
    metric === "tokens"
      ? { name: "Total Tokens", value: formatTokens(summary.totalTokens) }
      : { name: "Total Cost", value: formatUsd(summary.totalCost) };
  const secondary =
    metric === "tokens"
      ? { name: "Total Cost", value: formatUsd(summary.totalCost) }
      : { name: "Total Tokens", value: formatTokens(summary.totalTokens) };
  const avg =
    metric === "tokens"
      ? formatTokens(
          summary.dailyWindowCount > 0 ? summary.totalTokens / summary.dailyWindowCount : 0,
        )
      : formatUsd(summary.avgCostPerActiveDailyWindow);
  return [
    `${bold("Cursor Usage")}  ${period}  ${dim(`(${summary.eventCount} events, ${summary.dailyWindowCount} daily windows, ${scope})`)}`,
    "",
    `  ${label(primary.name)}${value(primary.value)}  ${label(secondary.name)}${value(secondary.value)}`,
    `  ${label("Effective")}${value(formatUsdPerMTok(summary.totalCost, summary.totalTokens))}  ${label("Avg Daily")}${value(avg)}`,
    `  ${label("Users / Models")}${value(`${summary.userCount} / ${summary.modelCount}`)}`,
  ];
}

function renderBucketChart(
  title: string,
  buckets: BucketStat[],
  metric: Metric,
  options: { total: number; barWidth?: number; maxRows?: number } = { total: 0 },
): string[] {
  const { total, barWidth = 28, maxRows = 15 } = options;
  const rows = buckets.slice(0, maxRows);
  const keyWidth = Math.max(...rows.map((b) => b.key.length), 4);
  const maxValue = Math.max(...rows.map((b) => bucketMetric(b, metric)), 0);
  const other: Metric = metric === "tokens" ? "cost" : "tokens";

  const lines = [bold(title)];
  for (const b of rows) {
    const value = bucketMetric(b, metric);
    const share = total > 0 ? ` ${dim(`${Math.round((value / total) * 100)}%`)}` : "";
    lines.push(
      `  ${padEndDisplay(b.key, keyWidth)}  ${padEndDisplay(formatMetric(value, metric), 8)} ${cyan(padEndDisplay(bar(value, maxValue, barWidth), barWidth))}${share} ${dim(`${formatMetric(bucketMetric(b, other), other)}, ${b.eventCount} ev`)}`,
    );
  }
  if (buckets.length > maxRows) {
    lines.push(dim(`  … and ${buckets.length - maxRows} more`));
  }
  return lines;
}

export type StatsAxis = "daily-window" | "user" | "model" | "model-family";

/**
 * Renders the overview analysis for terminal display.
 *
 * The input events should already reflect CLI filters such as Billable Events
 * only, selected User, selected Model Family, and No Charge inclusion. The
 * default view groups Models by Model Family; use the `model` axis or a
 * Model Family filter to see individual Models.
 */
export function renderStats(
  events: UsageEvent[],
  axis: StatsAxis | undefined,
  ctx: AnalysisContext,
  user?: string,
  modelFamily?: string,
  metric: Metric = "cost",
): string {
  const summary = summarize(events, ctx);
  const total = metricTotal(summary, metric);
  const metricName = metric === "tokens" ? "Tokens" : "Cost";
  const sections: string[][] = [renderSummaryBlock(summary, ctx, metric, user, modelFamily)];

  const charts: Record<StatsAxis, () => string[]> = {
    "daily-window": () =>
      renderBucketChart(`Daily Window ${metricName}`, byDailyWindow(events, ctx), metric, {
        total,
        maxRows: 31,
      }),
    model: () =>
      renderBucketChart("By Model", byModel(events, metric), metric, {
        total,
      }),
    "model-family": () =>
      renderBucketChart("By Model Family", byModelFamily(events, metric), metric, {
        total,
      }),
    user: () =>
      renderBucketChart("By User", byUser(events, metric), metric, {
        total,
      }),
  };

  if (axis) {
    sections.push(charts[axis]());
  } else {
    sections.push(
      charts["daily-window"](),
      modelFamily ? charts.model() : charts["model-family"](),
      charts.user(),
    );
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
  ctx: AnalysisContext,
  user?: string,
  modelFamily?: string,
  metric: Metric = "cost",
): string {
  return JSON.stringify(
    {
      timeZone: ctx.timeZone,
      startHour: ctx.startHour,
      metric,
      filters: { user: user ?? null, modelFamily: modelFamily ?? null },
      summary: summarize(events, ctx),
      byDailyWindow: byDailyWindow(events, ctx),
      byModelFamily: byModelFamily(events, metric),
      byModel: byModel(events, metric),
      byUser: byUser(events, metric),
    },
    null,
    2,
  );
}

function renderDailyWindowSummaryBlock(
  dailyWindow: string,
  dailyWindowEvents: UsageEvent[],
  ctx: AnalysisContext,
  metric: Metric,
  periodTotal: number,
  rank: number,
  dailyWindowCount: number,
): string[] {
  const s = summarize(dailyWindowEvents, ctx);
  const windowValue = metricTotal(s, metric);
  const share = periodTotal > 0 ? Math.round((windowValue / periodTotal) * 100) : 0;
  const label = (str: string) => dim(padEndDisplay(str, 14));
  const value = (str: string) => bold(padEndDisplay(str, 12));
  const primary =
    metric === "tokens"
      ? { name: "Tokens", value: formatTokens(s.totalTokens) }
      : { name: "Cost", value: formatUsd(s.totalCost) };
  const secondary =
    metric === "tokens"
      ? { name: "Cost", value: formatUsd(s.totalCost) }
      : { name: "Total Tokens", value: formatTokens(s.totalTokens) };
  return [
    `${bold(`Daily Window ${dailyWindow}`)}  ${dim(`(${s.eventCount} events, rank ${rank}/${dailyWindowCount} by ${metric}, ${ctx.timeZone}, start ${ctx.startHour}:00)`)}`,
    "",
    `  ${label(primary.name)}${value(primary.value)}  ${label("of period")}${value(`${share}%`)}`,
    `  ${label(secondary.name)}${value(secondary.value)}  ${label("Effective")}${value(formatUsdPerMTok(s.totalCost, s.totalTokens))}`,
    `  ${label("Users / Models")}${value(`${s.userCount} / ${s.modelCount}`)}`,
  ];
}

function renderHourlyChart(
  dailyWindowEvents: UsageEvent[],
  ctx: AnalysisContext,
  metric: Metric,
): string[] {
  const byHourMap = new Map(byHour(dailyWindowEvents, ctx).map((b) => [b.key, b]));
  const maxValue = Math.max(...[...byHourMap.values()].map((b) => bucketMetric(b, metric)), 0);
  const other: Metric = metric === "tokens" ? "cost" : "tokens";
  const lines = [bold(`By Hour (${ctx.timeZone})`)];
  for (const key of orderedHours(ctx)) {
    const b = byHourMap.get(key);
    const value = b ? bucketMetric(b, metric) : 0;
    const events = b?.eventCount ?? 0;
    const meta =
      events > 0 ? dim(` ${formatMetric(bucketMetric(b!, other), other)}, ${events} ev`) : "";
    lines.push(
      `  ${key}  ${padEndDisplay(value > 0 ? formatMetric(value, metric) : "", 8)} ${cyan(padEndDisplay(bar(value, maxValue, 24), 24))}${meta}`,
    );
  }
  return lines;
}

function renderDailyWindowEvents(
  dailyWindowEvents: UsageEvent[],
  limit: number,
  timeZone: string,
  metric: Metric,
): string[] {
  const top = topEvents(dailyWindowEvents, limit, metric);
  const lines = [bold(`Top Events (${top.length} of ${dailyWindowEvents.length})`)];
  const userWidth = Math.max(...top.map((e) => e.user.length), 4);
  const modelWidth = Math.max(...top.map((e) => e.model.length), 5);
  const other: Metric = metric === "tokens" ? "cost" : "tokens";
  for (const e of top) {
    const time = formatTime(e.date, timeZone);
    const primary = formatMetric(eventMetric(e, metric), metric);
    lines.push(
      `  ${dim(time)}  ${padEndDisplay(e.user, userWidth)}  ${padEndDisplay(e.model, modelWidth)}  ${padEndDisplay(primary, 8)} ${dim(formatMetric(eventMetric(e, other), other))}`,
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
  ctx: AnalysisContext,
  user?: string,
  modelFamily?: string,
  metric: Metric = "cost",
): string {
  const dailyWindows = byDailyWindow(events, ctx);
  const dailyWindowEvents = eventsInDailyWindow(events, dailyWindow, ctx);
  if (dailyWindowEvents.length === 0) {
    const known = dailyWindows.map((d) => d.key);
    const hint =
      known.length > 0 ? `\nAvailable Daily Windows: ${known[0]} – ${known[known.length - 1]}` : "";
    return `No billable events in Daily Window ${dailyWindow}.${hint}\n`;
  }

  const summary = summarize(events, ctx);
  const periodTotal = metricTotal(summary, metric);
  const rank =
    [...dailyWindows]
      .sort((a, b) => bucketMetric(b, metric) - bucketMetric(a, metric))
      .findIndex((d) => d.key === dailyWindow) + 1;
  const dailyWindowTotal = metricTotal(summarize(dailyWindowEvents, ctx), metric);

  const sections: string[][] = [
    renderDailyWindowSummaryBlock(
      dailyWindow,
      dailyWindowEvents,
      ctx,
      metric,
      periodTotal,
      rank,
      dailyWindows.length,
    ),
    ...(user ? [[dim(`Filtered to user: ${user}`)]] : []),
    ...(modelFamily ? [[dim(`Filtered to model family: ${modelFamily}`)]] : []),
    renderHourlyChart(dailyWindowEvents, ctx, metric),
    ...(modelFamily
      ? []
      : [
          renderBucketChart("By Model Family", byModelFamily(dailyWindowEvents, metric), metric, {
            total: dailyWindowTotal,
          }),
        ]),
    renderBucketChart("By Model", byModel(dailyWindowEvents, metric), metric, {
      total: dailyWindowTotal,
    }),
    renderBucketChart("By User", byUser(dailyWindowEvents, metric), metric, {
      total: dailyWindowTotal,
    }),
    renderBucketChart("By Kind", byKind(dailyWindowEvents, metric), metric, {
      total: dailyWindowTotal,
    }),
    renderDailyWindowEvents(dailyWindowEvents, 20, ctx.timeZone, metric),
  ];

  return sections.map((s) => s.join("\n")).join("\n\n") + "\n";
}

/**
 * Serializes one Daily Window detail view as JSON for scripting.
 *
 * The returned object includes the selected Daily Window, Analysis Time Zone,
 * start hour, Selected Metric, filters, and the same breakdowns shown in terminal output.
 */
export function dailyWindowViewJson(
  events: UsageEvent[],
  dailyWindow: string,
  ctx: AnalysisContext,
  user?: string,
  modelFamily?: string,
  metric: Metric = "cost",
): string {
  const dailyWindowEvents = eventsInDailyWindow(events, dailyWindow, ctx);
  return JSON.stringify(
    {
      dailyWindow,
      timeZone: ctx.timeZone,
      startHour: ctx.startHour,
      metric,
      filters: { user: user ?? null, modelFamily: modelFamily ?? null },
      summary: summarize(dailyWindowEvents, ctx),
      byHour: byHour(dailyWindowEvents, ctx),
      byModelFamily: byModelFamily(dailyWindowEvents, metric),
      byModel: byModel(dailyWindowEvents, metric),
      byUser: byUser(dailyWindowEvents, metric),
      byKind: byKind(dailyWindowEvents, metric),
    },
    null,
    2,
  );
}
