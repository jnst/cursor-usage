import type { DisplayMetric } from "./types.ts";

import { dateTimeParts } from "./time.ts";

/**
 * Formats Cost for human-readable display.
 *
 * The default keeps cents because Cost comes from the Usage Export and should
 * not be visually rounded away. Chart axes may pass `trimZeroCents` so labels
 * like `$180.00` become `$180` while non-zero cents remain visible.
 */
export function formatUsd(value: number, options: { trimZeroCents?: boolean } = {}): string {
  const fixed = value.toFixed(2);
  if (options.trimZeroCents && fixed.endsWith(".00")) {
    return `$${fixed.slice(0, -3)}`;
  }
  return `$${fixed}`;
}

/**
 * Formats token counts with compact suffixes for dense labels.
 *
 * This is for human-readable display only; calculations and machine-readable
 * outputs should keep the original numeric token counts.
 */
export function formatTokens(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}

/**
 * Returns reported Cost per million tokens, or null when Token Count is 0.
 *
 * This is a display diagnostic, not a reconstructed model price. A null result
 * should render as an em dash rather than `$0.00 / MTok`.
 */
export function costPerMillionTokens(cost: number, tokens: number): number | null {
  if (tokens <= 0) return null;
  return (cost / tokens) * 1_000_000;
}

/**
 * Formats Effective Rate as `$x.xx / MTok`, or `—` when Token Count is 0.
 */
export function formatUsdPerMTok(cost: number, tokens: number): string {
  const rate = costPerMillionTokens(cost, tokens);
  if (rate === null) return "—";
  return `${formatUsd(rate)} / MTok`;
}

/**
 * Formats a Display Metric value as USD or compact Token Count.
 */
export function formatMetric(
  value: number,
  metric: DisplayMetric,
  options: { trimZeroCents?: boolean } = {},
): string {
  return metric === "tokens" ? formatTokens(value) : formatUsd(value, options);
}

/**
 * Formats an event timestamp in the selected Analysis Time Zone.
 *
 * The input Date is an absolute timestamp; the time zone controls the calendar
 * local date and clock time shown to the user.
 */
export function formatDateTime(date: Date, timeZone: string): string {
  const parts = dateTimeParts(date, timeZone);
  const localDate = [parts.get("year"), parts.get("month"), parts.get("day")].join("-");
  const time = [parts.get("hour"), parts.get("minute")].join(":");
  return `${localDate} ${time}`;
}

/**
 * Formats only the clock time portion of an event timestamp.
 *
 * Use this inside a Daily Window detail view where the window key is already
 * visible and the relevant context is the local clock time.
 */
export function formatTime(date: Date, timeZone: string): string {
  const parts = dateTimeParts(date, timeZone);
  return [parts.get("hour"), parts.get("minute"), parts.get("second")].join(":");
}
