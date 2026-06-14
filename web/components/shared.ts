export const COLORS = [
  "#58a6ff", // blue
  "#3fb950", // green
  "#d29922", // amber
  "#f778ba", // pink
  "#a371f7", // purple
  "#ff7b72", // coral
  "#39c5cf", // cyan
  "#e3b341", // gold
  "#7ee787", // light green
  "#ffa657", // orange
  "#d2a8ff", // lavender
  "#79c0ff", // light blue
  "#f85149", // red
  "#56d364", // emerald
  "#ec8e2c", // pumpkin
  "#bc8cff", // violet
  "#54aeff", // azure
  "#9e6a03", // bronze
  "#ff9bce", // rose
  "#6e7681", // gray
];

/**
 * Formats Cost for web UI display.
 *
 * The default keeps cents for cards, tooltips, and tables. Chart axes may pass
 * `trimZeroCents` so labels like `$180.00` become `$180` while non-zero cents
 * remain visible.
 */
export function formatUsd(value: number, options: { trimZeroCents?: boolean } = {}): string {
  const fixed = value.toFixed(2);
  if (options.trimZeroCents && fixed.endsWith(".00")) {
    return `$${fixed.slice(0, -3)}`;
  }
  return `$${fixed}`;
}

/**
 * Formats token counts with compact suffixes for dense UI labels.
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

/**
 * Formats an event timestamp in the selected Analysis Time Zone.
 *
 * The input Date is an absolute timestamp; the time zone controls the calendar
 * local date and clock time shown to the user.
 */
export function formatDateTime(date: Date, timeZone: string): string {
  const localDate = [
    dateTimePart(date, timeZone, "year"),
    dateTimePart(date, timeZone, "month"),
    dateTimePart(date, timeZone, "day"),
  ].join("-");
  const time = [dateTimePart(date, timeZone, "hour"), dateTimePart(date, timeZone, "minute")].join(
    ":",
  );
  return `${localDate} ${time}`;
}

/**
 * Formats only the clock time portion of an event timestamp.
 *
 * Use this inside a Daily Window detail view where the window key is already
 * visible and the relevant context is the local clock time.
 */
export function formatTime(date: Date, timeZone: string): string {
  return [
    dateTimePart(date, timeZone, "hour"),
    dateTimePart(date, timeZone, "minute"),
    dateTimePart(date, timeZone, "second"),
  ].join(":");
}

export const tooltipStyle = {
  backgroundColor: "#161b22",
  border: "1px solid #21262d",
  borderRadius: 8,
  fontSize: 12,
} as const;
