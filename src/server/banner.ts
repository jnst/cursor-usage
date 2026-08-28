export const USAGE_EXPORT_URL = "https://cursor.com/dashboard/usage";

/**
 * Startup banner printed when the local dashboard begins listening.
 *
 * `label` is the token after the product name: a published version (`v0.10.0`)
 * or a development marker (`(dev)`).
 */
export function dashboardBanner(label: string, url: string): string {
  return [
    `     ▂█  cursor-usage ${label}`,
    `   ▂▄██  dashboard · ${url}`,
    `  ▂▄███  CSV · ${USAGE_EXPORT_URL}`,
    "         drop the file onto the page · Ctrl+C to stop",
  ].join("\n");
}
