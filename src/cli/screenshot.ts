import type { UsageEvent } from "../core/types.ts";

import { basename, dirname, extname, join } from "node:path";

import { eventsInDailyWindow } from "../core/aggregate.ts";
import { startServer } from "../server/index.ts";

interface ScreenshotOptions {
  csvPath: string;
  events: UsageEvent[];
  timeZone: string;
  dailyWindow?: string;
  startHour: number;
  eventLimit?: number;
  dailyReport: boolean;
  out?: string;
  user?: string;
}

interface BrowserLike {
  close(): Promise<void>;
  newPage(options: { viewport: { width: number; height: number } }): Promise<PageLike>;
}

interface PageLike {
  addInitScript(options: { content: string }): Promise<void>;
  goto(url: string, options: { waitUntil: "networkidle" }): Promise<void>;
  waitForSelector(selector: string, options: { timeout: number }): Promise<void>;
  screenshot(options: { path: string; fullPage: boolean }): Promise<Buffer>;
}

interface ChromiumLike {
  launch(options: {
    headless: boolean;
    channel?: string;
    executablePath?: string;
  }): Promise<BrowserLike>;
}

function outputPath(options: ScreenshotOptions): string {
  const { csvPath, dailyWindow, dailyReport, out } = options;
  if (out) return out;
  if (dailyReport) return join(process.cwd(), "daily-report.png");
  const ext = extname(csvPath);
  const base = basename(csvPath, ext);
  return join(dirname(csvPath), `${base}${dailyWindow ? `-${dailyWindow}-daily` : ""}.png`);
}

async function loadChromium(): Promise<ChromiumLike> {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<{ chromium?: ChromiumLike }>;
  try {
    const playwright = await dynamicImport("playwright-core");
    if (!playwright.chromium) throw new Error("playwright-core did not expose chromium");
    return playwright.chromium;
  } catch (error) {
    throw new Error(
      `Screenshot export requires playwright-core. Install dependencies and try again.\n${String(error)}`,
    );
  }
}

function serializeEvents(events: UsageEvent[]) {
  return events.map((event) => ({ ...event, date: event.date.toISOString() }));
}

/**
 * Captures the real dashboard UI as a PNG using a headless browser.
 *
 * This keeps screenshot output aligned with the web dashboard. Playwright is
 * dynamically imported so non-screenshot CLI commands do not load browser code.
 */
export async function writeScreenshot(options: ScreenshotOptions): Promise<string> {
  if (options.events.length === 0) {
    throw new Error("No billable usage events found in the Usage Export.");
  }

  if (options.dailyWindow) {
    const windowEvents = eventsInDailyWindow(
      options.events,
      options.dailyWindow,
      options.timeZone,
      options.startHour,
    );
    if (windowEvents.length === 0) {
      throw new Error(
        `No billable usage events found in Daily Window ${options.dailyWindow} (start hour ${options.startHour}, ${options.timeZone}).`,
      );
    }
  }

  const chromium = await loadChromium();
  const launchOptions =
    process.env.CHROME_PATH !== undefined
      ? { headless: true, executablePath: process.env.CHROME_PATH }
      : { headless: true, channel: process.env.PLAYWRIGHT_CHROME_CHANNEL ?? "chrome" };

  let browser: BrowserLike;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (error) {
    throw new Error(
      [
        "Could not launch Chrome for screenshot export.",
        "Install Google Chrome, set CHROME_PATH, or set PLAYWRIGHT_CHROME_CHANNEL to an installed Chromium channel.",
        String(error),
      ].join("\n"),
    );
  }

  const output = outputPath(options);
  const runningServer = await startServer({ port: 0 });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.addInitScript({
      content: `window.__CURSOR_USAGE_EVENTS__ = ${JSON.stringify(serializeEvents(options.events))};`,
    });

    const url = new URL(runningServer.url);
    url.hash = new URLSearchParams({
      timezone: options.timeZone,
      ...(options.user ? { user: options.user } : {}),
      ...(options.dailyWindow ? { "daily-window": options.dailyWindow } : {}),
      ...(options.startHour !== 0 ? { "start-hour": String(options.startHour) } : {}),
      ...(options.eventLimit !== undefined ? { "event-limit": String(options.eventLimit) } : {}),
    }).toString();

    await page.goto(url.href, { waitUntil: "networkidle" });
    await page.waitForSelector(".grid", { timeout: 10_000 });
    await page.screenshot({ path: output, fullPage: true });
  } finally {
    runningServer.server.close();
    await browser.close();
  }
  return output;
}
