export const USAGE_EXPORT_URL = "https://cursor.com/dashboard/usage";

/** Favicon bar colors from the inline SVG in `web/index.html`. */
export const FAVICON_BLUE = "#58a6ff";
export const FAVICON_GREEN = "#3fb950";
export const FAVICON_GOLD = "#d29922";

const RESET = "\x1b[0m";
const BAR = "██";

export interface DashboardBannerOptions {
  /** When omitted, follows TTY and `NO_COLOR`, matching the CLI stats renderer. */
  color?: boolean;
}

function useColor(options: DashboardBannerOptions): boolean {
  return options.color ?? (Boolean(process.stdout.isTTY) && !process.env.NO_COLOR);
}

function hexToRgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `\x1b[38;2;${r};${g};${b}m`;
}

function paint(enabled: boolean, hex: string, text: string): string {
  return enabled ? `${hexToRgb(hex)}${text}${RESET}` : text;
}

/**
 * Startup banner printed when the local dashboard begins listening.
 *
 * The glyph is the favicon: three vertical bars of increasing height.
 * `label` is the token after the product name: a published version (`v0.10.0`)
 * or a development marker (`(dev)`).
 */
export function dashboardBanner(
  label: string,
  url: string,
  options: DashboardBannerOptions = {},
): string {
  const color = useColor(options);
  const blue = paint(color, FAVICON_BLUE, BAR);
  const green = paint(color, FAVICON_GREEN, BAR);
  const gold = paint(color, FAVICON_GOLD, BAR);

  return [
    `      ${gold}  cursor-usage ${label}`,
    `   ${green} ${gold}  dashboard: ${url}`,
    `${blue} ${green} ${gold}  csv download: ${USAGE_EXPORT_URL}`,
    "          drop the file onto the page. Ctrl+C to stop",
  ].join("\n");
}
