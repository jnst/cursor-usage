import type { UsageEvent } from "../../src/core/types.ts";

import { byModelFamily } from "../../src/core/aggregate.ts";

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

export const BAR_SIZE = 40;

/**
 * Assigns a stable color to each Model Family.
 *
 * Compute this from the unfiltered analysis set so a Model Family keeps the
 * same color across the Overview, Daily Window views, and User filters.
 */
export function modelFamilyColors(events: UsageEvent[]): Map<string, string> {
  const colors = new Map<string, string>();
  byModelFamily(events).forEach((family, i) => {
    colors.set(family.key, COLORS[i % COLORS.length]!);
  });
  return colors;
}

export const tooltipStyle = {
  backgroundColor: "#161b22",
  border: "1px solid #21262d",
  borderRadius: 8,
  fontSize: 12,
  color: "#e6edf3",
} as const;

export const tooltipTextStyle = { color: "#e6edf3" } as const;
