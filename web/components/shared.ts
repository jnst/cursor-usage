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

export function formatTokens(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}

export const tooltipStyle = {
  backgroundColor: "#161b22",
  border: "1px solid #21262d",
  borderRadius: 8,
  fontSize: 12,
} as const;
