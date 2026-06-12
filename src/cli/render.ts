import {
  byDay,
  byHour,
  byKind,
  byModel,
  byUser,
  onDay,
  summarize,
  topEvents,
} from "../core/aggregate.ts";
import type { BucketStat, Summary, UsageEvent } from "../core/types.ts";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

const ansi = (code: string) => (s: string) =>
  useColor ? `\x1b[${code}m${s}\x1b[0m` : s;

export const bold = ansi("1");
export const dim = ansi("2");
export const cyan = ansi("36");
export const green = ansi("32");
export const yellow = ansi("33");

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatTokens(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}

/** Horizontal bar with 1/8-block resolution. */
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

function renderSummaryBlock(summary: Summary): string[] {
  const period =
    summary.firstDay && summary.lastDay
      ? `${summary.firstDay} – ${summary.lastDay}`
      : "no data";
  const label = (s: string) => dim(padEndDisplay(s, 14));
  const value = (s: string) => bold(padEndDisplay(s, 12));
  return [
    `${bold("Cursor Usage")}  ${period}  ${dim(`(${summary.eventCount} events, ${summary.dayCount} days)`)}`,
    "",
    `  ${label("Total Cost")}${value(formatUsd(summary.totalCost))}  ${label("Total Tokens")}${value(formatTokens(summary.totalTokens))}`,
    `  ${label("Avg/Day")}${value(formatUsd(summary.avgCostPerDay))}  ${label("Max Mode")}${value(`${Math.round(summary.maxModeRatio * 100)}%`)}`,
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

export type StatsAxis = "day" | "user" | "model";

export function renderStats(
  events: UsageEvent[],
  axis: StatsAxis | undefined,
): string {
  const summary = summarize(events);
  const sections: string[][] = [renderSummaryBlock(summary)];

  const charts: Record<StatsAxis, () => string[]> = {
    day: () =>
      renderBucketChart("Daily Cost", byDay(events), {
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
    sections.push(charts.day(), charts.model(), charts.user());
  }

  return sections.map((s) => s.join("\n")).join("\n\n") + "\n";
}

export function statsJson(events: UsageEvent[]): string {
  return JSON.stringify(
    {
      summary: summarize(events),
      byDay: byDay(events),
      byModel: byModel(events),
      byUser: byUser(events),
    },
    null,
    2,
  );
}

function renderDaySummaryBlock(
  day: string,
  dayEvents: UsageEvent[],
  totalCost: number,
  rank: number,
  dayCount: number,
): string[] {
  const s = summarize(dayEvents);
  const share = totalCost > 0 ? Math.round((s.totalCost / totalCost) * 100) : 0;
  const label = (str: string) => dim(padEndDisplay(str, 14));
  const value = (str: string) => bold(padEndDisplay(str, 12));
  return [
    `${bold(`Day ${day}`)}  ${dim(`(${s.eventCount} events, rank ${rank}/${dayCount} by cost)`)}`,
    "",
    `  ${label("Cost")}${value(formatUsd(s.totalCost))}  ${label("of period")}${value(`${share}%`)}`,
    `  ${label("Total Tokens")}${value(formatTokens(s.totalTokens))}  ${label("Max Mode")}${value(`${Math.round(s.maxModeRatio * 100)}%`)}`,
    `  ${label("Users")}${value(String(s.userCount))}  ${label("Models")}${value(String(s.modelCount))}`,
  ];
}

function renderHourlyChart(dayEvents: UsageEvent[]): string[] {
  const byHourMap = new Map(byHour(dayEvents).map((b) => [b.key, b]));
  const maxCost = Math.max(...[...byHourMap.values()].map((b) => b.cost), 0);
  const lines = [bold("By Hour (UTC)")];
  for (let h = 0; h < 24; h++) {
    const key = String(h).padStart(2, "0");
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

function renderDayEvents(dayEvents: UsageEvent[], limit: number): string[] {
  const top = topEvents(dayEvents, limit);
  const lines = [bold(`Top Events (${top.length} of ${dayEvents.length})`)];
  const userWidth = Math.max(...top.map((e) => e.user.length), 4);
  const modelWidth = Math.max(...top.map((e) => e.model.length), 5);
  for (const e of top) {
    const time = e.date.toISOString().slice(11, 19);
    lines.push(
      `  ${dim(time)}  ${padEndDisplay(e.user, userWidth)}  ${padEndDisplay(e.model, modelWidth)}  ${padEndDisplay(formatUsd(e.cost), 8)} ${dim(`${formatTokens(e.totalTokens)} tok`)}`,
    );
  }
  return lines;
}

export function renderDayDetail(events: UsageEvent[], day: string): string {
  const days = byDay(events);
  const dayEvents = onDay(events, day);
  if (dayEvents.length === 0) {
    const known = days.map((d) => d.key);
    const hint =
      known.length > 0
        ? `\nAvailable days: ${known[0]} – ${known[known.length - 1]}`
        : "";
    return `No billable events on ${day}.${hint}\n`;
  }

  const totalCost = events.reduce((sum, e) => sum + e.cost, 0);
  const rank =
    [...days].sort((a, b) => b.cost - a.cost).findIndex((d) => d.key === day) +
    1;

  const sections: string[][] = [
    renderDaySummaryBlock(day, dayEvents, totalCost, rank, days.length),
    renderHourlyChart(dayEvents),
    renderBucketChart("By Model", byModel(dayEvents), {
      totalCost: summarize(dayEvents).totalCost,
    }),
    renderBucketChart("By User", byUser(dayEvents), {
      totalCost: summarize(dayEvents).totalCost,
    }),
    renderBucketChart("By Kind", byKind(dayEvents), { totalCost: 0 }),
    renderDayEvents(dayEvents, 20),
  ];

  return sections.map((s) => s.join("\n")).join("\n\n") + "\n";
}

export function dayDetailJson(events: UsageEvent[], day: string): string {
  const dayEvents = onDay(events, day);
  return JSON.stringify(
    {
      day,
      summary: summarize(dayEvents),
      byHour: byHour(dayEvents),
      byModel: byModel(dayEvents),
      byUser: byUser(dayEvents),
      byKind: byKind(dayEvents),
    },
    null,
    2,
  );
}
