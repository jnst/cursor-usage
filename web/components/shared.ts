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

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatAxisUsd(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return formatUsd(Number(n.toFixed(2)));
}

export function niceCostMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const niceNormalized =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

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

export function formatDateTime(date: Date, timeZone: string): string {
  const day = [
    dateTimePart(date, timeZone, "year"),
    dateTimePart(date, timeZone, "month"),
    dateTimePart(date, timeZone, "day"),
  ].join("-");
  const time = [
    dateTimePart(date, timeZone, "hour"),
    dateTimePart(date, timeZone, "minute"),
  ].join(":");
  return `${day} ${time}`;
}

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
